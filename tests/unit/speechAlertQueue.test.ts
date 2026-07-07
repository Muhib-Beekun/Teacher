import { describe, expect, it, vi } from 'vitest';
import {
    SpeechAlertQueue,
    alertForRecoveryAction,
    clampVolume,
    coalesceAlertQueue,
    shouldPlayAlert,
    shouldRateLimit
} from '../../src/web-ui/speechAlertQueue';

describe('speechAlertQueue helpers', () => {
    it('maps recovery actions to alert kinds', () => {
        expect(alertForRecoveryAction({ type: 'schedule_retry' })).toBe('retry');
        expect(
            alertForRecoveryAction({ type: 'trace', payload: { event: 'speech_recovery_success' } })
        ).toBe('recovered');
        expect(alertForRecoveryAction({ type: 'fallback_provider' })).toBe('fallback_provider');
        expect(alertForRecoveryAction({ type: 'fallback_degraded' })).toBe('fallback_degraded');
        expect(alertForRecoveryAction({ type: 'status' })).toBeNull();
    });

    it('coalesces fallback alerts over pending retries', () => {
        expect(coalesceAlertQueue(['retry', 'retry'], 'fallback_provider')).toEqual(['fallback_provider']);
    });

    it('drops pending retries when recovered', () => {
        expect(coalesceAlertQueue(['retry'], 'recovered')).toEqual(['recovered']);
    });

    it('rate-limits repeated retry tones', () => {
        expect(shouldRateLimit('retry', 'retry', 1_000, 2_000, 2_000)).toBe(true);
        expect(shouldRateLimit('fallback_provider', 'retry', 1_000, 1_500, 2_000)).toBe(false);
    });

    it('always allows fallback alerts even when onlyWhenHidden', () => {
        const config = {
            enabled: true,
            volume: 0.35,
            onlyWhenHidden: true,
            minIntervalMs: 2_000,
            maxQueueSize: 3
        };
        expect(shouldPlayAlert('retry', config, false)).toBe(false);
        expect(shouldPlayAlert('fallback_degraded', config, false)).toBe(true);
    });

    it('clamps alert volume', () => {
        expect(clampVolume(1.5)).toBe(1);
        expect(clampVolume(-1)).toBe(0);
    });
});

describe('SpeechAlertQueue', () => {
    it('plays alerts in order after unlock', async () => {
        const played: string[] = [];
        const queue = new SpeechAlertQueue(
            async (kind) => {
                played.push(kind);
            },
            () => 0,
            () => false
        );
        const config = {
            enabled: true,
            volume: 0.35,
            onlyWhenHidden: false,
            minIntervalMs: 0,
            maxQueueSize: 3
        };
        queue.enqueue('retry', config);
        expect(played).toEqual([]);
        queue.unlock();
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
        expect(played).toEqual(['retry']);
    });

    it('replaces queued retries with fallback alert', async () => {
        const played: string[] = [];
        const queue = new SpeechAlertQueue(
            async (kind) => {
                played.push(kind);
            },
            () => 0,
            () => false
        );
        const config = {
            enabled: true,
            volume: 0.35,
            onlyWhenHidden: false,
            minIntervalMs: 0,
            maxQueueSize: 3
        };
        queue.enqueue('retry', config);
        queue.enqueue('retry', config);
        queue.enqueue('fallback_provider', config);
        queue.unlock();
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => setTimeout(r, 0));
        expect(queue.peekQueue()).toEqual([]);
        expect(played).toEqual(['fallback_provider']);
    });

    it('skips alerts when disabled', async () => {
        const playTone = vi.fn();
        const queue = new SpeechAlertQueue(playTone, () => 0, () => false);
        queue.unlock();
        queue.enqueue('retry', {
            enabled: false,
            volume: 0.35,
            onlyWhenHidden: false,
            minIntervalMs: 0,
            maxQueueSize: 3
        });
        await new Promise((r) => setTimeout(r, 0));
        expect(playTone).not.toHaveBeenCalled();
    });
});
