export interface InferenceModelOption {
    id: string;
    label: string;
    provider: string;
}

/** Common OpenAI-compatible models for the Configuration combobox. */
export const INFERENCE_MODEL_OPTIONS: InferenceModelOption[] = [
    // OpenAI
    { id: 'gpt-4o', label: 'OpenAI GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', label: 'OpenAI GPT-4o mini', provider: 'openai' },
    { id: 'gpt-4.1', label: 'OpenAI GPT-4.1', provider: 'openai' },
    { id: 'gpt-4.1-mini', label: 'OpenAI GPT-4.1 mini', provider: 'openai' },
    { id: 'o3-mini', label: 'OpenAI o3-mini', provider: 'openai' },
    // xAI
    { id: 'grok-4-fast-reasoning', label: 'xAI Grok 4 Fast (reasoning)', provider: 'xai' },
    { id: 'grok-4-fast-non-reasoning', label: 'xAI Grok 4 Fast', provider: 'xai' },
    { id: 'grok-3', label: 'xAI Grok 3', provider: 'xai' },
    { id: 'grok-3-mini', label: 'xAI Grok 3 Mini', provider: 'xai' },
    // Groq
    { id: 'llama-3.3-70b-versatile', label: 'Groq Llama 3.3 70B', provider: 'groq' },
    { id: 'llama-3.1-8b-instant', label: 'Groq Llama 3.1 8B', provider: 'groq' },
    { id: 'qwen/qwen3-32b', label: 'Groq Qwen3 32B', provider: 'groq' },
    // DeepSeek
    { id: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek' },
    { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', provider: 'deepseek' },
    // OpenRouter (examples)
    { id: 'openai/gpt-4o-mini', label: 'OpenRouter GPT-4o mini', provider: 'openrouter' },
    { id: 'anthropic/claude-sonnet-4', label: 'OpenRouter Claude Sonnet 4', provider: 'openrouter' },
    { id: 'google/gemini-2.0-flash-001', label: 'OpenRouter Gemini 2.0 Flash', provider: 'openrouter' },
    // Together
    { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Together Llama 3.1 70B', provider: 'together' },
    // Fireworks
    { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', label: 'Fireworks Llama 3.3 70B', provider: 'fireworks' },
    // Mistral
    { id: 'mistral-small-latest', label: 'Mistral Small', provider: 'mistral' },
    { id: 'mistral-large-latest', label: 'Mistral Large', provider: 'mistral' },
    // Cerebras
    { id: 'llama-3.3-70b', label: 'Cerebras Llama 3.3 70B', provider: 'cerebras' },
    // Gemini OpenAI-compat
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' },
    // Ollama OpenAI-compat
    { id: 'qwen2.5-coder:14b', label: 'Ollama qwen2.5-coder:14b', provider: 'ollama-openai' },
    { id: 'qwen2.5-coder:32b', label: 'Ollama qwen2.5-coder:32b', provider: 'ollama-openai' },
    { id: 'llama3.1:8b', label: 'Ollama llama3.1:8b', provider: 'ollama-openai' }
];

export const DEFAULT_INFERENCE_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_INFERENCE_MODEL = 'gpt-4o-mini';
