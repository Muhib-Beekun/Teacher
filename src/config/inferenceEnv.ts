/** Normalize OpenAI-compatible base URL (some hosts store full /chat/completions path). */
export function normalizeInferenceBaseUrl(url: string): string {
    return url.trim().replace(/\/chat\/completions\/?$/i, '').replace(/\/$/, '');
}

/** Env vars for cloud inference (see `.env.example`, docs/SETUP.md, CHANGELOG.md). */
export const INFERENCE_ENV_KEYS = {
    apiKey: ['INFERENCE_API_KEY', 'OPENAI_API_KEY', 'XAI_API_KEY', 'GROK_API_KEY'],
    baseUrl: ['INFERENCE_BASE_URL'],
    model: ['INFERENCE_MODEL', 'OPENAI_MODEL']
} as const;

export function readInferenceBaseUrlFromEnv(): string | undefined {
    const raw = process.env.INFERENCE_BASE_URL?.trim();
    return raw ? normalizeInferenceBaseUrl(raw) : undefined;
}

export function readInferenceModelFromEnv(): string | undefined {
    return process.env.INFERENCE_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || undefined;
}

export function readInferenceApiKeyFromEnv(): string | undefined {
    for (const key of INFERENCE_ENV_KEYS.apiKey) {
        const val = process.env[key]?.trim();
        if (val) {
            return val;
        }
    }
    return undefined;
}
