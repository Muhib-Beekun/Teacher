export type CompileProviderId = 'cloud' | 'ollama' | 'vscode-lm' | 'none';

export type ProviderSetting = 'auto' | 'cloud' | 'ollama' | 'vscode-lm';

export interface ProviderAvailability {
    cloud: boolean;
    ollama: boolean;
    vscodeLm: boolean;
}

export interface ResolveCompileProviderInput {
    setting: ProviderSetting;
    remote: boolean;
    allowVscodeLmOnRemote: boolean;
    available: ProviderAvailability;
}

export interface ResolveCompileProviderResult {
    provider: CompileProviderId;
    reason: string;
}

export function isEmptyLlmResponse(text: string | undefined | null): boolean {
    return !text || text.trim().length === 0;
}

/** Pick cloud or ollama when vscode-lm is unusable (explicit override or empty response). */
export function pickNonVscodeLmFallback(available: ProviderAvailability): 'cloud' | 'ollama' | null {
    if (available.cloud) {
        return 'cloud';
    }
    if (available.ollama) {
        return 'ollama';
    }
    return null;
}

export function planEmptyVscodeLmFallback(
    responseText: string,
    available: ProviderAvailability
): { action: 'use-primary' } | { action: 'fallback'; provider: 'cloud' | 'ollama' } | { action: 'fail'; message: string } {
    if (!isEmptyLlmResponse(responseText)) {
        return { action: 'use-primary' };
    }
    const fallback = pickNonVscodeLmFallback(available);
    if (fallback) {
        return { action: 'fallback', provider: fallback };
    }
    return {
        action: 'fail',
        message:
            'VS Code LM returned empty output (common on remote SSH hosts). Set teacher.compile.provider to cloud or ollama, configure INFERENCE_API_KEY, start Ollama on the remote machine, or enable teacher.compile.vscodeLm.allowOnRemote if you intend to use Copilot there.'
    };
}

export function resolveCompileProvider(input: ResolveCompileProviderInput): ResolveCompileProviderResult {
    const { setting, remote, allowVscodeLmOnRemote, available } = input;
    const skipVscodeLmOnRemote = remote && !allowVscodeLmOnRemote;

    if (setting === 'cloud') {
        if (available.cloud) {
            return { provider: 'cloud', reason: 'explicit provider=cloud' };
        }
        return { provider: 'none', reason: 'explicit provider=cloud but cloud API key is not configured' };
    }

    if (setting === 'ollama') {
        if (available.ollama) {
            return { provider: 'ollama', reason: 'explicit provider=ollama' };
        }
        return { provider: 'none', reason: 'explicit provider=ollama but Ollama is not reachable' };
    }

    if (setting === 'vscode-lm') {
        if (skipVscodeLmOnRemote) {
            const fallback = pickNonVscodeLmFallback(available);
            if (fallback) {
                return {
                    provider: fallback,
                    reason: `remote host: vscode-lm disabled (teacher.compile.vscodeLm.allowOnRemote=false); using ${fallback} instead of explicit vscode-lm`
                };
            }
            return {
                provider: 'none',
                reason:
                    'remote host: vscode-lm disabled and no cloud/ollama fallback. Set INFERENCE_API_KEY, start Ollama, or enable teacher.compile.vscodeLm.allowOnRemote.'
            };
        }
        if (available.vscodeLm) {
            return { provider: 'vscode-lm', reason: 'explicit provider=vscode-lm' };
        }
        return { provider: 'none', reason: 'explicit provider=vscode-lm but no vscode.lm models are available' };
    }

    // auto
    if (available.ollama) {
        return { provider: 'ollama', reason: remote ? 'auto on remote: Ollama available' : 'auto: Ollama available' };
    }
    if (available.cloud) {
        return { provider: 'cloud', reason: remote ? 'auto on remote: cloud API configured' : 'auto: cloud API configured' };
    }
    if (available.vscodeLm && !skipVscodeLmOnRemote) {
        const suffix = remote ? ' (vscode-lm allowed on remote)' : '';
        return { provider: 'vscode-lm', reason: `auto: vscode.lm models available${suffix}` };
    }
    if (available.vscodeLm && skipVscodeLmOnRemote) {
        return {
            provider: 'none',
            reason:
                'auto on remote: only vscode.lm is available but it is disabled (teacher.compile.vscodeLm.allowOnRemote=false). Configure cloud or Ollama.'
        };
    }
    return { provider: 'none', reason: 'auto: no compile provider available' };
}
