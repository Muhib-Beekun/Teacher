import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BrowserSessionBridge } from '../web/BrowserSessionBridge';

const DEFAULT_PORT = 3721;
const MAX_PORT_TRIES = 20;
const MAX_BODY_BYTES = 25 * 1024 * 1024;

export class WebAppServer {
    private server: http.Server | undefined;
    private port = DEFAULT_PORT;
    private html = '';
    private output?: vscode.OutputChannel;
    private healthExtras?: () => Promise<Record<string, unknown>>;
    private onSend?: (source: 'brief' | 'words', briefVersion?: number) => Promise<{ ok: boolean; message: string }>;

    constructor(private readonly extensionPath: string) {
        const htmlPath = path.join(extensionPath, 'media', 'teacher-app.html');
        this.html = fs.readFileSync(htmlPath, 'utf8');
    }

    public setOutput(output: vscode.OutputChannel): void {
        this.output = output;
    }

    public setHealthProvider(fn: () => Promise<Record<string, unknown>>): void {
        this.healthExtras = fn;
    }

    public setSendHandler(fn: (source: 'brief' | 'words', briefVersion?: number) => Promise<{ ok: boolean; message: string }>): void {
        this.onSend = fn;
    }

    public getPort(): number {
        return this.port;
    }

    public getUrl(): string {
        return `http://127.0.0.1:${this.port}/`;
    }

    public start(bridge: BrowserSessionBridge): Promise<number> {
        if (this.server) {
            return Promise.resolve(this.port);
        }

        const preferred = vscode.workspace.getConfiguration('teacher.capture').get<number>('sidecarPort', DEFAULT_PORT);

        return this.listenWithFallback(preferred, bridge);
    }

    public async openInBrowser(): Promise<void> {
        await vscode.env.openExternal(vscode.Uri.parse(this.getUrl()));
    }

    public stop(): void {
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }
    }

    private listenWithFallback(preferred: number, bridge: BrowserSessionBridge, attempt = 0): Promise<number> {
        const port = preferred + attempt;

        return new Promise((resolve, reject) => {
            const server = http.createServer((req, res) => {
                void this.route(req, res, bridge);
            });

            server.once('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE' && attempt + 1 < MAX_PORT_TRIES) {
                    if (attempt === 0) {
                        this.log(`[web] port ${port} busy — trying ${port + 1}…`);
                    }
                    resolve(this.listenWithFallback(preferred, bridge, attempt + 1));
                    return;
                }
                reject(err);
            });

            server.listen(port, '127.0.0.1', () => {
                this.server = server;
                this.port = port;
                if (attempt > 0) {
                    this.log(`[web] using port ${port} (${preferred} was busy)`);
                }
                this.log(`[web] Teacher UI at ${this.getUrl()}`);
                resolve(port);
            });
        });
    }

    private async route(req: http.IncomingMessage, res: http.ServerResponse, bridge: BrowserSessionBridge): Promise<void> {
        const url = req.url ?? '/';

        if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(this.html);
            return;
        }

        if (req.method === 'GET' && url === '/health') {
            const extras = this.healthExtras ? await this.healthExtras() : {};
            this.json(res, 200, { ok: true, mode: 'extension', url: this.getUrl(), ...extras });
            return;
        }

        if (req.method === 'GET' && url === '/api/session') {
            this.json(res, 200, { ok: true, session: bridge.getSnapshot() });
            return;
        }

        if (req.method === 'POST' && url === '/api/segment') {
            const body = await this.readBody(req, res);
            if (!body) return;
            let text = '';
            try {
                text = (JSON.parse(body.toString('utf8')) as { text?: string }).text ?? '';
            } catch {
                text = body.toString('utf8');
            }
            this.log(`[web] segment: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`);
            const session = await bridge.appendSegment(text);
            this.json(res, 200, { ok: true, session });
            return;
        }

        if (req.method === 'POST' && (url === '/api/audio' || url === '/audio')) {
            const mimeType = req.headers['content-type'] ?? 'audio/webm';
            const body = await this.readBody(req, res);
            if (!body) return;
            this.log(`[web] audio: ${body.length} bytes`);
            try {
                const session = await bridge.appendAudio(body, String(mimeType));
                this.json(res, 200, { ok: true, bytes: body.length, session });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.json(res, 422, { ok: false, error: msg, session: bridge.getSnapshot(`STT failed: ${msg}`) });
            }
            return;
        }

        if (req.method === 'POST' && (url === '/api/reset' || url === '/api/clear')) {
            const session = bridge.reset();
            this.json(res, 200, { ok: true, session });
            return;
        }

        if (req.method === 'POST' && url === '/api/compile') {
            const session = await bridge.forceCompile();
            this.json(res, 200, { ok: true, session });
            return;
        }

        if (req.method === 'POST' && url === '/api/send') {
            if (!this.onSend) {
                this.json(res, 501, { ok: false, error: 'Send not available' });
                return;
            }
            try {
                const body = await this.readBody(req, res);
                let source: 'brief' | 'words' = 'brief';
                let briefVersion: number | undefined;
                if (body?.length) {
                    try {
                        const parsed = JSON.parse(body.toString('utf8')) as { source?: string; briefVersion?: number };
                        if (parsed.source === 'words') {
                            source = 'words';
                        }
                        if (typeof parsed.briefVersion === 'number') {
                            briefVersion = parsed.briefVersion;
                        }
                    } catch {
                        /* default brief */
                    }
                }
                const result = await this.onSend(source, briefVersion);
                this.json(res, result.ok ? 200 : 400, result);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.json(res, 500, { ok: false, error: msg });
            }
            return;
        }

        const segmentUpdate = url.match(/^\/api\/segment\/(\d+)$/);
        if (req.method === 'PUT' && segmentUpdate) {
            const body = await this.readBody(req, res);
            if (!body) return;
            let text = '';
            let recompile = false;
            try {
                const parsed = JSON.parse(body.toString('utf8')) as { text?: string; recompile?: boolean };
                text = parsed.text ?? '';
                recompile = parsed.recompile === true;
            } catch {
                text = body.toString('utf8');
            }
            const index = Number(segmentUpdate[1]);
            const session = await bridge.updateSegment(index, text, recompile);
            this.json(res, 200, { ok: true, session });
            return;
        }

        const segmentFix = url.match(/^\/api\/segment\/(\d+)\/fix$/);
        if (req.method === 'POST' && segmentFix) {
            const body = await this.readBody(req, res);
            if (!body) return;
            const index = Number(segmentFix[1]);
            let heard = '';
            let corrected = '';
            let action = 'apply';
            try {
                const parsed = JSON.parse(body.toString('utf8')) as { heard?: string; corrected?: string; action?: string };
                heard = parsed.heard ?? '';
                corrected = parsed.corrected ?? '';
                action = parsed.action ?? 'apply';
            } catch {
                this.json(res, 400, { ok: false, error: 'Invalid JSON' });
                return;
            }
            const session =
                action === 'revert' || action === 'dismiss'
                    ? bridge.revertFix(index, heard, corrected)
                    : bridge.getSnapshot('Correction already applied.');
            this.json(res, 200, { ok: true, session });
            return;
        }

        if (req.method === 'PUT' && url === '/api/brief') {
            this.json(res, 200, { ok: true, session: bridge.getSnapshot() });
            return;
        }

        // Legacy mic-sidecar routes
        if (req.method === 'POST' && url === '/segment') {
            const body = await this.readBody(req, res);
            if (!body) return;
            let text = '';
            try {
                text = (JSON.parse(body.toString('utf8')) as { text?: string }).text ?? '';
            } catch {
                text = body.toString('utf8');
            }
            const session = await bridge.appendSegment(text);
            this.json(res, 200, { ok: true, chars: text.length, session });
            return;
        }

        if (req.method === 'OPTIONS') {
            res.writeHead(204, corsHeaders());
            res.end();
            return;
        }

        res.writeHead(404);
        res.end('Not found');
    }

    private readBody(req: http.IncomingMessage, res: http.ServerResponse): Promise<Buffer | undefined> {
        return new Promise((resolve) => {
            const chunks: Buffer[] = [];
            let size = 0;
            req.on('data', (chunk: Buffer) => {
                size += chunk.length;
                if (size > MAX_BODY_BYTES) {
                    res.writeHead(413);
                    res.end('Payload too large');
                    req.destroy();
                    resolve(undefined);
                    return;
                }
                chunks.push(chunk);
            });
            req.on('end', () => resolve(Buffer.concat(chunks)));
        });
    }

    private json(res: http.ServerResponse, code: number, obj: Record<string, unknown>): void {
        res.writeHead(code, { ...corsHeaders(), 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
    }

    private log(line: string): void {
        this.output?.appendLine(line);
    }
}

function corsHeaders(): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}

/** @deprecated Use WebAppServer */
export { WebAppServer as MicSidecarServer };
