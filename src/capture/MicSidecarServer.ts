import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const DEFAULT_PORT = 3721;
const MAX_BODY_BYTES = 25 * 1024 * 1024;

export class MicSidecarServer {
    private server: http.Server | undefined;
    private port = DEFAULT_PORT;
    private html = '';

    constructor(private readonly extensionPath: string) {
        const htmlPath = path.join(extensionPath, 'media', 'mic-sidecar.html');
        this.html = fs.readFileSync(htmlPath, 'utf8');
    }

    public getPort(): number {
        return this.port;
    }

    public getCaptureUrl(): string {
        return `http://127.0.0.1:${this.port}/`;
    }

    public start(onAudio: (buffer: Buffer, mimeType: string) => void): Promise<number> {
        if (this.server) {
            return Promise.resolve(this.port);
        }

        const configured = vscode.workspace.getConfiguration('teacher.capture').get<number>('sidecarPort', DEFAULT_PORT);

        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(this.html);
                    return;
                }

                if (req.method === 'POST' && req.url === '/audio') {
                    const mimeType = req.headers['content-type'] ?? 'audio/webm';
                    const chunks: Buffer[] = [];
                    let size = 0;
                    req.on('data', (chunk: Buffer) => {
                        size += chunk.length;
                        if (size > MAX_BODY_BYTES) {
                            res.writeHead(413);
                            res.end('Payload too large');
                            req.destroy();
                            return;
                        }
                        chunks.push(chunk);
                    });
                    req.on('end', () => {
                        const body = Buffer.concat(chunks);
                        if (body.length > 0) {
                            onAudio(body, String(mimeType));
                        }
                        res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: true }));
                    });
                    return;
                }

                if (req.method === 'OPTIONS') {
                    res.writeHead(204, corsHeaders());
                    res.end();
                    return;
                }

                res.writeHead(404);
                res.end('Not found');
            });

            this.server.on('error', reject);

            this.server.listen(configured, '127.0.0.1', () => {
                this.port = configured;
                resolve(this.port);
            });
        });
    }

    public async openInBrowser(): Promise<void> {
        await vscode.env.openExternal(vscode.Uri.parse(this.getCaptureUrl()));
    }

    public stop(): void {
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }
    }
}

function corsHeaders(): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}
