#!/usr/bin/env node
/**
 * Standalone Teacher mic sidecar — test in Chrome WITHOUT Cursor.
 *
 *   npm run mic-sidecar
 *
 * If 3721 is taken (e.g. Teacher extension already running in Cursor),
 * automatically tries 3722, 3723, … unless TEACHER_MIC_PORT is set explicitly.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREFERRED = Number(process.env.TEACHER_MIC_PORT || 3721);
const EXPLICIT_PORT = Boolean(process.env.TEACHER_MIC_PORT);
const MAX_TRIES = EXPLICIT_PORT ? 1 : 20;
const html = fs.readFileSync(path.join(__dirname, '..', 'media', 'teacher-app.html'), 'utf8');

function createHandler() {
    return (req, res) => {
        if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        if (req.method === 'GET' && req.url === '/health') {
            json(res, 200, { ok: true, mode: 'standalone', stt: 'webspeech' });
            return;
        }

        if (req.method === 'POST' && req.url === '/audio') {
            readBody(req, (body) => {
                console.log(`[audio] received ${body.length} bytes (${req.headers['content-type'] || 'unknown'})`);
                json(res, 200, { ok: true, bytes: body.length });
            });
            return;
        }

        if (req.method === 'POST' && req.url === '/segment') {
            readBody(req, (body) => {
                let text = '';
                try {
                    text = JSON.parse(body.toString('utf8')).text || '';
                } catch {
                    text = body.toString('utf8');
                }
                console.log(`[segment] "${text.slice(0, 120)}${text.length > 120 ? '…' : ''}"`);
                json(res, 200, { ok: true, chars: text.length });
            });
            return;
        }

        if (req.method === 'OPTIONS') {
            res.writeHead(204, cors());
            res.end();
            return;
        }

        res.writeHead(404);
        res.end('Not found');
    };
}

function tryListen(port) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(createHandler());
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
            server.removeListener('error', reject);
            resolve(server);
        });
    });
}

async function main() {
    for (let i = 0; i < MAX_TRIES; i++) {
        const port = PREFERRED + i;
        try {
            const server = await tryListen(port);
            if (i > 0) {
                console.warn(`Port ${PREFERRED} was busy — using ${port} instead.`);
                console.warn('(3721 is usually the Teacher extension sidecar in Cursor.)');
            }
            console.log('Teacher mic sidecar (standalone test)');
            console.log(`Open http://127.0.0.1:${port}/ in Chrome`);
            console.log('Speak → pause mic → Send chunk — watch this terminal for output');
            server.on('error', (err) => {
                console.error('Server error:', err.message);
                process.exit(1);
            });
            return;
        } catch (err) {
            if (err.code !== 'EADDRINUSE') {
                throw err;
            }
            if (EXPLICIT_PORT) {
                console.error(`Port ${port} is already in use.`);
                console.error('Likely cause: Teacher extension sidecar is running in Cursor on that port.');
                console.error('Close Cursor / end the Teacher session, or pick another port:');
                console.error('  $env:TEACHER_MIC_PORT=3722; npm run mic-sidecar');
                process.exit(1);
            }
        }
    }
    console.error(`No free port in range ${PREFERRED}–${PREFERRED + MAX_TRIES - 1}.`);
    process.exit(1);
}

function readBody(req, cb) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => cb(Buffer.concat(chunks)));
}

function json(res, code, obj) {
    res.writeHead(code, { ...cors(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
}

function cors() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
