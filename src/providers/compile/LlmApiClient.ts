import * as vscode from 'vscode';
import { DEFAULT_INFERENCE_BASE_URL, DEFAULT_INFERENCE_MODEL } from '../../config/inferenceModels';
import { readInferenceBaseUrlFromEnv, readInferenceModelFromEnv } from '../../config/inferenceEnv';

/** OpenAI-compatible /chat/completions client (Teacher › Inference › Llm). */
export class LlmApiClient {
    constructor(
        private readonly getApiKey: () => Promise<string | undefined>,
        private readonly output: vscode.OutputChannel
    ) { }

    public async isAvailable(): Promise<boolean> {
        const key = await this.getApiKey();
        return Boolean(key?.trim());
    }

    public getConfiguredModel(): string {
        const fromEnv = readInferenceModelFromEnv();
        if (fromEnv) {
            return fromEnv;
        }
        const configured = vscode.workspace
            .getConfiguration('teacher.inference.llm')
            .get<string>('model', '')
            .trim();
        return configured || DEFAULT_INFERENCE_MODEL;
    }

    public getBaseUrl(): string {
        const fromEnv = readInferenceBaseUrlFromEnv();
        if (fromEnv) {
            return fromEnv;
        }
        const configured = vscode.workspace
            .getConfiguration('teacher.inference.llm')
            .get<string>('baseUrl', '')
            .trim();
        return (configured || DEFAULT_INFERENCE_BASE_URL).replace(/\/$/, '');
    }

    public async chat(system: string, user: string, temperature = 0.15): Promise<{ text: string; tokensIn?: number; tokensOut?: number }> {
        const key = await this.getApiKey();
        if (!key) {
            throw new Error(
                'Inference API key not set. Use Teacher Configuration or set INFERENCE_API_KEY / OPENAI_API_KEY in .env.'
            );
        }

        const baseUrl = this.getBaseUrl();
        const model = this.getConfiguredModel();
        const timeoutMs = vscode.workspace
            .getConfiguration('teacher.inference.llm')
            .get<number>('timeoutMs', 45_000);

        this.output.appendLine(`[inference] ${model} @ ${baseUrl}`);

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
            throw new Error(`Inference API failed (${response.status})${body ? `: ${body.slice(0, 200)}` : ''}`);
        }

        const json = (await response.json()) as {
            choices?: { message?: { content?: string } }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const text = json.choices?.[0]?.message?.content?.trim();
        if (!text) {
            throw new Error('Inference API returned empty response');
        }
        return {
            text,
            tokensIn: json.usage?.prompt_tokens,
            tokensOut: json.usage?.completion_tokens
        };
    }
}
