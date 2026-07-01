import * as vscode from 'vscode';

const GROK_KEY = 'teacher.grok.apiKey';
const DEEPGRAM_KEY = 'teacher.deepgram.apiKey';

export async function getGrokApiKey(secrets: vscode.SecretStorage): Promise<string | undefined> {
    const fromSecret = await secrets.get(GROK_KEY);
    if (fromSecret?.trim()) {
        return fromSecret.trim();
    }
    const fromEnv =
        process.env.XAI_API_KEY?.trim() ||
        process.env.GROK_API_KEY?.trim() ||
        process.env.CLOUD_LLM_GENERATE_API_KEY?.trim();
    if (fromEnv) {
        return fromEnv;
    }
    const fromSetting = vscode.workspace
        .getConfiguration('teacher.inference.grok')
        .get<string>('apiKey', '')
        .trim();
    return fromSetting || undefined;
}

export async function setGrokApiKey(secrets: vscode.SecretStorage, key: string): Promise<void> {
    await secrets.store(GROK_KEY, key);
}

export async function promptGrokApiKey(secrets: vscode.SecretStorage): Promise<void> {
    const key = await vscode.window.showInputBox({
        title: 'Teacher: Grok (xAI) API Key',
        prompt: 'Stored in VS Code SecretStorage. Or set XAI_API_KEY in your environment.',
        password: true,
        placeHolder: 'xAI API key from console.x.ai'
    });
    if (key?.trim()) {
        await setGrokApiKey(secrets, key.trim());
        vscode.window.showInformationMessage('Teacher saved your Grok API key.');
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
        title: 'Teacher: Deepgram API Key',
        prompt: 'Stored in VS Code SecretStorage. Or set DEEPGRAM_API_KEY in your environment.',
        password: true,
        placeHolder: 'Deepgram API key'
    });
    if (key?.trim()) {
        await setDeepgramApiKey(secrets, key.trim());
        vscode.window.showInformationMessage('Teacher saved your Deepgram API key.');
    }
}
