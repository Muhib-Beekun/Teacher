import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const ENV_ALIASES: Record<string, string> = {
    CLOUD_LLM_GENERATE_API_KEY: 'XAI_API_KEY',
    GROK_API_KEY: 'XAI_API_KEY'
};

/** Load workspace `.env` files into process.env (extension host does not inherit shell env reliably). */
export function loadWorkspaceEnv(): void {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
        return;
    }

    for (const folder of folders) {
        const root = folder.uri.fsPath;
        const candidates = [
            path.join(root, '.env'),
            path.join(root, '..', 'environment', 'apps', 'backend', 'infra', 'compose', '.env')
        ];
        for (const envPath of candidates) {
            parseEnvFile(envPath);
        }
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
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

function applyEnvAliases(): void {
    for (const [from, to] of Object.entries(ENV_ALIASES)) {
        const val = process.env[from]?.trim();
        if (val && !process.env[to]?.trim()) {
            process.env[to] = val;
        }
    }
}
