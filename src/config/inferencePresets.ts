/** Quick-start presets for the Configuration UI. Local/open-source first, then cloud. */
export interface InferenceProviderPreset {
    id: string;
    label: string;
    baseUrl: string;
    model: string;
    keyHint: string;
    docsUrl?: string;
}

export const INFERENCE_PROVIDER_PRESETS: InferenceProviderPreset[] = [
    // --- Local / open-source (alphabetical) ---
    {
        id: 'llamacpp',
        label: 'llama.cpp server',
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'default',
        keyHint: '(not required)',
        docsUrl: 'https://github.com/ggml-org/llama.cpp/blob/master/examples/server/README.md'
    },
    {
        id: 'lmstudio',
        label: 'LM Studio',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'default',
        keyHint: '(not required)',
        docsUrl: 'https://lmstudio.ai/'
    },
    {
        id: 'ollama-openai',
        label: 'Ollama',
        baseUrl: 'http://127.0.0.1:11434/v1',
        model: 'qwen2.5-coder:14b',
        keyHint: '(not required)',
        docsUrl: 'https://ollama.com/'
    },
    {
        id: 'vllm',
        label: 'vLLM',
        baseUrl: 'http://127.0.0.1:8000/v1',
        model: 'default',
        keyHint: '(not required)',
        docsUrl: 'https://docs.vllm.ai/'
    },
    // --- Cloud / subscription (alphabetical) ---
    {
        id: 'cerebras',
        label: 'Cerebras',
        baseUrl: 'https://api.cerebras.ai/v1',
        model: 'llama-3.3-70b',
        keyHint: 'csk-…',
        docsUrl: 'https://cloud.cerebras.ai/'
    },
    {
        id: 'deepseek',
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        keyHint: 'sk-…',
        docsUrl: 'https://platform.deepseek.com/'
    },
    {
        id: 'fireworks',
        label: 'Fireworks',
        baseUrl: 'https://api.fireworks.ai/inference/v1',
        model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
        keyHint: 'fw_…',
        docsUrl: 'https://fireworks.ai/account/api-keys'
    },
    {
        id: 'gemini',
        label: 'Google Gemini (OpenAI compat)',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.0-flash',
        keyHint: 'AIza…',
        docsUrl: 'https://aistudio.google.com/apikey'
    },
    {
        id: 'groq',
        label: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile',
        keyHint: 'gsk_…',
        docsUrl: 'https://console.groq.com/keys'
    },
    {
        id: 'mistral',
        label: 'Mistral',
        baseUrl: 'https://api.mistral.ai/v1',
        model: 'mistral-small-latest',
        keyHint: '…',
        docsUrl: 'https://console.mistral.ai/api-keys'
    },
    {
        id: 'openai',
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        keyHint: 'sk-…',
        docsUrl: 'https://platform.openai.com/api-keys'
    },
    {
        id: 'openrouter',
        label: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'openai/gpt-4o-mini',
        keyHint: 'sk-or-…',
        docsUrl: 'https://openrouter.ai/keys'
    },
    {
        id: 'together',
        label: 'Together AI',
        baseUrl: 'https://api.together.xyz/v1',
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        keyHint: '…',
        docsUrl: 'https://api.together.xyz/settings/api-keys'
    },
    {
        id: 'xai',
        label: 'xAI Grok',
        baseUrl: 'https://api.x.ai/v1',
        model: 'grok-4-fast-reasoning',
        keyHint: 'xai-…',
        docsUrl: 'https://console.x.ai/'
    }
];

/** Common OpenAI-compatible base URLs for the Settings combobox. */
export const COMMON_INFERENCE_BASE_URLS: string[] = [
    ...new Set(INFERENCE_PROVIDER_PRESETS.map((p) => p.baseUrl))
];

export function getInferencePreset(id: string): InferenceProviderPreset | undefined {
    return INFERENCE_PROVIDER_PRESETS.find((p) => p.id === id);
}

/** Match preset by URL+model, then by URL alone (env may use a different model on the same host). */
export function matchInferencePreset(baseUrl: string, model: string): string {
    const normUrl = baseUrl.replace(/\/$/, '').toLowerCase();
    const normModel = model.trim().toLowerCase();

    for (const preset of INFERENCE_PROVIDER_PRESETS) {
        if (
            preset.baseUrl.replace(/\/$/, '').toLowerCase() === normUrl
            && preset.model.toLowerCase() === normModel
        ) {
            return preset.id;
        }
    }

    for (const preset of INFERENCE_PROVIDER_PRESETS) {
        if (preset.baseUrl.replace(/\/$/, '').toLowerCase() === normUrl) {
            return preset.id;
        }
    }

    return 'custom';
}
