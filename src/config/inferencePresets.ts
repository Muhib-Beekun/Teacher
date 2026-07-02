/** Quick-start presets for the Configuration UI. Shipped default is OpenAI. */
export interface InferenceProviderPreset {
    id: string;
    label: string;
    baseUrl: string;
    model: string;
    keyHint: string;
    docsUrl?: string;
}

export const INFERENCE_PROVIDER_PRESETS: InferenceProviderPreset[] = [
    {
        id: 'openai',
        label: 'OpenAI (default)',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        keyHint: 'sk-…',
        docsUrl: 'https://platform.openai.com/api-keys'
    },
    {
        id: 'xai',
        label: 'xAI Grok',
        baseUrl: 'https://api.x.ai/v1',
        model: 'grok-4-fast-reasoning',
        keyHint: 'xai-…',
        docsUrl: 'https://console.x.ai/'
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
        id: 'deepseek',
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        keyHint: 'sk-…',
        docsUrl: 'https://platform.deepseek.com/'
    }
];

export function getInferencePreset(id: string): InferenceProviderPreset | undefined {
    return INFERENCE_PROVIDER_PRESETS.find((p) => p.id === id);
}

export function matchInferencePreset(baseUrl: string, model: string): string {
    const normUrl = baseUrl.replace(/\/$/, '').toLowerCase();
    const normModel = model.trim().toLowerCase();
    for (const preset of INFERENCE_PROVIDER_PRESETS) {
        if (
            preset.baseUrl.replace(/\/$/, '').toLowerCase() === normUrl &&
            preset.model.toLowerCase() === normModel
        ) {
            return preset.id;
        }
    }
    return 'custom';
}
