#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Load Grok/xAI key from env or known local .env files (never log the key). */
export function loadGrokKey() {
    if (process.env.XAI_API_KEY?.trim()) {
        return process.env.XAI_API_KEY.trim();
    }
    if (process.env.GROK_API_KEY?.trim()) {
        return process.env.GROK_API_KEY.trim();
    }
    if (process.env.CLOUD_LLM_GENERATE_API_KEY?.trim()) {
        return process.env.CLOUD_LLM_GENERATE_API_KEY.trim();
    }

    const candidates = [
        path.join(__dirname, '..', '.env'),
        path.join(__dirname, '..', '..', 'environment', 'apps', 'backend', 'infra', 'compose', '.env')
    ];

    for (const envPath of candidates) {
        if (!fs.existsSync(envPath)) {
            continue;
        }
        for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }
            const eq = trimmed.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            const key = trimmed.slice(0, eq).trim();
            if (key === 'XAI_API_KEY' || key === 'GROK_API_KEY' || key === 'CLOUD_LLM_GENERATE_API_KEY') {
                const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
                if (val) {
                    return val;
                }
            }
        }
    }
    return null;
}

export function loadGrokModel() {
    if (process.env.CLOUD_LLM_GENERATE_MODEL?.trim()) {
        return process.env.CLOUD_LLM_GENERATE_MODEL.trim();
    }
    return process.env.GROK_MODEL?.trim() || 'grok-4-fast-reasoning';
}
