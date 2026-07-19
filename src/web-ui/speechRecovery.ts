export type SpeechRecoveryState = 'idle' | 'listening' | 'degraded' | 'recovering' | 'failedover';

export type SpeechRecoveryMode = 'browser' | 'provider' | 'degraded';

export type SpeechRecoveryEvent =
    | { type: 'user_start' }
    | { type: 'user_stop' }
    | { type: 'speech_start' }
    | { type: 'speech_result' }
    | { type: 'speech_end'; earlyEndWithoutResult?: boolean }
    | { type: 'speech_error_network' }
    | { type: 'speech_error_other'; error: string }
    | { type: 'stable_window_elapsed' }
    | { type: 'retry_timer_fired' };

export interface BrowserRecoveryConfig {
    maxRetries: number;
    enableAutoFallback: boolean;
    resetWindowSec: number;
    rollingFailureThreshold: number;
    rollingWindowMs: number;
    earlyEndThresholdMs: number;
    sttProvider: string;
}

export const DEFAULT_BROWSER_RECOVERY_CONFIG: BrowserRecoveryConfig = {
    maxRetries: 4,
    enableAutoFallback: true,
    resetWindowSec: 75,
    rollingFailureThreshold: 6,
    rollingWindowMs: 180_000,
    earlyEndThresholdMs: 2_000,
    sttProvider: 'auto'
};

export const BACKOFF_MS = [300, 900, 2_000, 4_000, 8_000] as const;

export type SpeechTraceEventType =
    | 'speech_recovery_attempt'
    | 'speech_recovery_success'
    | 'speech_fallback_triggered'
    | 'speech_fallback_unavailable';

export interface SpeechTracePayload {
    event: SpeechTraceEventType;
    attempt?: number;
    maxRetries?: number;
    errorClass?: string;
    delayMs?: number;
    fallback?: 'whisper' | 'deepgram' | 'degraded' | 'none';
    elapsedSessionMs?: number;
    consecutiveFailures?: number;
    rollingFailures?: number;
}

export type RecoveryAction =
    | { type: 'trace'; payload: SpeechTracePayload }
    | { type: 'status'; message: string; kind?: 'ok' | 'warn' }
    | { type: 'schedule_retry'; delayMs: number; attempt: number; maxRetries: number }
    | { type: 'fallback_provider'; provider: 'whisper' | 'deepgram' }
    | { type: 'fallback_degraded' }
    | { type: 'resume_listening' }
    | { type: 'evaluate_fallback'; errorClass: string; reason: 'consecutive' | 'rolling' };

export interface SpeechRecoverySnapshot {
    state: SpeechRecoveryState;
    mode: SpeechRecoveryMode;
    consecutiveFailures: number;
    pendingAttempt: number;
    sessionStartedAt: number;
    speechStartedAt: number;
    hadResultSinceSpeechStart: boolean;
    failureTimestamps: number[];
    stableSince: number | null;
}

export function clampMaxRetries(value: number): number {
    if (!Number.isFinite(value)) {
        return DEFAULT_BROWSER_RECOVERY_CONFIG.maxRetries;
    }
    return Math.max(3, Math.min(7, Math.round(value)));
}

export function backoffDelayMs(attemptIndex: number, random = Math.random): number {
    const base = BACKOFF_MS[Math.min(Math.max(attemptIndex, 0), BACKOFF_MS.length - 1)];
    const jitter = 0.8 + random() * 0.4;
    return Math.round(base * jitter);
}

export function pruneFailureTimestamps(timestamps: number[], now: number, windowMs: number): number[] {
    const cutoff = now - windowMs;
    return timestamps.filter((ts) => ts >= cutoff);
}

export function rollingFailureCount(timestamps: number[], now: number, windowMs: number): number {
    return pruneFailureTimestamps(timestamps, now, windowMs).length;
}

export function shouldCountAsRetryFailure(event: SpeechRecoveryEvent): boolean {
    return event.type === 'speech_error_network' || (event.type === 'speech_end' && !!event.earlyEndWithoutResult);
}

export function canAutoFallback(config: BrowserRecoveryConfig): boolean {
    if (!config.enableAutoFallback) {
        return false;
    }
    return config.sttProvider !== 'webspeech';
}

export function createSpeechRecoverySnapshot(now = Date.now()): SpeechRecoverySnapshot {
    return {
        state: 'idle',
        mode: 'browser',
        consecutiveFailures: 0,
        pendingAttempt: 0,
        sessionStartedAt: now,
        speechStartedAt: 0,
        hadResultSinceSpeechStart: false,
        failureTimestamps: [],
        stableSince: null
    };
}

export class SpeechRecoveryController {
    private snapshot: SpeechRecoverySnapshot;

    public constructor(
        private config: BrowserRecoveryConfig,
        snapshot?: SpeechRecoverySnapshot
    ) {
        this.snapshot = snapshot ?? createSpeechRecoverySnapshot();
        this.config.maxRetries = clampMaxRetries(this.config.maxRetries);
    }

    public getSnapshot(): SpeechRecoverySnapshot {
        return { ...this.snapshot, failureTimestamps: [...this.snapshot.failureTimestamps] };
    }

    public updateConfig(config: Partial<BrowserRecoveryConfig>): void {
        this.config = { ...this.config, ...config };
        this.config.maxRetries = clampMaxRetries(this.config.maxRetries);
    }

    public dispatch(event: SpeechRecoveryEvent, now = Date.now()): RecoveryAction[] {
        const actions: RecoveryAction[] = [];
        const snap = this.snapshot;

        switch (event.type) {
            case 'user_start':
                snap.sessionStartedAt = now;
                snap.state = 'listening';
                if (snap.mode === 'browser') {
                    snap.stableSince = now;
                }
                break;

            case 'user_stop':
                snap.state = 'idle';
                snap.pendingAttempt = 0;
                snap.speechStartedAt = 0;
                snap.hadResultSinceSpeechStart = false;
                break;

            case 'speech_start':
                snap.speechStartedAt = now;
                snap.hadResultSinceSpeechStart = false;
                if (snap.state === 'recovering') {
                    snap.state = 'listening';
                } else if (snap.state !== 'failedover' && snap.state !== 'degraded') {
                    snap.state = 'listening';
                }
                break;

            case 'speech_result': {
                snap.hadResultSinceSpeechStart = true;
                snap.stableSince = now;
                if (snap.pendingAttempt > 0) {
                    const recoveredAttempt = snap.pendingAttempt;
                    snap.state = 'listening';
                    snap.consecutiveFailures = 0;
                    snap.pendingAttempt = 0;
                    snap.failureTimestamps = [];
                    actions.push({
                        type: 'trace',
                        payload: this.tracePayload('speech_recovery_success', now, {
                            attempt: recoveredAttempt,
                            errorClass: 'network'
                        })
                    });
                    actions.push({ type: 'resume_listening' });
                    actions.push({
                        type: 'status',
                        message: `Recovered (attempt ${recoveredAttempt}/${clampMaxRetries(this.config.maxRetries)})`,
                        kind: 'ok'
                    });
                } else if (snap.state === 'listening') {
                    snap.consecutiveFailures = 0;
                }
                break;
            }

            case 'speech_end': {
                if (snap.state === 'idle' || snap.mode !== 'browser') {
                    break;
                }
                const elapsed = snap.speechStartedAt ? now - snap.speechStartedAt : 0;
                const earlyEnd =
                    !!event.earlyEndWithoutResult ||
                    (snap.speechStartedAt > 0 &&
                        !snap.hadResultSinceSpeechStart &&
                        elapsed > 0 &&
                        elapsed < this.config.earlyEndThresholdMs);
                if (earlyEnd) {
                    actions.push(...this.handleRetryableFailure(now, 'early_end'));
                }
                break;
            }

            case 'speech_error_network':
                if (snap.mode !== 'browser') {
                    break;
                }
                actions.push(...this.handleRetryableFailure(now, 'network'));
                break;

            case 'speech_error_other':
                actions.push({
                    type: 'status',
                    message: `Speech: ${event.error}`,
                    kind: 'warn'
                });
                break;

            case 'stable_window_elapsed':
                if (
                    snap.stableSince &&
                    now - snap.stableSince >= this.config.resetWindowSec * 1000 &&
                    snap.consecutiveFailures > 0
                ) {
                    snap.consecutiveFailures = 0;
                    snap.pendingAttempt = 0;
                    snap.failureTimestamps = [];
                }
                break;

            case 'retry_timer_fired':
                break;

            default:
                break;
        }

        return actions;
    }

    public shouldAutoRestartRecognition(): boolean {
        const { state, mode } = this.snapshot;
        if (mode !== 'browser') {
            return false;
        }
        // Retries set state to `recovering` until speech_start/result — must allow restart
        // while recovering or the retry timer hangs after the alert tone (~1/4 sessions).
        return state === 'listening' || state === 'recovering';
    }

    public shouldUseAudioFallback(): boolean {
        return this.snapshot.mode === 'provider';
    }

    public isDegradedPushToTalk(): boolean {
        return this.snapshot.mode === 'degraded';
    }

    public finalizeFallback(
        healthStt: string | undefined,
        now: number,
        errorClass: string,
        reason: 'consecutive' | 'rolling'
    ): RecoveryAction[] {
        return this.triggerFallbackWithHealth(now, errorClass, healthStt, reason);
    }

    private triggerFallbackWithHealth(
        now: number,
        errorClass: string,
        healthStt: string | undefined,
        reason: 'consecutive' | 'rolling'
    ): RecoveryAction[] {
        const snap = this.snapshot;
        if (canAutoFallback(this.config)) {
            const provider = this.resolveFallbackFromHealth(healthStt);
            if (provider) {
                snap.state = 'failedover';
                snap.mode = 'provider';
                snap.pendingAttempt = 0;
                return [
                    {
                        type: 'trace',
                        payload: this.tracePayload('speech_fallback_triggered', now, {
                            errorClass,
                            fallback: provider,
                            consecutiveFailures: snap.consecutiveFailures,
                            rollingFailures: snap.failureTimestamps.length
                        })
                    },
                    { type: 'fallback_provider', provider },
                    {
                        type: 'status',
                        message: `Browser speech unstable; switching to ${provider === 'whisper' ? 'Whisper' : 'Deepgram'}.`,
                        kind: 'warn'
                    }
                ];
            }
        }
        return this.enterDegraded(now, errorClass, reason);
    }

    private handleRetryableFailure(now: number, errorClass: string): RecoveryAction[] {
        const snap = this.snapshot;
        if (snap.mode !== 'browser') {
            return [];
        }

        snap.failureTimestamps = pruneFailureTimestamps(
            [...snap.failureTimestamps, now],
            now,
            this.config.rollingWindowMs
        );
        snap.consecutiveFailures += 1;
        const rolling = snap.failureTimestamps.length;

        const maxRetries = clampMaxRetries(this.config.maxRetries);
        const rollingTriggered = rolling >= this.config.rollingFailureThreshold;
        const retriesExhausted = snap.consecutiveFailures >= maxRetries;

        if (retriesExhausted || rollingTriggered) {
            return [
                {
                    type: 'evaluate_fallback',
                    errorClass,
                    reason: rollingTriggered ? 'rolling' : 'consecutive'
                }
            ];
        }

        snap.pendingAttempt = snap.consecutiveFailures;
        snap.state = 'recovering';
        const delayMs = backoffDelayMs(snap.consecutiveFailures - 1);
        return [
            {
                type: 'trace',
                payload: this.tracePayload('speech_recovery_attempt', now, {
                    attempt: snap.pendingAttempt,
                    maxRetries,
                    errorClass,
                    delayMs,
                    consecutiveFailures: snap.consecutiveFailures,
                    rollingFailures: rolling
                })
            },
            {
                type: 'schedule_retry',
                delayMs,
                attempt: snap.pendingAttempt,
                maxRetries
            },
            {
                type: 'status',
                message: `Browser speech hiccup — retrying (${snap.pendingAttempt}/${maxRetries})…`,
                kind: 'warn'
            }
        ];
    }

    private enterDegraded(now: number, errorClass: string, reason: 'consecutive' | 'rolling'): RecoveryAction[] {
        const snap = this.snapshot;
        snap.state = 'degraded';
        snap.mode = 'degraded';
        snap.pendingAttempt = 0;
        const reasonHint = reason === 'rolling' ? ' (frequent errors)' : '';
        return [
            {
                type: 'trace',
                payload: this.tracePayload(
                    canAutoFallback(this.config) ? 'speech_fallback_unavailable' : 'speech_fallback_triggered',
                    now,
                    {
                        errorClass,
                        fallback: 'degraded',
                        consecutiveFailures: snap.consecutiveFailures,
                        rollingFailures: snap.failureTimestamps.length
                    }
                )
            },
            { type: 'fallback_degraded' },
            {
                type: 'status',
                message: canAutoFallback(this.config)
                    ? `No fallback STT provider configured; staying in push-to-talk mode${reasonHint}.`
                    : `Browser speech unstable; staying in push-to-talk mode${reasonHint}.`,
                kind: 'warn'
            }
        ];
    }

    public resolveFallbackFromHealth(healthStt: string | undefined): 'whisper' | 'deepgram' | null {
        if (healthStt === 'whisper' || healthStt === 'deepgram') {
            return healthStt;
        }
        if (this.config.sttProvider === 'whisper' || this.config.sttProvider === 'deepgram') {
            return this.config.sttProvider;
        }
        return null;
    }

    private tracePayload(
        event: SpeechTraceEventType,
        now: number,
        extra: Partial<SpeechTracePayload> = {}
    ): SpeechTracePayload {
        return {
            event,
            maxRetries: clampMaxRetries(this.config.maxRetries),
            elapsedSessionMs: now - this.snapshot.sessionStartedAt,
            consecutiveFailures: this.snapshot.consecutiveFailures,
            rollingFailures: this.snapshot.failureTimestamps.length,
            ...extra
        };
    }
}
