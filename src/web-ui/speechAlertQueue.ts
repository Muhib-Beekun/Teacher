import { appSettings } from './state';

export type SpeechAlertKind = 'retry' | 'recovered' | 'fallback_provider' | 'fallback_degraded';

export interface SpeechAlertQueueConfig {
    enabled: boolean;
    volume: number;
    onlyWhenHidden: boolean;
    minIntervalMs: number;
    maxQueueSize: number;
}

export const DEFAULT_SPEECH_ALERT_CONFIG: SpeechAlertQueueConfig = {
    enabled: true,
    volume: 0.35,
    onlyWhenHidden: false,
    minIntervalMs: 2_000,
    maxQueueSize: 3
};

const FALLBACK_ALERTS = new Set<SpeechAlertKind>(['fallback_provider', 'fallback_degraded']);

export function readSpeechAlertConfig(): SpeechAlertQueueConfig {
    const s = appSettings.peek();
    return {
        ...DEFAULT_SPEECH_ALERT_CONFIG,
        enabled: s?.browserRecoveryAudibleAlerts ?? true,
        volume: clampVolume(s?.browserRecoveryAlertVolume ?? DEFAULT_SPEECH_ALERT_CONFIG.volume),
        onlyWhenHidden: s?.browserRecoveryAlertsOnlyWhenHidden ?? false
    };
}

export function clampVolume(value: number): number {
    if (!Number.isFinite(value)) {
        return DEFAULT_SPEECH_ALERT_CONFIG.volume;
    }
    return Math.max(0, Math.min(1, value));
}

export function shouldPlayAlert(
    kind: SpeechAlertKind,
    config: SpeechAlertQueueConfig,
    documentHidden: boolean
): boolean {
    if (!config.enabled) {
        return false;
    }
    if (FALLBACK_ALERTS.has(kind)) {
        return true;
    }
    if (config.onlyWhenHidden && !documentHidden) {
        return false;
    }
    return true;
}

export function coalesceAlertQueue(queue: SpeechAlertKind[], incoming: SpeechAlertKind): SpeechAlertKind[] {
    if (FALLBACK_ALERTS.has(incoming)) {
        return [incoming];
    }
    if (incoming === 'recovered') {
        return queue.filter((k) => k !== 'retry').concat(incoming);
    }
    const next = queue.concat(incoming);
    while (next.length > DEFAULT_SPEECH_ALERT_CONFIG.maxQueueSize) {
        next.shift();
    }
    return next;
}

export function shouldRateLimit(
    kind: SpeechAlertKind,
    lastKind: SpeechAlertKind | null,
    lastPlayedAt: number,
    now: number,
    minIntervalMs: number
): boolean {
    if (FALLBACK_ALERTS.has(kind) || kind === 'recovered') {
        return false;
    }
    return kind === lastKind && now - lastPlayedAt < minIntervalMs;
}

export type ToneStep = { frequency: number; durationMs: number; gapMs?: number };

export const ALERT_TONE_PROFILES: Record<SpeechAlertKind, ToneStep[]> = {
    retry: [{ frequency: 440, durationMs: 70 }],
    recovered: [
        { frequency: 523, durationMs: 70, gapMs: 30 },
        { frequency: 784, durationMs: 90 }
    ],
    fallback_provider: [
        { frequency: 620, durationMs: 100, gapMs: 40 },
        { frequency: 420, durationMs: 120 }
    ],
    fallback_degraded: [{ frequency: 280, durationMs: 180 }]
};

export async function playAlertTone(
    kind: SpeechAlertKind,
    volume: number,
    audioContext: AudioContext
): Promise<void> {
    const steps = ALERT_TONE_PROFILES[kind];
    const gainValue = clampVolume(volume);
    if (gainValue <= 0) {
        return;
    }
    for (const step of steps) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = step.frequency;
        gain.gain.value = gainValue;
        osc.connect(gain);
        gain.connect(audioContext.destination);
        const startAt = audioContext.currentTime;
        osc.start(startAt);
        osc.stop(startAt + step.durationMs / 1000);
        await sleep(step.durationMs + (step.gapMs ?? 0));
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SpeechAlertQueue {
    private queue: SpeechAlertKind[] = [];
    private playing = false;
    private unlocked = false;
    private lastPlayedAt = 0;
    private lastKind: SpeechAlertKind | null = null;
    private audioContext: AudioContext | null = null;

    public constructor(
        private readonly playTone: (
            kind: SpeechAlertKind,
            volume: number,
            audioContext: AudioContext
        ) => Promise<void> = playAlertTone,
        private readonly now: () => number = Date.now,
        private readonly isHidden: () => boolean = () =>
            typeof document !== 'undefined' ? document.hidden : false
    ) {}

    public unlock(): void {
        this.unlocked = true;
        if (!this.audioContext && typeof AudioContext !== 'undefined') {
            this.audioContext = new AudioContext();
        }
        void this.audioContext?.resume();
        void this.flush(readSpeechAlertConfig());
    }

    public enqueue(kind: SpeechAlertKind, config: SpeechAlertQueueConfig = readSpeechAlertConfig()): void {
        if (!shouldPlayAlert(kind, config, this.isHidden())) {
            return;
        }
        this.queue = coalesceAlertQueue(this.queue, kind);
        void this.flush(config);
    }

    public peekQueue(): SpeechAlertKind[] {
        return [...this.queue];
    }

    public reset(): void {
        this.queue = [];
        this.playing = false;
        this.lastKind = null;
        this.lastPlayedAt = 0;
    }

    private async flush(config: SpeechAlertQueueConfig): Promise<void> {
        if (this.playing || !this.unlocked) {
            return;
        }
        const kind = this.queue.shift();
        if (!kind) {
            return;
        }
        const now = this.now();
        if (shouldRateLimit(kind, this.lastKind, this.lastPlayedAt, now, config.minIntervalMs)) {
            void this.flush(config);
            return;
        }
        if (!shouldPlayAlert(kind, config, this.isHidden())) {
            void this.flush(config);
            return;
        }
        this.playing = true;
        try {
            if (!this.audioContext && typeof AudioContext !== 'undefined') {
                this.audioContext = new AudioContext();
            }
            if (this.audioContext) {
                await this.audioContext.resume();
            }
            await this.playTone(kind, config.volume, this.audioContext ?? ({} as AudioContext));
            this.lastPlayedAt = now;
            this.lastKind = kind;
        } catch {
            // Autoplay or audio failures should never break capture.
        } finally {
            this.playing = false;
            if (this.queue.length) {
                void this.flush(config);
            }
        }
    }
}

export const speechAlertQueue = new SpeechAlertQueue();

export function alertForRecoveryAction(action: RecoveryActionLike): SpeechAlertKind | null {
    if (action.type === 'schedule_retry') {
        return 'retry';
    }
    if (action.type === 'trace' && action.payload?.event === 'speech_recovery_success') {
        return 'recovered';
    }
    if (action.type === 'fallback_provider') {
        return 'fallback_provider';
    }
    if (action.type === 'fallback_degraded') {
        return 'fallback_degraded';
    }
    return null;
}

export interface RecoveryActionLike {
    type: string;
    payload?: { event?: string };
}
