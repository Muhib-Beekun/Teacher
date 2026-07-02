import * as vscode from 'vscode';

/**
 * VS Code Language Model client (Copilot, other authenticated providers).
 * Uses the official vscode.lm API — no separate API key required.
 */
export class VscodeLanguageModelClient {
    constructor(
        private readonly output: vscode.OutputChannel
    ) {}

    public async isAvailable(): Promise<boolean> {
        try {
            const models = await vscode.lm.selectChatModels();
            return models.length > 0;
        } catch {
            return false;
        }
    }

    public getConfiguredModel(): string {
        // vscode.lm doesn't expose a single "configured model" easily.
        // We return a label that will be updated after selection.
        return 'vscode.lm (auto-selected)';
    }

    /**
     * Streams a chat request and collects the full response.
     * For compile/polish use cases we return the complete text.
     */
    public async chat(system: string, user: string, temperature = 0.15): Promise<string> {
        const models = await vscode.lm.selectChatModels();

        if (models.length === 0) {
            throw new Error('No language models available via vscode.lm. Sign into GitHub Copilot or add a model provider in VS Code settings.');
        }

        // Prefer models that look like good coding models
        const preferred = models.find(m => 
            m.family.toLowerCase().includes('gpt') || 
            m.family.toLowerCase().includes('claude') ||
            m.family.toLowerCase().includes('sonnet')
        ) || models[0];

        this.output.appendLine(`[vscode.lm] Using model: ${preferred.name} (${preferred.family})`);

        const messages = [
            vscode.LanguageModelChatMessage.User(system + '\n\n' + user)  // Simple approach; could split into system/user
        ];

        const response = await preferred.sendRequest(messages, {
            // We can pass temperature in some versions via model options, but it's limited.
        });

        let fullText = '';
        for await (const fragment of response.text) {
            fullText += fragment;
        }

        return fullText.trim();
    }
}
