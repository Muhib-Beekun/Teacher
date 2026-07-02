#!/usr/bin/env node
import { loadGrokKey, loadGrokModel } from './load-grok-key.mjs';

const key = loadGrokKey();
if (!key) {
    console.error('FAIL: No inference API key found (INFERENCE_API_KEY, XAI_API_KEY, or GROK_API_KEY in .env)');
    process.exitCode = 1;
    process.exit();
}

const model = loadGrokModel();
const segments = [
    'I like the paneling on the left. The agent prompt text on the right is white and not padded.',
    'Make the right pane match the left styling. Use Grok only for compile with no fallback.'
];

const system = `You are Teacher — transform voice dictation into a structured Cursor agent brief.
CRITICAL: Output must NOT read like a transcript. Synthesize into actionable imperative instructions.
Output markdown with sections: ## Goal, ## Target, ## Constraints, ## Verification, then ---, then **Reference only (superseded — do not implement unless asked again)**`;

const user = `Voice segments (latest = current intent):
1. ${segments[0]}
2. [LATEST] ${segments[1]}`;

const started = Date.now();
const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        model,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
        ],
        temperature: 0.2
    })
});

const ms = Date.now() - started;

if (!res.ok) {
    const body = await res.text();
    console.error(`FAIL: Grok API ${res.status} (${ms}ms): ${body.slice(0, 300)}`);
    process.exitCode = 1;
    process.exit();
}

const json = await res.json();
const text = json.choices?.[0]?.message?.content?.trim() ?? '';

if (!text.includes('## Goal')) {
    console.error('FAIL: response missing ## Goal');
    process.exitCode = 1;
    process.exit();
}

const latest = segments[1];
const goalBody = (text.match(/## Goal\s*\n([\s\S]*?)(?=\n##|$)/)?.[1] ?? '').trim();
if (goalBody && goalBody.toLowerCase() === latest.toLowerCase()) {
    console.error('FAIL: Goal is verbatim copy of latest segment');
    process.exitCode = 1;
    process.exit();
}

if (ms < 500) {
    console.error(`FAIL: response too fast (${ms}ms) — likely not a real remote call`);
    process.exitCode = 1;
    process.exit();
}

console.log(`grok live test passed (${model}, ${ms}ms)`);
console.log('Goal preview:', text.split('\n').slice(0, 6).join(' | '));
