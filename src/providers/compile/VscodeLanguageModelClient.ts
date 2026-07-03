import * as vscode from 'vscode';

/**
 * VS Code Language Model API (GitHub Copilot and other host-registered models).
 * @see https://code.visualstudio.com/api/extension-guides/ai/language-model
 */
export class VscodeLanguageModelClient {
    private lastModelLabel = '';

    constructor(private readonly output: vscode.OutputChannel) {}

    public async isAvailable(): Promise<boolean> {
        try {
            if (!vscode.lm?.selectChatModels) {
                return false;
            }
            const models = await vscode.lm.selectChatModels();
            return models.length > 0;
        } catch {
            return false;
        }
    }

    public getConfiguredModel(): string {
        return this.lastModelLabel || 'vscode.lm';
    }

    public async chat(system: string, user: string, _temperature = 0.15): Promise<{ text: string; tokensIn?: number; tokensOut?: number }> {
        const models = await vscode.lm.selectChatModels();
        if (!models.length) {
            throw new Error(
                'No vscode.lm models available. In VS Code, sign into GitHub Copilot. Cursor does not expose this API yet.'
            );
        }

        const preferred =
            models.find((m) => {
                const hay = `${m.name} ${m.family} ${m.vendor}`.toLowerCase();
                return (
                    hay.includes('gpt-4o') ||
                    hay.includes('claude') ||
                    hay.includes('sonnet') ||
                    hay.includes('gpt-4')
                );
            }) ?? models[0];

        this.lastModelLabel = `${preferred.name} (${preferred.family})`;
        this.output.appendLine(`[vscode.lm] model: ${this.lastModelLabel}`);

        const prompt =
            system.trim().length > 0
                ? `${system.trim()}\n\n---\n\n${user}`
                : user;

        const response = await preferred.sendRequest([vscode.LanguageModelChatMessage.User(prompt)]);

        let fullText = '';
        for await (const fragment of response.text) {
            fullText += fragment;
        }
        return { text: fullText.trim() };
    }
}
