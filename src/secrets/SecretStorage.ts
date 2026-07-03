import * as vscode from 'vscode';
import { readInferenceApiKeyFromEnv } from '../config/inferenceEnv';

const INFERENCE_KEY = 'teacher.inference.apiKey';
const DEEPGRAM_KEY = 'teacher.deepgram.apiKey';

/** Legacy secret ids — same key, read for upgrades only. */
const LEGACY_LLM_KEYS = ['teacher.llm.apiKey', 'teacher.grok.apiKey'] as const;

export async function getLlmApiKey(secrets: vscode.SecretStorage): Promise<string | undefined> {
    const source = await getLlmKeySource(secrets);
    if (source === 'secrets') {
        const fromSecret = await secrets.get(INFERENCE_KEY);
        if (fromSecret?.trim()) {
            return fromSecret.trim();
        }
        for (const legacy of LEGACY_LLM_KEYS) {
            const val = await secrets.get(legacy);
            if (val?.trim()) {
                return val.trim();
            }
        }
    }
    if (source === 'env') {
        return readInferenceApiKeyFromEnv();
    }
    return undefined;
}

export async function getLlmKeySource(secrets: vscode.SecretStorage): Promise<'env' | 'secrets' | 'none'> {
    const fromSecret = await secrets.get(INFERENCE_KEY);
    if (fromSecret?.trim()) {
        return 'secrets';
    }
    for (const legacy of LEGACY_LLM_KEYS) {
        const val = await secrets.get(legacy);
        if (val?.trim()) {
            return 'secrets';
        }
    }
    if (readInferenceApiKeyFromEnv()) {
        return 'env';
    }
    return 'none';
}

export async function setLlmApiKey(secrets: vscode.SecretStorage, key: string): Promise<void> {
    await secrets.store(INFERENCE_KEY, key);
    for (const legacy of LEGACY_LLM_KEYS) {
        await secrets.store(legacy, key);
    }
}

export async function promptLlmApiKey(secrets: vscode.SecretStorage): Promise<void> {
    const key = await vscode.window.showInputBox({
        title: 'Teacher: Set inference API key',
        prompt: 'OpenAI-compatible key. Stored in VS Code SecretStorage (not settings.json).',
        password: true,
        placeHolder: 'sk-…'
    });
    if (key?.trim()) {
        await setLlmApiKey(secrets, key.trim());
        vscode.window.showInformationMessage('Teacher saved your inference API key.');
    }
}

export async function getDeepgramApiKey(secrets: vscode.SecretStorage): Promise<string | undefined> {
    const fromSecret = await secrets.get(DEEPGRAM_KEY);
    if (fromSecret?.trim()) {
        return fromSecret.trim();
    }
    return process.env.DEEPGRAM_API_KEY?.trim() || undefined;
}

export async function setDeepgramApiKey(secrets: vscode.SecretStorage, key: string): Promise<void> {
    await secrets.store(DEEPGRAM_KEY, key);
}

export async function promptDeepgramApiKey(secrets: vscode.SecretStorage): Promise<void> {
    const key = await vscode.window.showInputBox({
        title: 'Teacher: Set Deepgram API Key',
        prompt: 'Stored in VS Code SecretStorage. Or set DEEPGRAM_API_KEY in your environment.',
        password: true,
        placeHolder: 'Deepgram API key'
    });
    if (key?.trim()) {
        await setDeepgramApiKey(secrets, key.trim());
        vscode.window.showInformationMessage('Teacher saved your Deepgram API key.');
    }
}
