import * as vscode from 'vscode';

import { compileSession, CompileMode } from '../../compiler/TeacherCompiler';

import { detectPhraseFixes, formatBriefMarkdown, parseCompiledMarkdown } from '../../compiler/parseCompiledMarkdown';

import { VoiceSessionContext } from '../../context/VoiceSessionContext';

import { CompiledBrief } from '../../session/types';

import { SttFix } from '../../session/types';

import { analyzeSegments } from '../../session/RetractionDetector';

import { GrokApiClient } from './GrokApiClient';



export type CompileProviderId = 'grok';



export class CompileService {

    private activeModel = '';

    private activeProvider: 'grok' | 'none' = 'none';

    private readonly grok: GrokApiClient;



    constructor(

        private readonly output: vscode.OutputChannel,

        getGrokApiKey: () => Promise<string | undefined>

    ) {

        this.grok = new GrokApiClient(getGrokApiKey, output);

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

        await this.requireGrok();
        const started = Date.now();
        const brief = await this.compileWithGrok(rawSegments, ctx, priorBrief);
        const ms = Date.now() - started;
        this.output.appendLine(`[compile:grok] done in ${ms}ms`);
        return brief;
    }



    async resolveProviderId(): Promise<'grok' | 'none'> {

        if (await this.grok.isAvailable()) {

            this.setActive('grok', this.grok.getConfiguredModel());

            return 'grok';

        }

        this.setActive('none', '');

        return 'none';

    }



    getActiveModelLabel(): string {

        return this.activeModel;

    }



    getActiveProvider(): 'grok' | 'none' {

        return this.activeProvider;

    }



    async isGrokConfigured(): Promise<boolean> {

        return this.grok.isAvailable();

    }



    async isPolishEnabled(): Promise<boolean> {

        const enabled = vscode.workspace.getConfiguration('teacher.compile').get<boolean>('polishStt', true);

        if (!enabled) {

            return false;

        }

        return await this.grok.isAvailable();

    }



    async polishTranscript(raw: string, ctx: VoiceSessionContext): Promise<string> {

        if (!(await this.isPolishEnabled())) {

            return raw;

        }



        await this.requireGrok();



        const system = `Fix speech-to-text errors in developer voice notes. Return ONLY the corrected transcript — no quotes, no markdown, no explanation.



Common fixes (apply when context fits):

- "Obama" / "olama" → Ollama (local LLM runtime)

- "Rock" → Grok (xAI model) when discussing compile/inference/API

- "sign language" → "design language" (UI/theming)

- "ancient prompt" / "agents prompt" → "agent prompt"

- Fix odd capitalization mid-sentence (e.g. "Coated" → "coated" when not a proper noun)



Keep the speaker's casual tone. Do not add or remove ideas.`;



        const user = `Workspace files (context only): ${ctx.targetFiles.slice(0, 8).join(', ') || 'none'}



Transcript:

${raw}`;



        const started = Date.now();

        const polished = await this.grok.chat(system, user, 0.1);

        this.output.appendLine(`[stt:grok] polished segment (${Date.now() - started}ms)`);



        const trimmed = polished.trim();

        if (!trimmed || trimmed.length < raw.length * 0.5) {

            return raw;

        }

        return trimmed;

    }



    detectFixes(raw: string, polished: string): SttFix[] {

        return detectPhraseFixes(raw, polished);

    }



    private async requireGrok(): Promise<void> {

        if (!(await this.grok.isAvailable())) {

            throw new Error(

                'Grok API key required. Run Teacher: Set Grok API Key, set XAI_API_KEY in workspace .env, or use CLOUD_LLM_GENERATE_API_KEY from AmpliJob compose .env.'

            );

        }

        this.setActive('grok', this.grok.getConfiguredModel());

    }



    private async compileWithGrok(
        rawSegments: string[],
        ctx: VoiceSessionContext,
        priorBrief?: CompiledBrief
    ): Promise<CompiledBrief> {
        const segments = analyzeSegments(rawSegments);
        const { system, user } = this.buildCompilePrompt(segments, ctx, priorBrief);
        const markdown = await this.grok.chat(system, user, 0.2);
        if (!markdown.includes('## Goal')) {
            throw new Error('Grok output missing ## Goal section');
        }
        const latest = segments[segments.length - 1]?.text.trim() ?? '';
        const brief = parseCompiledMarkdown(markdown);
        if (latest.length > 50 && brief.goal.trim().toLowerCase() === latest.toLowerCase()) {
            throw new Error('Grok returned a verbatim transcript instead of a synthesized agent brief');
        }
        return brief;
    }

    private buildCompilePrompt(
        segments: ReturnType<typeof analyzeSegments>,
        ctx: VoiceSessionContext,
        priorBrief?: CompiledBrief
    ): { system: string; user: string } {
        const system = `You are Teacher — transform voice dictation into a structured Cursor agent brief.

CRITICAL rules:
1. Do NOT invent implementation tasks when the speaker is only testing, observing, or saying things "work for me". If no explicit task was requested, ## Goal must say so clearly (e.g. "No implementation requested — user is evaluating the UI.").
2. When the speaker corrects or questions a PRIOR agent brief ("why did you give goals", "wasn't telling you to do anything"), treat that as feedback — adjust Goal/Constraints; do not repeat the mistake.
3. ## Goal = imperative tasks from the LATEST segment only. Synthesize — never paste transcript verbatim.
4. ## Target = file paths explicitly mentioned. If none, use exactly: - (no targets inferred — open files or speak file paths)
5. Include ## Constraints ONLY when the speaker stated must/should-not rules. Omit the section entirely if none.
6. Include ## Verification ONLY when the speaker said how to verify. Omit the section entirely if none — never put "---" or horizontal rules inside Verification.
7. Prior voice segments (not latest) → superseded reference bullets using the speaker's words ONLY — no metadata like [PRIOR] or segment numbers.
8. Output ends with a single line "---" then the reference header — no blank lines before "---".

Output markdown ONLY with sections you need (Goal and Target always; Constraints/Verification only when content exists), then:
---
**Reference only (superseded — do not implement unless asked again)**`;

        const priorBlock = priorBrief
            ? `\nPrevious agent brief (speaker may be correcting this — use it for continuity):\n${formatBriefMarkdown(priorBrief)}\n`
            : '';

        const user = `Workspace context: ${ctx.targetFiles.slice(0, 10).join(', ') || 'none'}
${priorBlock}
All voice segments below — latest segment drives Goal; earlier segments inform corrections and superseded reference:

${segments.map((s, i) => `${i + 1}${i === segments.length - 1 ? ' (LATEST)' : ''}. ${s.text}`).join('\n')}`;

        return { system, user };
    }



    private setActive(provider: 'grok' | 'none', model: string): void {

        this.activeProvider = provider;

        this.activeModel = model;

    }

}


