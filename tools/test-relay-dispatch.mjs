#!/usr/bin/env node
/**
 * Deterministic dispatch packet checks (no live extension host required).
 * Optional: set TEACHER_DISPATCH_URL=http://127.0.0.1:3721 to hit a running sidecar.
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    buildRelayDispatchText,
    resolveDispatchPayload,
    MAX_DISPATCH_TEXT_BYTES
} = require('../out/web/dispatchPacket.js');

let failed = 0;
function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        failed += 1;
    } else {
        console.log('ok:', msg);
    }
}

const raw = resolveDispatchPayload({ mode: 'raw', text: 'ok' });
assert(raw.text === 'ok', 'raw mode is exact text "ok"');
assert(!raw.text.includes('Teacher session handoff'), 'raw has no handoff wrapper');
assert(!raw.text.includes('## Goal'), 'raw has no Goal block');

const relay = buildRelayDispatchText({
    pass: 8,
    max_passes: 10,
    engagement_id: '1f160711fe53',
    outbox_hash: '81193248...',
    relay_root: 'local-artifacts/a2a-relay'
});
assert(relay.includes('pass: 8 / 10'), 'relay includes pass fields');
assert(relay.includes('outbox_hash: 81193248...'), 'relay includes outbox_hash');
assert(relay.includes('local-artifacts/a2a-relay/outbox/done-check.md'), 'relay points at outbox');
assert(!relay.includes('## Goal'), 'relay has no Goal block');
assert(!/[^\x00-\x7F]/.test(relay), 'relay template is ASCII');

assert(MAX_DISPATCH_TEXT_BYTES === 32 * 1024, '32KB text cap');

const url = process.env.TEACHER_DISPATCH_URL;
if (url) {
    const endpoint = url.replace(/\/$/, '') + '/api/dispatch';
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'ok', mode: 'raw', submit: false })
        });
        const json = await res.json();
        assert(res.ok && json.ok, `live dispatch raw ok (${res.status})`);
        assert(json.mode === 'raw', 'live response mode=raw');
        assert(json.bytes === 2, `live bytes=2 got ${json.bytes}`);
    } catch (err) {
        assert(false, `live dispatch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
} else {
    console.log('(skip live HTTP — set TEACHER_DISPATCH_URL to exercise /api/dispatch)');
}

if (failed) {
    console.error(`${failed} failure(s)`);
    process.exit(1);
}
console.log('relay dispatch tests passed');
