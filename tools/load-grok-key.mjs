#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KEY_NAMES = ['INFERENCE_API_KEY', 'XAI_API_KEY', 'GROK_API_KEY', 'OPENAI_API_KEY'];

/** Load inference API key from env or repo `.env` (never log the key). */
export function loadGrokKey() {
    for (const name of KEY_NAMES) {
        if (process.env[name]?.trim()) {
            return process.env[name].trim();
        }
    }

    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) {
        return null;
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
        if (KEY_NAMES.includes(key)) {
            const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
            if (val) {
                return val;
            }
        }
    }
    return null;
}

export function loadGrokModel() {
    if (process.env.INFERENCE_MODEL?.trim()) {
        return process.env.INFERENCE_MODEL.trim();
    }
    return process.env.GROK_MODEL?.trim() || 'grok-4-fast-reasoning';
}
