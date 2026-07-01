#!/usr/bin/env node
/** Smoke test for mic-sidecar-server.mjs — starts on a random free port, hits all routes. */
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function freePort() {
    return new Promise((resolve, reject) => {
        const s = http.createServer();
        s.listen(0, '127.0.0.1', () => {
            const { port } = s.address();
            s.close(() => resolve(port));
        });
        s.on('error', reject);
    });
}

async function fetchJson(url, init) {
    const res = await fetch(url, init);
    const body = await res.json();
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    return body;
}

const port = await freePort();
const child = spawn(process.execPath, [path.join(__dirname, 'mic-sidecar-server.mjs')], {
    env: { ...process.env, TEACHER_MIC_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
});

let booted = false;
child.stdout.on('data', (d) => {
    if (String(d).includes('Open http://')) booted = true;
});
child.stderr.on('data', (d) => process.stderr.write(d));

await new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000;
    const tick = () => {
        if (booted) return resolve();
        if (Date.now() > deadline) return reject(new Error('sidecar did not start in 5s'));
        setTimeout(tick, 50);
    };
    tick();
});

const base = `http://127.0.0.1:${port}`;
const health = await fetchJson(`${base}/health`);
if (!health.ok) throw new Error('health failed');

const segment = await fetchJson(`${base}/segment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'smoke test segment' })
});
if (!segment.ok || segment.chars !== 'smoke test segment'.length) {
    throw new Error(`segment failed: ${JSON.stringify(segment)}`);
}

const audio = await fetchJson(`${base}/audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'audio/webm' },
    body: Buffer.from([1, 2, 3])
});
if (audio.bytes !== 3) throw new Error('audio bytes mismatch');

child.kill('SIGTERM');
await new Promise((r) => child.once('exit', r));
console.log('mic-sidecar smoke test passed');
