import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const ENV_ALIASES: Record<string, string> = {
    OPENAI_API_KEY: 'INFERENCE_API_KEY',
    XAI_API_KEY: 'INFERENCE_API_KEY',
    GROK_API_KEY: 'INFERENCE_API_KEY'
};

/** Keys injected by the most recent loadWorkspaceEnv call so we can clear stale ones. */
const managedKeys = new Set<string>();

/** Load workspace `.env` into process.env (extension host does not inherit shell env reliably). */
export function loadWorkspaceEnv(): void {
    // Clear keys from the previous load so deleted/emptied lines don't persist.
    for (const key of managedKeys) {
        delete process.env[key];
    }
    managedKeys.clear();

    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
        return;
    }

    for (const folder of folders) {
        parseEnvFile(path.join(folder.uri.fsPath, '.env'));
    }

    applyEnvAliases();
}

function parseEnvFile(envPath: string): void {
    if (!fs.existsSync(envPath)) {
        return;
    }
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        const eq = trimmed.indexOf('=');
        if (eq <= 0) {
            continue;
        }
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!value) {
            continue;
        }
        process.env[key] = value;
        managedKeys.add(key);
    }
}

function applyEnvAliases(): void {
    for (const [from, to] of Object.entries(ENV_ALIASES)) {
        const val = process.env[from]?.trim();
        if (val && !process.env[to]?.trim()) {
            process.env[to] = val;
            managedKeys.add(to);
        }
    }
}
