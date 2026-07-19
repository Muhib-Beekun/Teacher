import { describe, expect, it, vi } from 'vitest';
import {
    SpeechRecoveryController,
    backoffDelayMs,
    clampMaxRetries,
    canAutoFallback,
    createSpeechRecoverySnapshot,
    rollingFailureCount,
    shouldCountAsRetryFailure
} from '../../src/web-ui/speechRecovery';

describe('speechRecovery helpers', () => {
    it('clamps max retries to 3–7', () => {
        expect(clampMaxRetries(2)).toBe(3);
        expect(clampMaxRetries(4)).toBe(4);
        expect(clampMaxRetries(9)).toBe(7);
    });

    it('selects jittered backoff delays', () => {
        const delay = backoffDelayMs(0, () => 0.5);
        expect(delay).toBeGreaterThanOrEqual(240);
        expect(delay).toBeLessThanOrEqual(360);
    });

    it('identifies retry-worthy failures', () => {
        expect(shouldCountAsRetryFailure({ type: 'speech_error_network' })).toBe(true);
        expect(shouldCountAsRetryFailure({ type: 'speech_end', earlyEndWithoutResult: true })).toBe(true);
        expect(shouldCountAsRetryFailure({ type: 'speech_end' })).toBe(false);
    });

    it('respects webspeech-only auto fallback policy', () => {
        expect(canAutoFallback({ enableAutoFallback: true, sttProvider: 'auto' } as never)).toBe(true);
        expect(canAutoFallback({ enableAutoFallback: true, sttProvider: 'webspeech' } as never)).toBe(false);
        expect(canAutoFallback({ enableAutoFallback: false, sttProvider: 'auto' } as never)).toBe(false);
    });
});

describe('SpeechRecoveryController', () => {
    const baseConfig = {
        maxRetries: 4,
        enableAutoFallback: true,
        resetWindowSec: 75,
        rollingFailureThreshold: 6,
        rollingWindowMs: 180_000,
        earlyEndThresholdMs: 2_000,
        sttProvider: 'auto'
    };

    function controller(overrides: Partial<typeof baseConfig> = {}) {
        return new SpeechRecoveryController({ ...baseConfig, ...overrides }, createSpeechRecoverySnapshot(1_000));
    }

    it('increments retry counter on network errors', () => {
        const c = controller();
        c.dispatch({ type: 'user_start' }, 1_000);
        c.dispatch({ type: 'speech_start' }, 1_010);
        const actions = c.dispatch({ type: 'speech_error_network' }, 1_020);
        expect(actions.some((a) => a.type === 'schedule_retry')).toBe(true);
        expect(c.getSnapshot().consecutiveFailures).toBe(1);
    });

    it('allows auto-restart while recovering after a retryable failure', () => {
        const c = controller();
        c.dispatch({ type: 'user_start' }, 1_000);
        c.dispatch({ type: 'speech_start' }, 1_010);
        c.dispatch({ type: 'speech_error_network' }, 1_020);
        expect(c.getSnapshot().state).toBe('recovering');
        expect(c.shouldAutoRestartRecognition()).toBe(true);
    });

    it('does not count user stop as failure', () => {
        const c = controller();
        c.dispatch({ type: 'user_start' }, 1_000);
        c.dispatch({ type: 'speech_error_network' }, 1_010);
        c.dispatch({ type: 'user_stop' }, 1_020);
        expect(c.getSnapshot().consecutiveFailures).toBe(1);
        expect(c.getSnapshot().state).toBe('idle');
    });

    it('resets consecutive failures after stable window', () => {
        const c = controller({ resetWindowSec: 60 });
        c.dispatch({ type: 'user_start' }, 0);
        c.dispatch({ type: 'speech_error_network' }, 1_000);
        c.dispatch({ type: 'speech_result' }, 2_000);
        c.dispatch({ type: 'stable_window_elapsed' }, 62_000);
        expect(c.getSnapshot().consecutiveFailures).toBe(0);
    });

    it('does not fallback before retry budget is exhausted', () => {
        const c = controller({ maxRetries: 4 });
        c.dispatch({ type: 'user_start' }, 0);
        for (let i = 0; i < 3; i++) {
            const actions = c.dispatch({ type: 'speech_error_network' }, 1_000 + i);
            expect(actions.some((a) => a.type === 'evaluate_fallback')).toBe(false);
            expect(actions.some((a) => a.type === 'schedule_retry')).toBe(true);
        }
        expect(c.getSnapshot().mode).toBe('browser');
    });

    it('evaluates fallback after max retries', () => {
        const c = controller({ maxRetries: 4 });
        c.dispatch({ type: 'user_start' }, 0);
        let actions: ReturnType<typeof c.dispatch> = [];
        for (let i = 0; i < 4; i++) {
            actions = c.dispatch({ type: 'speech_error_network' }, 1_000 + i);
        }
        expect(actions.some((a) => a.type === 'evaluate_fallback')).toBe(true);
    });

    it('finalizes provider fallback when health reports whisper', () => {
        const c = controller();
        c.dispatch({ type: 'user_start' }, 0);
        for (let i = 0; i < 4; i++) {
            c.dispatch({ type: 'speech_error_network' }, 1_000 + i);
        }
        const actions = c.finalizeFallback('whisper', 5_000, 'network', 'consecutive');
        expect(actions.some((a) => a.type === 'fallback_provider')).toBe(true);
        expect(c.getSnapshot().mode).toBe('provider');
    });

    it('falls back to degraded when no provider is available', () => {
        const c = controller();
        c.dispatch({ type: 'user_start' }, 0);
        for (let i = 0; i < 4; i++) {
            c.dispatch({ type: 'speech_error_network' }, 1_000 + i);
        }
        const actions = c.finalizeFallback('webspeech', 5_000, 'network', 'consecutive');
        expect(actions.some((a) => a.type === 'fallback_degraded')).toBe(true);
        expect(c.getSnapshot().mode).toBe('degraded');
    });

    it('recovers successfully after retry without fallback', () => {
        const c = controller();
        c.dispatch({ type: 'user_start' }, 0);
        c.dispatch({ type: 'speech_start' }, 10);
        c.dispatch({ type: 'speech_error_network' }, 20);
        c.dispatch({ type: 'speech_start' }, 400);
        const actions = c.dispatch({ type: 'speech_result' }, 500);
        expect(actions.some((a) => a.type === 'trace' && a.payload.event === 'speech_recovery_success')).toBe(true);
        expect(c.getSnapshot().consecutiveFailures).toBe(0);
        expect(c.getSnapshot().mode).toBe('browser');
    });

    it('triggers rolling failure fallback before max retries', () => {
        const c = controller({ maxRetries: 4, rollingFailureThreshold: 6 });
        c.dispatch({ type: 'user_start' }, 0);
        let actions: ReturnType<typeof c.dispatch> = [];
        for (let i = 0; i < 6; i++) {
            actions = c.dispatch({ type: 'speech_error_network' }, 1_000 + i * 100);
        }
        expect(actions.some((a) => a.type === 'evaluate_fallback')).toBe(true);
        expect(rollingFailureCount(c.getSnapshot().failureTimestamps, 2_000, 180_000)).toBe(6);
    });

    it('stays degraded when auto fallback is disabled', () => {
        const c = controller({ enableAutoFallback: false, maxRetries: 2 });
        c.dispatch({ type: 'user_start' }, 0);
        c.dispatch({ type: 'speech_error_network' }, 10);
        c.dispatch({ type: 'speech_error_network' }, 20);
        const actions = c.finalizeFallback('whisper', 30, 'network', 'consecutive');
        expect(actions.some((a) => a.type === 'fallback_degraded')).toBe(true);
        expect(actions.some((a) => a.type === 'fallback_provider')).toBe(false);
    });
});

describe('speechRecovery integration sequences', () => {
    it('simulates repeated network errors then recovery success', () => {
        const c = new SpeechRecoveryController({
            maxRetries: 4,
            enableAutoFallback: true,
            resetWindowSec: 75,
            rollingFailureThreshold: 6,
            rollingWindowMs: 180_000,
            earlyEndThresholdMs: 2_000,
            sttProvider: 'auto'
        });
        c.dispatch({ type: 'user_start' }, 0);
        c.dispatch({ type: 'speech_start' }, 10);
        c.dispatch({ type: 'speech_error_network' }, 100);
        c.dispatch({ type: 'speech_start' }, 500);
        c.dispatch({ type: 'speech_error_network' }, 600);
        c.dispatch({ type: 'speech_start' }, 1_500);
        const ok = c.dispatch({ type: 'speech_result' }, 1_700);
        expect(c.getSnapshot().mode).toBe('browser');
        expect(ok.some((a) => a.type === 'trace' && a.payload.event === 'speech_recovery_success')).toBe(true);
    });

    it('simulates repeated failures then provider fallback', () => {
        const c = new SpeechRecoveryController({
            maxRetries: 3,
            enableAutoFallback: true,
            resetWindowSec: 75,
            rollingFailureThreshold: 6,
            rollingWindowMs: 180_000,
            earlyEndThresholdMs: 2_000,
            sttProvider: 'auto'
        });
        c.dispatch({ type: 'user_start' }, 0);
        for (let i = 0; i < 3; i++) {
            c.dispatch({ type: 'speech_error_network' }, 100 + i);
        }
        const actions = c.finalizeFallback('deepgram', 500, 'network', 'consecutive');
        expect(actions.some((a) => a.type === 'fallback_provider')).toBe(true);
        expect(c.shouldUseAudioFallback()).toBe(true);
    });
});
