#!/usr/bin/env node
/**
 * Test harness for teacher-app.html — same API as WebAppServer, no VS Code.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'media', 'teacher-app.html'), 'utf8');

const { SessionManager } = await import('../out/session/SessionManager.js');
const { compileSession } = await import('../out/compiler/TeacherCompiler.js');
const { emptyVoiceSessionContext } = await import('../out/context/VoiceSessionContext.js');

const session = new SessionManager();
const ctx = emptyVoiceSessionContext();

function buildSnapshot(status) {
    const briefMarkdownByVersion = {};
    for (const v of session.getBriefVersions()) {
        briefMarkdownByVersion[v.version] = v.brief.markdown;
    }
    return {
        transcriptHtml: session.formatTranscriptHtml(),
        briefHtml: session.formatBriefHtml(),
        compiled: session.getCompiledMarkdown() || 'Speak — Grok will scaffold an agent brief here after each pause.',
        compileError: session.getLastCompileError(),
        needsRegenerate: session.getNeedsRegenerate(),
        briefMarkdownByVersion,
        segmentCount: session.getSegments().length,
        sttLabel: 'Browser speech (Chrome/Edge live preview)',
        compileLabel: 'Harness — Grok compile not wired here',
        contextHint: '0 workspace terms indexed',
        status
    };
}

function appendSegment(text) {
    const trimmed = text.trim();
    if (!trimmed) return buildSnapshot('Nothing to add.');
    session.appendSegment(trimmed, trimmed, []);
    session.setCompiledBrief(compileSession(session.getRawTexts(), ctx, 'teacher'));
    return buildSnapshot('Segment added.');
}

function createHandler() {
    return async (req, res) => {
        const url = req.url ?? '/';

        if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        if (req.method === 'GET' && url === '/health') {
            json(res, 200, { ok: true, mode: 'harness', stt: 'webspeech', compile: 'none', llmKeySet: false, url: `http://127.0.0.1:${serverPort}/` });
            return;
        }

        if (req.method === 'GET' && url === '/api/settings') {
            json(res, 200, {
                ok: true,
                settings: {
                    compileLive: true,
                    polishStt: true,
                    homonymPass: true,
                    sendAutoPaste: true,
                    sendAutoSubmit: true,
                    compileMode: 'teacher',
                    sttProvider: 'auto',
                    compilerKeySet: false,
                    compilerReady: false,
                    sttLabel: 'Browser speech (Chrome/Edge live preview)',
                    compileLabel: 'Harness — Grok compile not wired here',
                    contextHint: '0 workspace terms indexed',
                    vscodeSettingsPrefix: 'teacher'
                }
            });
            return;
        }

        if (req.method === 'GET' && url === '/api/session') {
            json(res, 200, { ok: true, session: buildSnapshot() });
            return;
        }

        if (req.method === 'POST' && url === '/api/segment') {
            const body = await readBody(req);
            let text = '';
            try { text = JSON.parse(body.toString('utf8')).text || ''; } catch { text = body.toString('utf8'); }
            const sessionSnap = appendSegment(text);
            json(res, 200, { ok: true, session: sessionSnap });
            return;
        }

        if (req.method === 'POST' && url === '/api/reset') {
            session.reset();
            json(res, 200, { ok: true, session: buildSnapshot('Session cleared.') });
            return;
        }

        if (req.method === 'POST' && url === '/api/compile') {
            json(res, 200, { ok: true, session: buildSnapshot('Re-scaffolded.') });
            return;
        }

        if (req.method === 'PUT' && url === '/api/brief') {
            await readBody(req);
            json(res, 200, { ok: true, session: buildSnapshot() });
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

let serverPort = 0;

export function startHarness(preferredPort = 0) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            void createHandler()(req, res);
        });
        server.once('error', reject);
        server.listen(preferredPort, '127.0.0.1', () => {
            serverPort = server.address().port;
            resolve({ port: serverPort, url: `http://127.0.0.1:${serverPort}/`, stop: () => server.close() });
        });
    });
}

function readBody(req) {
    return new Promise((resolve) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

function json(res, code, obj) {
    res.writeHead(code, { ...cors(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
}

function cors() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}
