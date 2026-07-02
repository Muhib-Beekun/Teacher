export interface InferenceModelOption {
    id: string;
    label: string;
    provider: 'openai' | 'xai' | 'other';
}

/** Common OpenAI-compatible models for the Configuration dropdown. */
export const INFERENCE_MODEL_OPTIONS: InferenceModelOption[] = [
    { id: 'gpt-4o', label: 'OpenAI GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', label: 'OpenAI GPT-4o mini', provider: 'openai' },
    { id: 'gpt-4.1', label: 'OpenAI GPT-4.1', provider: 'openai' },
    { id: 'gpt-4.1-mini', label: 'OpenAI GPT-4.1 mini', provider: 'openai' },
    { id: 'o3-mini', label: 'OpenAI o3-mini', provider: 'openai' },
    { id: 'grok-4-fast-reasoning', label: 'xAI Grok 4 Fast (reasoning)', provider: 'xai' },
    { id: 'grok-4-fast-non-reasoning', label: 'xAI Grok 4 Fast', provider: 'xai' },
    { id: 'llama-3.3-70b-versatile', label: 'Groq Llama 3.3 70B', provider: 'other' },
    { id: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'other' },
    { id: 'qwen2.5-coder:14b', label: 'Ollama qwen2.5-coder:14b (local)', provider: 'other' }
];

export const DEFAULT_INFERENCE_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_INFERENCE_MODEL = 'gpt-4o-mini';
