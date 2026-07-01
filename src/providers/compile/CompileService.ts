import * as vscode from 'vscode';
import { compileSession, CompileMode } from '../../compiler/TeacherCompiler';
import { VoiceSessionContext } from '../../context/VoiceSessionContext';
import { CompiledBrief } from '../../session/types';
import { analyzeSegments } from '../../session/RetractionDetector';

export type CompileProviderId = 'auto' | 'rules' | 'ollama';

export class CompileService {
    constructor(private readonly output: vscode.OutputChannel) { }

    async compile(
        rawSegments: string[],
        ctx: VoiceSessionContext,
        mode: CompileMode
    ): Promise<CompiledBrief> {
        if (mode === 'verbatim') {
            return compileSession(rawSegments, ctx, mode);
        }

        const provider = await this.resolveProviderId();
        if (provider === 'ollama') {
            try {
                return await this.compileWithOllama(rawSegments, ctx);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.output.appendLine(`[compile:ollama] fallback to rules: ${msg}`);
            }
        }

        return compileSession(rawSegments, ctx, mode);
    }

    async resolveProviderId(): Promise<Exclude<CompileProviderId, 'auto'>> {
        const setting = vscode.workspace.getConfiguration('teacher.compile').get<CompileProviderId>('provider', 'auto');
        if (setting !== 'auto') {
            return setting;
        }
        if (await this.isOllamaAvailable()) {
            return 'ollama';
        }
        return 'rules';
    }

    private async isOllamaAvailable(): Promise<boolean> {
        const baseUrl = this.getOllamaUrl();
        try {
            const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
            return res.ok;
        } catch {
            return false;
        }
    }

    private getOllamaUrl(): string {
        return vscode.workspace.getConfiguration('teacher.inference.ollama').get<string>('url', 'http://127.0.0.1:11434').replace(/\/$/, '');
    }

    private getOllamaModel(): string {
        return vscode.workspace.getConfiguration('teacher.inference.ollama').get<string>('model', 'qwen2.5:7b-instruct');
    }

    private async compileWithOllama(rawSegments: string[], ctx: VoiceSessionContext): Promise<CompiledBrief> {
        const segments = analyzeSegments(rawSegments);
        const rulesBrief = compileSession(rawSegments, ctx, 'teacher');

        const system = `You are Teacher compile mode. Turn dictation segments into a structured agent brief.
Output markdown ONLY with sections: ## Goal, ## Target, ## Constraints, ## Verification, then --- and **Reference only (superseded)**.
Do not invent requirements. Prefer the speaker's words. Include superseded items from retractions.
Workspace target files: ${ctx.targetFiles.slice(0, 12).join(', ')}`;

        const user = `Segments:\n${segments.map((s, i) => `${i + 1}. ${s.superseded ? '[SUPERSEDED] ' : ''}${s.text}`).join('\n')}\n\nRules draft for reference:\n${rulesBrief.markdown}`;

        const baseUrl = this.getOllamaUrl();
        const model = this.getOllamaModel();

        this.output.appendLine(`[compile:ollama] model=${model}`);

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                stream: false,
                prompt: `${system}\n\n${user}`,
                options: { temperature: 0.2 }
            }),
            signal: AbortSignal.timeout(120_000)
        });

        if (!response.ok) {
            throw new Error(`Ollama compile failed (${response.status})`);
        }

        const json = (await response.json()) as { response?: string };
        const markdown = json.response?.trim();
        if (!markdown) {
            throw new Error('Ollama returned empty compile output.');
        }

        return {
            markdown,
            goal: rulesBrief.goal,
            target: rulesBrief.target,
            constraints: rulesBrief.constraints,
            verification: rulesBrief.verification,
            superseded: rulesBrief.superseded
        };
    }
}
