import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { readCodewordsFile } from '../context/lexicalScan';

export const DEFAULT_CODEWORDS_REL_PATH = '.teacher/codewords.txt';
export const CODEWORDS_EXAMPLE_REL_PATH = '.teacher/codewords.txt.example';

export function getCodewordsRelPath(): string {
    return vscode.workspace
        .getConfiguration('teacher.context')
        .get<string>('codewordsPath', DEFAULT_CODEWORDS_REL_PATH)
        .trim() || DEFAULT_CODEWORDS_REL_PATH;
}

export function getSettingsCodewords(): string[] {
    const raw = vscode.workspace.getConfiguration('teacher.context').get<string[]>('codewords', []);
    return (raw ?? [])
        .map((w) => w.trim())
        .filter((w) => w.length > 0 && !w.startsWith('#'));
}

/** Merge file glossary with optional settings terms (deduped, case-sensitive preserve first). */
export function mergeCodewordTerms(fileTerms: string[], settingsTerms: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const term of [...fileTerms, ...settingsTerms]) {
        const t = term.trim();
        if (!t || seen.has(t)) {
            continue;
        }
        seen.add(t);
        out.push(t);
    }
    return out;
}

export async function ensureCodewordsFile(extensionPath: string, folder: vscode.WorkspaceFolder): Promise<void> {
    const rel = getCodewordsRelPath();
    const targetUri = vscode.Uri.joinPath(folder.uri, ...rel.split('/'));
    try {
        await vscode.workspace.fs.stat(targetUri);
        return;
    } catch {
        // create below
    }

    const dirUri = vscode.Uri.joinPath(targetUri, '..');
    try {
        await vscode.workspace.fs.createDirectory(dirUri);
    } catch {
        // may exist
    }

    const exampleFs = path.join(extensionPath, CODEWORDS_EXAMPLE_REL_PATH.replace(/\//g, path.sep));
    let template = '';
    try {
        template = fs.readFileSync(exampleFs, 'utf8');
    } catch {
        template =
            '# Teacher workspace glossary — one term per line.\n' +
            '# Add product names, APIs, and symbols STT often mishears.\n';
    }

    await vscode.workspace.fs.writeFile(targetUri, Buffer.from(template, 'utf8'));
}

export async function readWorkspaceCodewords(folder: vscode.WorkspaceFolder): Promise<string[]> {
    const rel = getCodewordsRelPath();
    const fileUri = vscode.Uri.joinPath(folder.uri, ...rel.split('/'));
    try {
        const raw = await vscode.workspace.fs.readFile(fileUri);
        const lines = Buffer.from(raw)
            .toString('utf8')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith('#'));
        return mergeCodewordTerms(lines, getSettingsCodewords());
    } catch {
        return getSettingsCodewords();
    }
}

/** Sync read for CLI tools (dump-context spike). */
export function readCodewordsFromDisk(workspaceRoot: string): string[] {
    const rel = DEFAULT_CODEWORDS_REL_PATH;
    const filePath = path.join(workspaceRoot, ...rel.split('/'));
    const fileTerms = readCodewordsFile(filePath);
    return mergeCodewordTerms(fileTerms, []);
}
