import * as vscode from 'vscode';

const DEEPGRAM_KEY = 'teacher.deepgram.apiKey';
const OPENAI_KEY = 'teacher.openai.apiKey';

export async function getDeepgramApiKey(secrets: vscode.SecretStorage): Promise<string | undefined> {
    return secrets.get(DEEPGRAM_KEY);
}

export async function setDeepgramApiKey(secrets: vscode.SecretStorage, key: string): Promise<void> {
    await secrets.store(DEEPGRAM_KEY, key);
}

export async function promptDeepgramApiKey(secrets: vscode.SecretStorage): Promise<void> {
    const key = await vscode.window.showInputBox({
        title: 'Teacher: Deepgram API Key',
        prompt: 'Stored in VS Code SecretStorage only.',
        password: true,
        placeHolder: 'Deepgram API key (BYOK)'
    });
    if (key?.trim()) {
        await setDeepgramApiKey(secrets, key.trim());
        vscode.window.showInformationMessage('Teacher saved your Deepgram API key.');
    }
}

export async function getOpenAiApiKey(secrets: vscode.SecretStorage): Promise<string | undefined> {
    return secrets.get(OPENAI_KEY);
}
