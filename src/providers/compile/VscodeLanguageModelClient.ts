import * as vscode from 'vscode';

/**
 * VS Code Language Model client (Copilot, other authenticated providers).
 * Uses the official vscode.lm API — no separate API key required.
 */
export class VscodeLanguageModelClient {
    private lastSelectedModel: vscode.LanguageModelChat | null = null;

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
        if (this.lastSelectedModel) {
            return `${this.lastSelectedModel.name} (${this.lastSelectedModel.family})`;
        }
        return 'vscode.lm (auto-selected)';
    }

    /**
     * Sends a chat request using proper System + User roles and collects the full response.
     * For compile/polish use cases we return the complete text.
     */
    public async chat(system: string, user: string, temperature = 0.15): Promise<string> {
        const models = await vscode.lm.selectChatModels();

        if (models.length === 0) {
            throw new Error('No language models available via vscode.lm. Sign into GitHub Copilot or add a model provider in VS Code settings.');
        }

        // Prefer stronger coding models when available
        const preferred = models.find(m => 
            m.family.toLowerCase().includes('claude') ||
            m.family.toLowerCase().includes('sonnet') ||
            m.family.toLowerCase().includes('gpt-4o') ||
            m.family.toLowerCase().includes('gpt-4')
        ) || models[0];

        this.lastSelectedModel = preferred;
        this.output.appendLine(`[vscode.lm] Using model: ${preferred.name} (${preferred.family})`);

        const messages = [
            vscode.LanguageModelChatMessage.System(system),
            vscode.LanguageModelChatMessage.User(user)
        ];

        const response = await preferred.sendRequest(messages, {
            // temperature is not directly supported in all model families via this API
        });

        let fullText = '';
        for await (const fragment of response.text) {
            fullText += fragment;
        }

        return fullText.trim();
    }
}
