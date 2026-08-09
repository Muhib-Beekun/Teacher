/** Deterministic machine-dispatch packets (no LLM / no session compile). */

export type DispatchMode = 'handoff' | 'raw' | 'relay';

export interface DispatchMeta {
    kind?: string;
    pass?: number | string;
    max_passes?: number | string;
    engagement_id?: string;
    outbox_hash?: string;
    relay_root?: string;
}

export const MAX_DISPATCH_TEXT_BYTES = 32 * 1024;

export function isDispatchMode(value: unknown): value is DispatchMode {
    return value === 'handoff' || value === 'raw' || value === 'relay';
}

/**
 * Stable A2A auditor wake template. ASCII only (no fancy dashes).
 * Filled from caller meta; never invents workspace goals.
 */
export function buildRelayDispatchText(meta: DispatchMeta = {}, extraText = ''): string {
    const pass = meta.pass ?? '?';
    const maxPasses = meta.max_passes ?? '?';
    const engagementId = meta.engagement_id ?? '(none)';
    const outboxHash = meta.outbox_hash ?? '(none)';
    const relayRoot = (meta.relay_root || 'local-artifacts/a2a-relay').replace(/\\/g, '/');

    const lines = [
        'A2A outbox READY - audit now.',
        '',
        `pass: ${pass} / ${maxPasses}`,
        `engagement_id: ${engagementId}`,
        `outbox_hash: ${outboxHash}`,
        '',
        'Read in order:',
        `1. ${relayRoot}/outbox/done-check.md`,
        '2. evidence.md, files.md, summary.md',
        '3. git diff for touched paths',
        '',
        'Then in the SAME turn:',
        '- If COMPLETE: New-A2aTicket.ps1 (next pass) OR Set-A2aStop.ps1 if AT_REACHED',
        '- If INCOMPLETE: stop with blockers; do not invent scope',
        '- Do not end on status narration only',
        '',
        'Follow automation/a2a-relay/AGENTS-AUDITOR.md'
    ];

    const base = lines.join('\n');
    const extra = (extraText || '').trim();
    return extra ? `${base}\n\n${extra}` : base;
}

export function resolveDispatchPayload(input: {
    mode: DispatchMode;
    text?: string;
    meta?: DispatchMeta;
}): { text: string; mode: DispatchMode } {
    const text = (input.text ?? '').trim();
    if (input.mode === 'raw') {
        return { mode: 'raw', text };
    }
    if (input.mode === 'relay') {
        return { mode: 'relay', text: buildRelayDispatchText(input.meta, text) };
    }
    return { mode: 'handoff', text };
}
