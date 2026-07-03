import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface TraceEntry {
    ts: string;
    job: string;
    provider: string;
    model: string;
    latencyMs: number;
    inputChars: number;
    outputChars: number;
    status: 'ok' | 'error';
    error?: string;
    tokensIn?: number;
    tokensOut?: number;
}

const MAX_LINES = 500;
const PRUNE_TO = 400;

function traceFilePath(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
        return undefined;
    }
    return path.join(folders[0].uri.fsPath, '.teacher', 'trace.jsonl');
}

function ensureDir(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function rotateIfNeeded(filePath: string): void {
    if (!fs.existsSync(filePath)) {
        return;
    }
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        if (lines.length <= MAX_LINES) {
            return;
        }
        const pruned = lines.slice(lines.length - PRUNE_TO);
        fs.writeFileSync(filePath, pruned.join('\n') + '\n', 'utf8');
    } catch {
        // Best-effort rotation — don't crash the extension
    }
}

export function writeTrace(entry: TraceEntry): void {
    const filePath = traceFilePath();
    if (!filePath) {
        return;
    }
    try {
        ensureDir(filePath);
        const line = JSON.stringify(entry);
        fs.appendFileSync(filePath, line + '\n', 'utf8');
        rotateIfNeeded(filePath);
    } catch {
        // Best-effort — never crash the extension for tracing
    }
}

export function traceCall(
    job: string,
    provider: string,
    model: string,
    inputChars: number,
    fn: () => Promise<{ text: string; tokensIn?: number; tokensOut?: number }>
): Promise<{ text: string; tokensIn?: number; tokensOut?: number }> {
    const started = Date.now();
    return fn().then(
        (result) => {
            writeTrace({
                ts: new Date().toISOString(),
                job,
                provider,
                model,
                latencyMs: Date.now() - started,
                inputChars,
                outputChars: result.text.length,
                status: 'ok',
                tokensIn: result.tokensIn,
                tokensOut: result.tokensOut
            });
            return result;
        },
        (err) => {
            writeTrace({
                ts: new Date().toISOString(),
                job,
                provider,
                model,
                latencyMs: Date.now() - started,
                inputChars,
                outputChars: 0,
                status: 'error',
                error: err?.message?.slice(0, 200) || String(err).slice(0, 200)
            });
            throw err;
        }
    );
}
