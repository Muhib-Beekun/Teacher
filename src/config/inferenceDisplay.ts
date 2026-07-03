import { ResolvedInferenceConfig, InferenceConfigSource } from './resolveInferenceConfig';

export type LlmKeySource = 'env' | 'secrets' | 'none';

function sourceLabel(source: InferenceConfigSource): string {
    switch (source) {
        case 'env':
            return '.env';
        case 'settings':
            return 'settings';
        default:
            return 'defaults';
    }
}

/** Human-readable source for URL + model (may differ). */
export function formatInferenceConfigSource(baseUrlSource: InferenceConfigSource, modelSource: InferenceConfigSource): string {
    if (baseUrlSource === modelSource) {
        switch (baseUrlSource) {
            case 'env':
                return 'from .env';
            case 'settings':
                return 'from settings';
            default:
                return 'defaults';
        }
    }
    return `URL from ${sourceLabel(baseUrlSource)}, model from ${sourceLabel(modelSource)}`;
}

export function formatLlmKeyStatus(keySource: LlmKeySource): string {
    switch (keySource) {
        case 'env':
            return 'API key from .env';
        case 'secrets':
            return 'API key in VS Code secrets';
        default:
            return 'API key not set';
    }
}

export function buildCloudInferenceLabel(cfg: ResolvedInferenceConfig, keySource: LlmKeySource): string {
    const source = formatInferenceConfigSource(cfg.baseUrlSource, cfg.modelSource);
    return `${cfg.model} @ ${cfg.baseUrl} (${source}; ${formatLlmKeyStatus(keySource)})`;
}

export function buildActiveCompileLabel(compileLabel: string, compileProviderSetting: string, activeProvider: string): string {
    if (compileProviderSetting === 'auto' && activeProvider !== 'cloud') {
        return `${compileLabel} (compile provider: Auto — cloud skipped while ${activeProvider} is available)`;
    }
    return compileLabel;
}
