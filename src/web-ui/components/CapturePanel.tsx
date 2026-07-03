import { useRef, useEffect, useCallback, useState } from 'preact/hooks';
import {
    listening, flushing, micRuntime, recordingArmed, liveEditLock,
    micSpeechBlocked, micProcessing, health, setStatus, applySession
} from '../state';
import { addSegment, addAudio, loadSettings, copyText } from '../api';
import { MicButton } from './MicButton';
import { Waveform } from './Waveform';

const UNSUPPORTED_SPEECH_ERRORS = new Set(['network', 'service-not-allowed', 'audio-capture']);

function isMicCapableBrowser(): boolean {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return true;
    if (/Chrome\//.test(ua) && !/OPR\//.test(ua) && !/SamsungBrowser\//.test(ua)) return true;
    return false;
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

    const stopWaveform = useCallback(() => {
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        setActiveAnalyser(null);
    }, []);

    const startWaveform = useCallback((stream: MediaStream) => {
        stopWaveform();
        const ac = new AudioContext();
        audioContextRef.current = ac;
        const source = ac.createMediaStreamSource(stream);
        const an = ac.createAnalyser();
        an.fftSize = 64;
        source.connect(an);
        analyserRef.current = an;
        setActiveAnalyser(an);
    }, [stopWaveform]);

    const showMicUnsupported = useCallback(() => {
        micSpeechBlocked.value = true;
    }, []);

    const startWebSpeech = useCallback(() => {
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
                if (finalText) {
                    chunkTranscriptRef.current = appendSpeechChunk(chunkTranscriptRef.current, finalText);
                    setLiveTextFromSpeech(chunkTranscriptRef.current);
                } else if (interim) {
                    setLiveTextFromSpeech(appendSpeechChunk(chunkTranscriptRef.current, interim));
                }
            };
            rec.onerror = (e: SpeechRecognitionErrorEvent) => {
                if (e.error === 'no-speech' || e.error === 'aborted') return;
                if (UNSUPPORTED_SPEECH_ERRORS.has(e.error)) {
                    showMicUnsupported();
                    if (listening.value) stopRecording();
                    setStatus('Voice not supported in this browser. Open in Chrome or Edge.', 'warn');
                    return;
                }
                setStatus('Speech: ' + e.error, 'warn');
            };
            rec.onend = () => {
                if (listening.value) try { rec.start(); } catch {}
            };
            recognitionRef.current = rec;
        }
        try { recognitionRef.current.start(); } catch {}
    }, []);

    const stopWebSpeech = useCallback(() => {
        if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
    }, []);

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
            const useAudio = blob && blob.size > 0 && health.peek().stt && health.peek().stt !== 'webspeech';
            let json: Record<string, unknown>;
            if (useAudio) {
                json = await addAudio(blob!, blob!.type || activeMimeRef.current);
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
        }
    }, []);

    const abortRecording = useCallback(() => {
        recordingArmed.value = false;
        stopWebSpeech();
        listening.value = false;
        chunkTranscriptRef.current = '';
        pendingBlobRef.current = null;
        clearLiveText();
        const recorder = mediaRecorderRef.current;
        if (recorder?.state === 'recording' || recorder?.state === 'paused') {
            try { recorder.stop(); } catch {}
        } else if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
            stopWaveform();
        }
        micProcessing.value = false;
        micRuntime.value = 'idle';
        setStatus('Recording cancelled.', 'ok');
    }, [stopWebSpeech, stopWaveform]);

    const stopRecording = useCallback(() => {
        listening.value = false;
        stopWebSpeech();
        micRuntime.value = 'processing';
        chunkTranscriptRef.current = getLiveText();
        const recorder = mediaRecorderRef.current;
        if (recorder?.state === 'recording') {
            micProcessing.value = true;
            try { recorder.requestData(); } catch {}
            recorder.stop();
        } else {
            void commitChunk();
        }
    }, [stopWebSpeech, commitChunk]);

    const startRecording = useCallback(async () => {
        if (!isMicCapableBrowser() || !navigator.mediaDevices?.getUserMedia) {
            setStatus('Microphone needs Chrome or Edge. Copy the URL above.', 'warn');
            return;
        }
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
            stream.getTracks().forEach(t => t.stop());
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
                    mediaStreamRef.current.getTracks().forEach(t => t.stop());
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
                mediaStreamRef.current.getTracks().forEach(t => t.stop());
                mediaStreamRef.current = null;
            }
            mediaRecorderRef.current = null;
            stopWaveform();
            void commitChunk();
        };

        micRuntime.value = 'warming up';
        setStatus('Warming up mic…');
        await new Promise(r => setTimeout(r, 450));
        if (!recordingArmed.value) {
            if (recorder.state !== 'inactive') try { recorder.stop(); } catch {}
            return;
        }

        recorder.start(250);
        listening.value = true;
        micRuntime.value = 'listening';
        setStatus('Listening. Tap mic to pause.');
        startWebSpeech();
    }, [startWaveform, stopWaveform, startWebSpeech, commitChunk]);

    const toggleMic = useCallback(async () => {
        if (listening.value) stopRecording();
        else {
            try { await startRecording(); }
            catch { setStatus('Mic blocked. Allow microphone access.', 'warn'); }
        }
    }, [startRecording, stopRecording]);

    const isMicCapable = isMicCapableBrowser() && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const showUnsupported = micSpeechBlocked.value || !isMicCapable;

    useEffect(() => {
        if (!isMicCapable && liveTextRef.current) {
            liveTextRef.current.dataset.placeholder = 'Type here (mic needs Chrome or Edge).';
        }
    }, [isMicCapable]);

    const cancellable = recordingArmed.value || listening.value || micProcessing.value
        || micRuntime.value === 'requesting access'
        || micRuntime.value === 'warming up'
        || micRuntime.value === 'listening'
        || micRuntime.value === 'processing';

    const h = health.value;
    const teacherUrl = (h?.url as string) || 'http://127.0.0.1:3721/';

    return (
        <section class="capture-col" aria-label="Voice capture">
            {showUnsupported && (
                <div class="mic-browser-hint mic-unsupported">
                    <strong>This browser cannot use voice</strong>
                    <span>
                        Cursor's built-in browser and some embedded views fail with{' '}
                        <em>Speech: network</em>. Run <em>Teacher: Open Web UI</em> in{' '}
                        <strong>Chrome</strong> or <strong>Edge</strong> instead, then bookmark
                        the URL below.
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
                        onClick={() => { toggleMic().catch(() => {}); }}
                    />
                    <button
                        type="button"
                        class="mic-cancel"
                        title="Cancel recording without adding to session"
                        disabled={!cancellable}
                        onClick={abortRecording}
                    >
                        Cancel
                    </button>
                    <Waveform analyser={activeAnalyser} />
                </div>
            )}
            <div
                ref={liveTextRef}
                class="live-text empty"
                contentEditable
                spellcheck
                aria-live="polite"
                data-placeholder="Speak or type here. Pause the mic to add to session."
                onFocus={() => { liveEditLock.value = true; }}
                onBlur={() => {
                    liveEditLock.value = false;
                    chunkTranscriptRef.current = getLiveText();
                    const el = liveTextRef.current;
                    if (el) el.classList.toggle('empty', !el.innerText.trim());
                    if (listening.value && recognitionRef.current) {
                        try { recognitionRef.current.start(); } catch {}
                    }
                }}
                onInput={() => {
                    chunkTranscriptRef.current = getLiveText();
                    const el = liveTextRef.current;
                    if (el) el.classList.toggle('empty', !el.innerText.trim());
                }}
            />
        </section>
    );
}
