import { describe, expect, it } from 'vitest';
import {
    MAX_DISPATCH_TEXT_BYTES,
    buildRelayDispatchText,
    isDispatchMode,
    resolveDispatchPayload
} from '../../src/web/dispatchPacket';

describe('dispatchPacket', () => {
    it('recognizes dispatch modes', () => {
        expect(isDispatchMode('raw')).toBe(true);
        expect(isDispatchMode('relay')).toBe(true);
        expect(isDispatchMode('handoff')).toBe(true);
        expect(isDispatchMode('compile')).toBe(false);
    });

    it('builds a deterministic relay template from meta (no LLM fields)', () => {
        const text = buildRelayDispatchText({
            kind: 'a2a_outbox',
            pass: 8,
            max_passes: 10,
            engagement_id: '1f160711fe53',
            outbox_hash: '81193248abc',
            relay_root: 'local-artifacts/a2a-relay'
        });
        expect(text).toContain('A2A outbox READY - audit now.');
        expect(text).toContain('pass: 8 / 10');
        expect(text).toContain('engagement_id: 1f160711fe53');
        expect(text).toContain('outbox_hash: 81193248abc');
        expect(text).toContain('local-artifacts/a2a-relay/outbox/done-check.md');
        expect(text).toContain('AGENTS-AUDITOR.md');
        expect(text).not.toContain('## Goal');
        expect(text).not.toContain('Teacher session handoff');
        expect(text).not.toMatch(/[^\x00-\x7F]/); // ASCII only
    });

    it('raw payload is exact text', () => {
        expect(resolveDispatchPayload({ mode: 'raw', text: 'ok' })).toEqual({
            mode: 'raw',
            text: 'ok'
        });
    });

    it('relay payload ignores workspace invention and stays stable', () => {
        const a = resolveDispatchPayload({
            mode: 'relay',
            meta: { pass: 1, max_passes: 10, engagement_id: 'e1', outbox_hash: 'h1' }
        });
        const b = resolveDispatchPayload({
            mode: 'relay',
            meta: { pass: 1, max_passes: 10, engagement_id: 'e1', outbox_hash: 'h1' }
        });
        expect(a.text).toBe(b.text);
        expect(a.text.startsWith('A2A outbox READY')).toBe(true);
    });

    it('documents the text size cap', () => {
        expect(MAX_DISPATCH_TEXT_BYTES).toBe(32 * 1024);
    });
});
