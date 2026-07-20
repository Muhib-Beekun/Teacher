import { useRef, useEffect, useCallback, useState } from 'preact/hooks';
import {
    listening, flushing, micRuntime, recordingArmed, liveEditLock,
    micSpeechBlocked, micProcessing, health, setStatus, applySession,
    speechRecoveryMode, appSettings
} from '../state';
import { addSegment, addAudio, loadSettings, copyText, logSpeechTrace } from '../api';
import { MicButton } from './MicButton';
import { Waveform } from './Waveform';
import {
    SpeechRecoveryController,
    type BrowserRecoveryConfig,
    type RecoveryAction,
    type SpeechRecoveryEvent,
    DEFAULT_BROWSER_RECOVERY_CONFIG
} from '../speechRecovery';
import { alertForRecoveryAction, speechAlertQueue } from '../speechAlertQueue';
import { resolveClipboardToPromptText } from '../../context/pathTokens';

const PERMANENT_SPEECH_ERRORS = new Set(['service-not-allowed', 'audio-capture']);
const STABLE_CHECK_MS = 15_000;
const RETRY_START_FAILURE_DELAY_MS = 400;

function isMicCapableBrowser(): boolean {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return true;
    if (/Chrome\//.test(ua) && !/OPR\//.test(ua) && !/SamsungBrowser\//.test(ua)) return true;
    return false;
}

function buildRecoveryConfig(): BrowserRecoveryConfig {
    const s = appSettings.peek();
    return {
        ...DEFAULT_BROWSER_RECOVERY_CONFIG,
        maxRetries: s?.browserRecoveryMaxRetries ?? DEFAULT_BROWSER_RECOVERY_CONFIG.maxRetries,
        enableAutoFallback: s?.browserRecoveryEnableAutoFallback ?? true,
        resetWindowSec: s?.browserRecoveryResetWindowSec ?? DEFAULT_BROWSER_RECOVERY_CONFIG.resetWindowSec,
        sttProvider: s?.sttProvider ?? 'auto'
    };
}

export function CapturePanel() {
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const pendingBlobRef = useRef<Blob | null>(null);
    const chunkTranscriptRef = useRef('');
    const activeMimeRef = useRef('audio/webm');
    const liveTextRef = useRef<HTMLDivElement>(null);
    const [activeAnalyser, setActiveAnalyser] = useState<AnalyserNode | null>(null);

    const recoveryRef = useRef(new SpeechRecoveryController(buildRecoveryConfig()));
    const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stableTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const userStoppingRef = useRef(false);
    const listeningRef = useRef(false);
    const recoveryRestartPendingRef = useRef(false);
    const skipNextSpeechEndRef = useRef(false);

    const normalizeSpaces = (text: string) => (text || '').replace(/\s+/g, ' ').trim();

    const appendSpeechChunk = (base: string, addition: string) => {
        const next = normalizeSpaces(addition);
        if (!next) return normalizeSpaces(base);
        const prev = (base || '').trimEnd();
        return prev ? prev + ' ' + next : next;
    };

    const getLiveText = () => {
        const el = liveTextRef.current;
        return el ? normalizeSpaces(el.innerText.replace(/\u00a0/g, ' ')) : '';
    };

    const setLiveText = (text: string) => {
        const el = liveTextRef.current;
        if (!el) return;
        el.innerText = text;
        el.classList.toggle('empty', !text.trim());
    };

    const setLiveTextFromSpeech = (text: string) => {
        if (liveEditLock.value && !listening.value) return;
        setLiveText(text);
    };

    const clearLiveText = () => {
        chunkTranscriptRef.current = '';
        setLiveText('');
    };

    const clearRecoveryTimers = useCallback(() => {
        if (recoveryTimerRef.current) {
            clearTimeout(recoveryTimerRef.current);
            recoveryTimerRef.current = null;
        }
        if (stableTimerRef.current) {
            clearInterval(stableTimerRef.current);
            stableTimerRef.current = null;
        }
        recoveryRestartPendingRef.current = false;
    }, []);

    const stopWebSpeech = useCallback(() => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch {
                // ignore
            }
        }
    }, []);

    const showMicUnsupported = useCallback(() => {
        micSpeechBlocked.value = true;
    }, []);

    const applyRecoveryActions = useCallback(
        (actions: RecoveryAction[]) => {
            for (const action of actions) {
                const alertKind = alertForRecoveryAction(action);
                if (alertKind) {
                    speechAlertQueue.enqueue(alertKind);
                }
                switch (action.type) {
                    case 'trace':
                        void logSpeechTrace(action.payload);
                        break;
                    case 'status':
                        setStatus(action.message, action.kind);
                        break;
                    case 'schedule_retry': {
                        if (recoveryTimerRef.current) {
                            clearTimeout(recoveryTimerRef.current);
                            recoveryTimerRef.current = null;
                        }
                        recoveryRestartPendingRef.current = true;
                        const attemptRestart = (delayMs: number, allowRetryOnStartFail: boolean) => {
                            recoveryTimerRef.current = setTimeout(() => {
                                recoveryRestartPendingRef.current = false;
                                if (!listeningRef.current) return;
                                if (!recoveryRef.current.shouldAutoRestartRecognition()) return;
                                try {
                                    recognitionRef.current?.start();
                                    applyRecoveryActions(
                                        recoveryRef.current.dispatch({ type: 'speech_start' })
                                    );
                                } catch {
                                    // InvalidStateError / race — one quick re-arm, then wait for onend/error.
                                    if (allowRetryOnStartFail) {
                                        recoveryRestartPendingRef.current = true;
                                        attemptRestart(RETRY_START_FAILURE_DELAY_MS, false);
                                    }
                                }
                            }, delayMs);
                        };
                        attemptRestart(action.delayMs, true);
                        break;
                    }
                    case 'evaluate_fallback': {
                        const fallbackActions = recoveryRef.current.finalizeFallback(
                            health.peek().stt,
                            Date.now(),
                            action.errorClass,
                            action.reason
                        );
                        applyRecoveryActions(fallbackActions);
                        break;
                    }
                    case 'fallback_provider':
                        speechRecoveryMode.value = 'provider';
                        stopWebSpeech();
                        if (listeningRef.current) {
                            setStatus('Listening via audio fallback. Tap mic to pause.', 'ok');
                        }
                        break;
                    case 'fallback_degraded':
                        speechRecoveryMode.value = 'degraded';
                        stopWebSpeech();
                        if (listeningRef.current) {
                            setStatus('Push-to-talk mode — type or pause mic to commit.', 'warn');
                        }
                        break;
                    case 'resume_listening':
                        break;
                    default:
                        break;
                }
            }
        },
        [stopWebSpeech]
    );

    const dispatchRecovery = useCallback(
        (event: SpeechRecoveryEvent) => {
            applyRecoveryActions(recoveryRef.current.dispatch(event));
        },
        [applyRecoveryActions]
    );

    const resetRecoveryForNewChunk = useCallback(() => {
        clearRecoveryTimers();
        recoveryRef.current = new SpeechRecoveryController(buildRecoveryConfig());
        speechRecoveryMode.value = 'browser';
        dispatchRecovery({ type: 'user_start' });
    }, [clearRecoveryTimers, dispatchRecovery]);

    const startStableWindowTimer = useCallback(() => {
        if (stableTimerRef.current) return;
        stableTimerRef.current = setInterval(() => {
            if (!listeningRef.current) return;
            dispatchRecovery({ type: 'stable_window_elapsed' });
        }, STABLE_CHECK_MS);
    }, [dispatchRecovery]);

    const stopRecordingRef = useRef<() => void>(() => {});

    const startWebSpeech = useCallback(() => {
        if (speechRecoveryMode.peek() !== 'browser') {
            return;
        }
        const SR = (window as Record<string, unknown>).SpeechRecognition ||
            (window as Record<string, unknown>).webkitSpeechRecognition;
        if (!SR) {
            showMicUnsupported();
            setStatus('Voice not supported in this browser. Open in Chrome or Edge.', 'warn');
            return;
        }
        if (!recognitionRef.current) {
            const rec = new (SR as { new(): SpeechRecognition })();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = 'en-US';
            rec.onresult = (event: SpeechRecognitionEvent) => {
                let interim = '';
                let finalText = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const res = event.results[i];
                    if (res.isFinal) finalText += res[0].transcript;
                    else interim += res[0].transcript;
                }
                if (finalText || interim) {
                    dispatchRecovery({ type: 'speech_result' });
                }
                if (finalText) {
                    chunkTranscriptRef.current = appendSpeechChunk(chunkTranscriptRef.current, finalText);
                    setLiveTextFromSpeech(chunkTranscriptRef.current);
                } else if (interim) {
                    setLiveTextFromSpeech(appendSpeechChunk(chunkTranscriptRef.current, interim));
                }
            };
            rec.onerror = (e: SpeechRecognitionErrorEvent) => {
                if (e.error === 'no-speech' || e.error === 'aborted') return;
                if (PERMANENT_SPEECH_ERRORS.has(e.error)) {
                    showMicUnsupported();
                    userStoppingRef.current = true;
                    if (listening.value) stopRecordingRef.current();
                    userStoppingRef.current = false;
                    setStatus('Voice not supported in this browser. Open in Chrome or Edge.', 'warn');
                    return;
                }
                if (e.error === 'network') {
                    skipNextSpeechEndRef.current = true;
                    try {
                        rec.stop();
                    } catch {
                        // ignore
                    }
                    dispatchRecovery({ type: 'speech_error_network' });
                    return;
                }
                dispatchRecovery({ type: 'speech_error_other', error: e.error });
            };
            rec.onend = () => {
                if (userStoppingRef.current || !listeningRef.current) return;
                if (recoveryRestartPendingRef.current) return;
                if (skipNextSpeechEndRef.current) {
                    skipNextSpeechEndRef.current = false;
                    return;
                }
                const snap = recoveryRef.current.getSnapshot();
                if (snap.mode !== 'browser' || snap.state === 'recovering') return;
                if (!recoveryRef.current.shouldAutoRestartRecognition()) return;
                const elapsed = snap.speechStartedAt ? Date.now() - snap.speechStartedAt : 0;
                const earlyEnd =
                    snap.speechStartedAt > 0 &&
                    !snap.hadResultSinceSpeechStart &&
                    elapsed > 0 &&
                    elapsed < DEFAULT_BROWSER_RECOVERY_CONFIG.earlyEndThresholdMs;
                const actions = recoveryRef.current.dispatch({
                    type: 'speech_end',
                    earlyEndWithoutResult: earlyEnd
                });
                if (actions.some((a) => a.type === 'schedule_retry' || a.type === 'evaluate_fallback')) {
                    applyRecoveryActions(actions);
                    return;
                }
                try {
                    rec.start();
                    dispatchRecovery({ type: 'speech_start' });
                } catch {
                    // ignore
                }
            };
            recognitionRef.current = rec;
        }
        try {
            recognitionRef.current.start();
            dispatchRecovery({ type: 'speech_start' });
        } catch {
            // ignore duplicate start
        }
    }, [applyRecoveryActions, dispatchRecovery, showMicUnsupported]);

    const commitChunk = useCallback(async () => {
        if (flushing.value) return;
        const text = getLiveText() || normalizeSpaces(chunkTranscriptRef.current);
        const blob = pendingBlobRef.current;
        if (!text && !(blob && blob.size > 0)) {
            micProcessing.value = false;
            setStatus('Ready. Tap mic to speak', 'ok');
            return;
        }
        flushing.value = true;
        micProcessing.value = true;
        micRuntime.value = 'processing';
        setStatus('Processing…');

        try {
            const h = health.peek();
            const forceAudio = speechRecoveryMode.peek() === 'provider';
            const useAudio =
                forceAudio || (blob && blob.size > 0 && h.stt && h.stt !== 'webspeech');
            let json: Record<string, unknown>;
            if (useAudio && blob && blob.size > 0) {
                json = await addAudio(blob, blob.type || activeMimeRef.current);
            } else {
                json = await addSegment(text);
            }
            if (json?.session) applySession(json.session as Parameters<typeof applySession>[0]);
            clearLiveText();
            pendingBlobRef.current = null;
            const session = json?.session as Record<string, unknown> | undefined;
            if (session?.status) {
                setStatus(session.status as string, session.compileError ? 'warn' : 'ok');
            } else {
                const err = session?.compileError;
                const msg = err ? 'Added. Compile failed — tap refresh.' : 'Added. Agent prompt updated.';
                setStatus(msg, err ? 'warn' : 'ok');
            }
            loadSettings().catch(() => {});
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setStatus('Failed: ' + msg, 'warn');
        } finally {
            flushing.value = false;
            micProcessing.value = false;
            micRuntime.value = 'idle';
            recordingArmed.value = false;
        }
    }, []);

    const abortRecording = useCallback(() => {
        userStoppingRef.current = true;
        recordingArmed.value = false;
        stopWebSpeech();
        clearRecoveryTimers();
        dispatchRecovery({ type: 'user_stop' });
        speechAlertQueue.reset();
        listening.value = false;
        listeningRef.current = false;
        chunkTranscriptRef.current = '';
        pendingBlobRef.current = null;
        clearLiveText();
        const recorder = mediaRecorderRef.current;
        if (recorder?.state === 'recording' || recorder?.state === 'paused') {
            try {
                recorder.stop();
            } catch {
                // ignore
            }
        } else if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
            stopWaveform();
        }
        micProcessing.value = false;
        micRuntime.value = 'idle';
        speechRecoveryMode.value = 'browser';
        userStoppingRef.current = false;
        setStatus('Recording cancelled.', 'ok');
    }, [clearRecoveryTimers, dispatchRecovery, stopWebSpeech]);

    const stopWaveform = useCallback(() => {
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        setActiveAnalyser(null);
    }, []);

    const startWaveform = useCallback(
        (stream: MediaStream) => {
            stopWaveform();
            const ac = new AudioContext();
            audioContextRef.current = ac;
            const source = ac.createMediaStreamSource(stream);
            const an = ac.createAnalyser();
            an.fftSize = 64;
            source.connect(an);
            analyserRef.current = an;
            setActiveAnalyser(an);
        },
        [stopWaveform]
    );

    const stopRecording = useCallback(() => {
        userStoppingRef.current = true;
        speechAlertQueue.playSessionCue('session_stop');
        listening.value = false;
        listeningRef.current = false;
        stopWebSpeech();
        clearRecoveryTimers();
        dispatchRecovery({ type: 'user_stop' });
        micRuntime.value = 'processing';
        chunkTranscriptRef.current = getLiveText();
        const recorder = mediaRecorderRef.current;
        if (recorder?.state === 'recording') {
            micProcessing.value = true;
            try {
                recorder.requestData();
            } catch {
                // ignore
            }
            recorder.stop();
        } else {
            void commitChunk();
        }
        userStoppingRef.current = false;
        speechRecoveryMode.value = 'browser';
    }, [clearRecoveryTimers, commitChunk, dispatchRecovery, stopWebSpeech]);

    stopRecordingRef.current = stopRecording;

    const startRecording = useCallback(async () => {
        if (!isMicCapableBrowser() || !navigator.mediaDevices?.getUserMedia) {
            setStatus('Microphone needs Chrome or Edge. Copy the URL above.', 'warn');
            return;
        }
        speechAlertQueue.unlock();
        resetRecoveryForNewChunk();
        recordingArmed.value = true;
        liveEditLock.value = false;
        if (document.activeElement === liveTextRef.current) {
            (liveTextRef.current as HTMLElement).blur();
        }
        chunkTranscriptRef.current = getLiveText();
        pendingBlobRef.current = null;
        if (!chunkTranscriptRef.current) setLiveText('');
        micRuntime.value = 'requesting access';

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!recordingArmed.value) {
            stream.getTracks().forEach((t) => t.stop());
            micRuntime.value = 'idle';
            return;
        }
        mediaStreamRef.current = stream;
        startWaveform(stream);

        audioChunksRef.current = [];
        activeMimeRef.current = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';
        const recorder = new MediaRecorder(stream, { mimeType: activeMimeRef.current });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data?.size) audioChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
            if (!recordingArmed.value) {
                audioChunksRef.current = [];
                pendingBlobRef.current = null;
                if (mediaStreamRef.current) {
                    mediaStreamRef.current.getTracks().forEach((t) => t.stop());
                    mediaStreamRef.current = null;
                }
                mediaRecorderRef.current = null;
                stopWaveform();
                return;
            }
            if (audioChunksRef.current.length) {
                pendingBlobRef.current = new Blob(audioChunksRef.current, { type: activeMimeRef.current });
            }
            audioChunksRef.current = [];
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((t) => t.stop());
                mediaStreamRef.current = null;
            }
            mediaRecorderRef.current = null;
            stopWaveform();
            void commitChunk();
        };

        micRuntime.value = 'warming up';
        setStatus('Warming up mic…');
        await new Promise((r) => setTimeout(r, 450));
        if (!recordingArmed.value) {
            if (recorder.state !== 'inactive') {
                try {
                    recorder.stop();
                } catch {
                    // ignore
                }
            }
            return;
        }

        recorder.start(250);
        listening.value = true;
        listeningRef.current = true;
        micRuntime.value = 'listening';
        setStatus('Listening. Tap mic to pause.');
        speechAlertQueue.playSessionCue('session_start');
        startStableWindowTimer();
        startWebSpeech();
    }, [commitChunk, resetRecoveryForNewChunk, startStableWindowTimer, startWaveform, startWebSpeech, stopWaveform]);

    const toggleMic = useCallback(async () => {
        if (listening.value) stopRecording();
        else {
            try {
                await startRecording();
            } catch {
                setStatus('Mic blocked. Allow microphone access.', 'warn');
            }
        }
    }, [startRecording, stopRecording]);

    useEffect(() => () => clearRecoveryTimers(), [clearRecoveryTimers]);

    const isMicCapable = isMicCapableBrowser() && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const showUnsupported = micSpeechBlocked.value || !isMicCapable;

    useEffect(() => {
        if (!isMicCapable && liveTextRef.current) {
            liveTextRef.current.dataset.placeholder = 'Type here (mic needs Chrome or Edge).';
        }
    }, [isMicCapable]);

    const cancellable =
        recordingArmed.value ||
        listening.value ||
        micProcessing.value ||
        micRuntime.value === 'requesting access' ||
        micRuntime.value === 'warming up' ||
        micRuntime.value === 'listening' ||
        micRuntime.value === 'processing';

    const h = health.value;
    const teacherUrl = (h?.url as string) || 'http://127.0.0.1:3721/';

    return (
        <section class="capture-col" aria-label="Voice capture">
            {showUnsupported && (
                <div class="mic-browser-hint mic-unsupported">
                    <strong>This browser cannot use voice</strong>
                    <span>
                        Cursor's built-in browser and some embedded views fail with{' '}
                        <em>Speech: network</em>. Teacher retries automatically; if problems persist, run{' '}
                        <em>Teacher: Open Web UI</em> in <strong>Chrome</strong> or <strong>Edge</strong>, then
                        bookmark the URL below.
                    </span>
                    <div class="copy-row">
                        <code>{teacherUrl}</code>
                        <button
                            type="button"
                            title="Copy Teacher URL"
                            onClick={() => copyText(teacherUrl, 'Copied Teacher URL — bookmark in Chrome or Edge.')}
                        >
                            Copy
                        </button>
                    </div>
                </div>
            )}
            {!showUnsupported && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <MicButton
                        active={listening.value}
                        processing={micProcessing.value}
                        onClick={() => {
                            toggleMic().catch(() => {});
                        }}
                    >
                        <Waveform analyser={activeAnalyser} />
                    </MicButton>
                    <button
                        type="button"
                        class="mic-cancel"
                        title="Cancel recording without adding to session"
                        disabled={!cancellable}
                        onClick={abortRecording}
                    >
                        Cancel
                    </button>
                </div>
            )}
            <div
                ref={liveTextRef}
                class="live-text empty"
                contentEditable
                spellcheck
                aria-live="polite"
                data-placeholder="Speak or type here. Pause the mic to add to session."
                onFocus={() => {
                    liveEditLock.value = true;
                }}
                onBlur={() => {
                    liveEditLock.value = false;
                    chunkTranscriptRef.current = getLiveText();
                    const el = liveTextRef.current;
                    if (el) el.classList.toggle('empty', !el.innerText.trim());
                    if (listening.value && recognitionRef.current && speechRecoveryMode.peek() === 'browser') {
                        try {
                            recognitionRef.current.start();
                        } catch {
                            // ignore
                        }
                    }
                }}
                onInput={() => {
                    chunkTranscriptRef.current = getLiveText();
                    const el = liveTextRef.current;
                    if (el) el.classList.toggle('empty', !el.innerText.trim());
                }}
                onPaste={(e) => {
                    // Always plain text only. Avoid Selection/Range APIs and path-regex
                    // ReDoS (e.g. teacher-0.1.3.vsix used to freeze the UI).
                    e.preventDefault();
                    try {
                        const el = liveTextRef.current;
                        if (!el) return;
                        const plain = e.clipboardData?.getData('text/plain') ?? '';
                        const html = e.clipboardData?.getData('text/html') ?? '';
                        const insert = resolveClipboardToPromptText(plain, html);
                        if (!insert) return;
                        const current = getLiveText();
                        const next = normalizeSpaces(current ? `${current} ${insert}` : insert);
                        el.textContent = next;
                        el.classList.toggle('empty', !next.trim());
                        chunkTranscriptRef.current = next;
                    } catch {
                        setStatus('Paste failed — try copying as plain text.', 'warn');
                    }
                }}
            />
        </section>
    );
}
