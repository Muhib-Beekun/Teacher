import * as vscode from 'vscode';

import { compileSession, CompileMode } from '../../compiler/TeacherCompiler';
import { detectPhraseFixes } from '../../compiler/parseCompiledMarkdown';
import {
    buildReformatCompileUser,
    finalizeLlmCompiledBrief,
    REFORMAT_COMPILE_SYSTEM
} from '../../compiler/finalizeLlmBrief';
import { VoiceSessionContext } from '../../context/VoiceSessionContext';
import { CompiledBrief } from '../../session/types';
import { SttFix } from '../../session/types';
import { analyzeSegments } from '../../session/RetractionDetector';
import { buildCompilePrompt } from '../../compiler/buildCompilePrompt';
import { LlmApiClient } from './LlmApiClient';
import { OllamaApiClient } from './OllamaApiClient';
import { VscodeLanguageModelClient } from './VscodeLanguageModelClient';

export type CompileProviderId = 'cloud' | 'ollama' | 'vscode-lm' | 'none';

type ActiveProvider = 'cloud' | 'ollama' | 'vscode-lm' | 'none';

export class CompileService {
    private activeModel = '';
    private activeProvider: ActiveProvider = 'none';
    private readonly llm: LlmApiClient;
    private readonly ollama: OllamaApiClient;
    private readonly vscodeLm: VscodeLanguageModelClient;

    constructor(
        private readonly output: vscode.OutputChannel,
        getLlmApiKey: () => Promise<string | undefined>
    ) {
        this.llm = new LlmApiClient(getLlmApiKey, output);
        this.ollama = new OllamaApiClient(output);
        this.vscodeLm = new VscodeLanguageModelClient(output);
    }

    async compile(
        rawSegments: string[],
        ctx: VoiceSessionContext,
        mode: CompileMode,
        priorBrief?: CompiledBrief
    ): Promise<CompiledBrief> {
        if (mode === 'verbatim') {
            return compileSession(rawSegments, ctx, mode);
        }

        const provider = await this.resolveProviderId();
        if (provider === 'none') {
            throw new Error(
                'No compile provider available. Set an inference API key, start Ollama, choose VS Code LM (Copilot), or use verbatim mode.'
            );
        }

        const started = Date.now();
        const brief = await this.compileWithLlm(rawSegments, ctx, priorBrief, provider);
        const ms = Date.now() - started;
        this.output.appendLine(`[compile:${provider}] done in ${ms}ms`);
        return brief;
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

        // auto: Ollama → cloud API → host LM (Copilot in VS Code)
        if (await this.ollama.isAvailable()) {
            this.setActive('ollama', this.ollama.getConfiguredModel());
            return 'ollama';
        }
        if (await this.llm.isAvailable()) {
            this.setActive('cloud', this.llm.getConfiguredModel());
            return 'cloud';
        }
        if (await this.vscodeLm.isAvailable()) {
            this.setActive('vscode-lm', this.vscodeLm.getConfiguredModel());
            return 'vscode-lm';
        }
        this.setActive('none', '');
        return 'none';
    }

    getActiveModelLabel(): string {
        return this.activeModel;
    }

    getActiveProvider(): ActiveProvider {
        return this.activeProvider;
    }

    async isLlmConfigured(): Promise<boolean> {
        return this.llm.isAvailable();
    }

    async isOllamaAvailable(): Promise<boolean> {
        return this.ollama.isAvailable();
    }

    async isVscodeLmAvailable(): Promise<boolean> {
        return this.vscodeLm.isAvailable();
    }

    async isPolishEnabled(): Promise<boolean> {
        const enabled = vscode.workspace.getConfiguration('teacher.compile').get<boolean>('polishStt', true);
        if (!enabled) {
            return false;
        }
        const provider = await this.resolveProviderId();
        return provider !== 'none';
    }

    async polishTranscript(raw: string, ctx: VoiceSessionContext): Promise<string> {
        if (!(await this.isPolishEnabled())) {
            return raw;
        }

        const provider = await this.resolveProviderId();
        if (provider === 'none') {
            return raw;
        }

        const system = `Fix speech-to-text errors in developer voice notes. Return ONLY the corrected transcript. No quotes, no markdown, no explanation.

Common fixes (apply when context fits):
- "Obama" / "olama" → Ollama (local LLM runtime)
- "grock" / "garage" / "croc" discussing xAI → Grok (not Groq — groq.com is a different vendor)
- "croc/rock/crock API key" → INFERENCE_API_KEY when discussing settings or env vars
- "sign language" → "design language" (UI/theming)
- "ancient prompt" / "agents prompt" → "agent prompt"
- "link fuse" / "lang fuse" → Langfuse when observability is meant
- "open api" → OpenAI API when discussing API keys
- Fix odd capitalization mid-sentence when not a proper noun

Keep the speaker's casual tone. Do not add or remove ideas.`;

        const user = `Workspace files (context only): ${ctx.targetFiles.slice(0, 8).join(', ') || 'none'}

Transcript:
${raw}`;

        const started = Date.now();
        const polished = await this.chat(provider, 'stt-polish', system, user, 0.1);
        this.output.appendLine(`[stt:${provider}] polished segment (${Date.now() - started}ms)`);

        const trimmed = polished.trim();
        if (!trimmed || trimmed.length < raw.length * 0.5) {
            return raw;
        }
        return trimmed;
    }

    detectFixes(raw: string, polished: string): SttFix[] {
        return detectPhraseFixes(raw, polished);
    }

    private async chat(
        provider: Exclude<CompileProviderId, 'none'>,
        name: string,
        system: string,
        user: string,
        temperature: number
    ): Promise<string> {
        const started = Date.now();
        let text: string;
        let model: string;

        if (provider === 'ollama') {
            model = this.ollama.getConfiguredModel();
            text = await this.ollama.chat(system, user, temperature);
        } else if (provider === 'cloud') {
            model = this.llm.getConfiguredModel();
            text = await this.llm.chat(system, user, temperature);
        } else if (provider === 'vscode-lm') {
            model = this.vscodeLm.getConfiguredModel();
            text = await this.vscodeLm.chat(system, user, temperature);
        } else {
            throw new Error('No inference provider configured');
        }

        const latencyMs = Date.now() - started;
        this.output.appendLine(`[${name}] ${provider} ${model} ${latencyMs}ms`);
        return text;
    }

    private async compileWithLlm(
        rawSegments: string[],
        ctx: VoiceSessionContext,
        priorBrief: CompiledBrief | undefined,
        provider: Exclude<CompileProviderId, 'none'>
    ): Promise<CompiledBrief> {
        const segments = analyzeSegments(rawSegments);
        const { system, user } = buildCompilePrompt(segments, ctx, priorBrief);
        let markdown = await this.chat(provider, 'compile', system, user, 0.2);
        let result = finalizeLlmCompiledBrief(markdown, segments);

        if (!result.ok) {
            this.logCompileValidationFailure(provider, result.reason, result.message, result.preview);
            this.output.appendLine('[compile] attempting one reformat pass on malformed output');
            markdown = await this.chat(
                provider,
                'compile-reformat',
                REFORMAT_COMPILE_SYSTEM,
                buildReformatCompileUser(markdown),
                0.1
            );
            result = finalizeLlmCompiledBrief(markdown, segments);
            if (result.ok) {
                this.output.appendLine('[compile] repaired near-valid output on reformat retry');
            } else {
                this.logCompileValidationFailure(provider, result.reason, result.message, result.preview);
                throw new Error(result.message);
            }
        }

        return result.brief;
    }

    private logCompileValidationFailure(
        provider: Exclude<CompileProviderId, 'none'>,
        reason: 'malformed' | 'verbatim',
        message: string,
        preview: string
    ): void {
        const kind = reason === 'verbatim' ? 'verbatim transcript' : 'malformed structure';
        this.output.appendLine(`[compile:validation] ${provider} returned ${kind}: ${message}`);
        if (preview) {
            this.output.appendLine(`[compile:preview] ${preview}`);
        }
    }

    private setActive(provider: ActiveProvider, model: string): void {
        this.activeProvider = provider;
        this.activeModel = model;
    }
}
