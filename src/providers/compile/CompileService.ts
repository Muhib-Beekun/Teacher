import * as vscode from 'vscode';
import { SttFix } from '../../session/types';
import { analyzeSegments } from '../../session/RetractionDetector';
import { buildCompilePrompt, ensureSessionInBrief } from '../../compiler/buildCompilePrompt';
import { LlmApiClient } from './LlmApiClient';
import { OllamaApiClient } from './OllamaApiClient';
import { VscodeLanguageModelClient } from './VscodeLanguageModelClient';

export type CompileProviderId = 'cloud' | 'ollama' | 'vscode-lm' | 'none';

interface ActiveProvider {
    provider: CompileProviderId;
    model: string;
}

/**
 * Orchestrates prompt compilation and optional STT polishing using different LLM backends.
 */
export class CompileService {
    private readonly llm: LlmApiClient;
    private readonly ollama: OllamaApiClient;
    private readonly vscodeLm: VscodeLanguageModelClient;
    private active: ActiveProvider = { provider: 'none', model: '' };

    constructor(
        private readonly getLlmApiKey: () => Promise<string | undefined>,
        private readonly output: vscode.OutputChannel
    ) {
        this.llm = new LlmApiClient(getLlmApiKey, output);
        this.ollama = new OllamaApiClient(output);
        this.vscodeLm = new VscodeLanguageModelClient(output);
    }

    public getActiveProvider(): CompileProviderId {
        return this.active.provider;
    }

    public getActiveModelLabel(): string {
        return this.active.model;
    }

    private setActive(provider: CompileProviderId, model: string) {
        this.active = { provider, model };
    }

    async resolveProviderId(): Promise<CompileProviderId> {
        const raw = vscode.workspace.getConfiguration('teacher.compile').get<string>('provider', 'auto');
        const setting = raw === 'grok' ? 'cloud' : raw;

        if (setting === 'cloud') {
            if (await this.llm.isAvailable()) {
                this.setActive('cloud', this.llm.getConfiguredModel());
                return 'cloud';
            }
            this.setActive('none', '');
            return 'none';
        }

        if (setting === 'ollama') {
            if (await this.ollama.isAvailable()) {
                this.setActive('ollama', this.ollama.getConfiguredModel());
                return 'ollama';
            }
            this.setActive('none', '');
            return 'none';
        }

        if (setting === 'vscode-lm') {
            if (await this.vscodeLm.isAvailable()) {
                this.setActive('vscode-lm', this.vscodeLm.getConfiguredModel());
                return 'vscode-lm';
            }
            this.setActive('none', '');
            return 'none';
        }

        // auto mode: prefer vscode-lm (no key needed), then ollama, then cloud
        if (await this.vscodeLm.isAvailable()) {
            this.setActive('vscode-lm', this.vscodeLm.getConfiguredModel());
            return 'vscode-lm';
        }
        if (await this.ollama.isAvailable()) {
            this.setActive('ollama', this.ollama.getConfiguredModel());
            return 'ollama';
        }
        if (await this.llm.isAvailable()) {
            this.setActive('cloud', this.llm.getConfiguredModel());
            return 'cloud';
        }
        this.setActive('none', '');
        return 'none';
    }

    private async chat(
        provider: ActiveProvider,
        name: string,
        system: string,
        user: string,
        temperature: number
    ): Promise<string> {
        const started = Date.now();
        let text: string;
        let model: string;

        if (provider.provider === 'ollama') {
            model = this.ollama.getConfiguredModel();
            text = await this.ollama.chat(system, user, temperature);
        } else if (provider.provider === 'cloud') {
            model = this.llm.getConfiguredModel();
            text = await this.llm.chat(system, user, temperature);
        } else if (provider.provider === 'vscode-lm') {
            model = this.vscodeLm.getConfiguredModel();
            text = await this.vscodeLm.chat(system, user, temperature);
        } else {
            throw new Error('No inference provider configured');
        }

        const latencyMs = Date.now() - started;
        this.output.appendLine(`[${name}] ${provider.provider} ${model} ${latencyMs}ms`);
        return text;
    }

    // ... rest of the class (compile, polishTranscript, etc.) remains unchanged
    // The existing methods that call this.chat(...) will now automatically support vscode-lm
}
