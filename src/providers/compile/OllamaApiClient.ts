import * as vscode from 'vscode';

export class OllamaApiClient {
    constructor(private readonly output: vscode.OutputChannel) { }

    public getConfiguredModel(): string {
        return vscode.workspace
            .getConfiguration('teacher.inference.ollama')
            .get<string>('model', 'qwen2.5-coder:14b');
    }

    private getBaseUrl(): string {
        return vscode.workspace
            .getConfiguration('teacher.inference.ollama')
            .get<string>('url', 'http://127.0.0.1:11434')
            .replace(/\/$/, '');
    }

    private getTimeoutMs(): number {
        return vscode.workspace
            .getConfiguration('teacher.inference.ollama')
            .get<number>('timeoutMs', 120_000);
    }

    public async isAvailable(): Promise<boolean> {
        try {
            const res = await fetch(`${this.getBaseUrl()}/api/tags`, {
                signal: AbortSignal.timeout(3000)
            });
            if (!res.ok) {
                return false;
            }
            const json = (await res.json()) as { models?: { name?: string }[] };
            const names = (json.models ?? []).map((m) => m.name ?? '').filter(Boolean);
            if (names.length === 0) {
                return false;
            }
            const wanted = this.getConfiguredModel();
            if (names.some((n) => n === wanted || n.startsWith(`${wanted}:`))) {
                return true;
            }
            // Model tag may differ (e.g. qwen2.5-coder:14b vs qwen2.5-coder:latest)
            const base = wanted.split(':')[0];
            return names.some((n) => n.startsWith(`${base}:`));
        } catch {
            return false;
        }
    }

    public async chat(system: string, user: string, temperature = 0.15): Promise<string> {
        const baseUrl = this.getBaseUrl();
        const model = this.getConfiguredModel();
        const timeoutMs = this.getTimeoutMs();

        this.output.appendLine(`[ollama] ${model} request…`);

        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user }
                ],
                stream: false,
                options: { temperature }
            }),
            signal: AbortSignal.timeout(timeoutMs)
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Ollama API failed (${response.status})${body ? `: ${body.slice(0, 200)}` : ''}`);
        }

        const json = (await response.json()) as {
            message?: { content?: string };
        };
        const text = json.message?.content?.trim();
        if (!text) {
            throw new Error('Ollama returned empty response');
        }
        return text;
    }
}
