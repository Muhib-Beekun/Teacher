import * as vscode from 'vscode';

export class GrokApiClient {
    constructor(
        private readonly getApiKey: () => Promise<string | undefined>,
        private readonly output: vscode.OutputChannel
    ) { }

    public async isAvailable(): Promise<boolean> {
        const key = await this.getApiKey();
        return Boolean(key?.trim());
    }

    public getConfiguredModel(): string {
        const fromEnv = process.env.CLOUD_LLM_GENERATE_MODEL?.trim();
        if (fromEnv) {
            return fromEnv;
        }
        return vscode.workspace
            .getConfiguration('teacher.inference.grok')
            .get<string>('model', 'grok-4-fast-reasoning');
    }

    public async chat(system: string, user: string, temperature = 0.15): Promise<string> {
        const key = await this.getApiKey();
        if (!key) {
            throw new Error('Grok API key not set — run Teacher: Set Grok API Key or set XAI_API_KEY');
        }

        const baseUrl = vscode.workspace
            .getConfiguration('teacher.inference.grok')
            .get<string>('url', 'https://api.x.ai/v1')
            .replace(/\/$/, '');
        const model = this.getConfiguredModel();
        const timeoutMs = vscode.workspace
            .getConfiguration('teacher.inference.grok')
            .get<number>('timeoutMs', 45_000);

        this.output.appendLine(`[grok] ${model} request…`);

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user }
                ],
                temperature
            }),
            signal: AbortSignal.timeout(timeoutMs)
        });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Grok API failed (${response.status})${body ? `: ${body.slice(0, 200)}` : ''}`);
        }

        const json = (await response.json()) as {
            choices?: { message?: { content?: string } }[];
        };
        const text = json.choices?.[0]?.message?.content?.trim();
        if (!text) {
            throw new Error('Grok returned empty response');
        }
        return text;
    }
}
