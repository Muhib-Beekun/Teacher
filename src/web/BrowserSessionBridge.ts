import * as vscode from 'vscode';
import { CompileMode } from '../compiler/TeacherCompiler';
import { VoiceSessionContext } from '../context/VoiceSessionContext';
import { CompileService } from '../providers/compile/CompileService';
import { SttService } from '../providers/stt/SttService';
import { SessionManager } from '../session/SessionManager';
import { SttFix } from '../session/types';
import { applyDevVoiceLexicon } from '../stt/DevVoiceLexicon';
import { EMPTY_COMPILED_PLACEHOLDER, SessionSnapshot } from './types';
import { formatCompileLabel, formatContextHint, formatSttLabel } from './labels';

export interface BrowserSessionBridgeDeps {
    getVoiceContext: () => VoiceSessionContext;
    rebuildContext: (recentUtterance?: string) => Promise<void>;
    sttService: SttService;
    compileService: CompileService;
}

export class BrowserSessionBridge {
    private readonly session = new SessionManager();
    private sttProviderLabel = 'auto';
    private compileProviderLabel = 'none';
    public onUpdated?: () => void;

    constructor(private readonly deps: BrowserSessionBridgeDeps) { }

    public async init(): Promise<void> {
        this.sttProviderLabel = await this.deps.sttService.resolveProviderId();
        this.compileProviderLabel = await this.deps.compileService.resolveProviderId();
    }

    public async refreshProviderLabel(): Promise<void> {
        this.sttProviderLabel = await this.deps.sttService.resolveProviderId();
        this.compileProviderLabel = await this.deps.compileService.resolveProviderId();
    }

    public async appendSegment(segmentText: string): Promise<SessionSnapshot> {
        const trimmed = segmentText.trim();
        if (!trimmed) {
            return this.getSnapshot('Nothing to add.');
        }

        const textRaw = trimmed;
        const lexicon = applyDevVoiceLexicon(trimmed);
        let text = lexicon.text;
        let fixes: SttFix[] = [...lexicon.fixes];

        if (await this.deps.compileService.isPolishEnabled()) {
            try {
                const ctx = this.deps.getVoiceContext();
                const polished = await this.deps.compileService.polishTranscript(text, ctx);
                if (polished.trim() && polished.trim() !== text) {
                    const polishFixes = this.deps.compileService.detectFixes(textRaw, polished.trim());
                    text = polished.trim();
                    fixes = mergeFixes(fixes, polishFixes.filter(isValidFix));
                }
            } catch {
                /* keep lexicon-corrected text */
            }
        } else {
            const result = this.deps.sttService.processWebSpeechText(text, this.deps.getVoiceContext());
            if (result.text !== text) {
                fixes = mergeFixes(fixes, result.fixes);
                text = result.text;
            }
        }

        await this.deps.rebuildContext(text);
        this.session.appendSegment(text, textRaw, fixes);
        await this.maybeCompile();
        await this.refreshProviderLabel();
        this.notifyUpdated();
        return this.getSnapshot('Added to session.');
    }

    public async appendAudio(buffer: Buffer, mimeType: string): Promise<SessionSnapshot> {
        const result = await this.deps.sttService.transcribeAudio(
            buffer,
            mimeType,
            this.deps.getVoiceContext()
        );
        await this.deps.rebuildContext(result.textRaw);
        const textRaw = result.textRaw;
        const lexicon = applyDevVoiceLexicon(textRaw);
        let text = lexicon.text;
        let fixes = mergeFixes(result.fixes, lexicon.fixes);
        if (await this.deps.compileService.isPolishEnabled()) {
            try {
                const polished = await this.deps.compileService.polishTranscript(text, this.deps.getVoiceContext());
                if (polished.trim() && polished.trim() !== text) {
                    const polishFixes = this.deps.compileService.detectFixes(textRaw, polished.trim());
                    text = polished.trim();
                    fixes = mergeFixes(fixes, polishFixes.filter(isValidFix));
                }
            } catch {
                /* keep lexicon-corrected text */
            }
        }
        this.session.appendSegment(text, textRaw, fixes);
        await this.maybeCompile();
        await this.refreshProviderLabel();
        this.notifyUpdated();
        return this.getSnapshot('Transcribed and added.');
    }

    public async updateSegment(index: number, text: string, recompile = false): Promise<SessionSnapshot> {
        if (!this.session.updateSegment(index, text)) {
            return this.getSnapshot();
        }
        await this.deps.rebuildContext(text);
        if (recompile) {
            await this.maybeCompile();
            await this.refreshProviderLabel();
        }
        this.notifyUpdated();
        return this.getSnapshot(recompile ? 'Segment updated.' : 'Segment updated — refresh brief when ready.');
    }

    public revertFix(index: number, heard: string, corrected: string): SessionSnapshot {
        this.session.dismissSuggestedFix(index, heard, corrected);
        this.notifyUpdated();
        return this.getSnapshot('Reverted correction — refresh brief when ready.');
    }

    public async forceCompile(): Promise<SessionSnapshot> {
        await this.session.compile(this.deps.getVoiceContext, this.getCompileMode(), this.deps.compileService);
        await this.refreshProviderLabel();
        this.notifyUpdated();
        return this.getSnapshot('Re-scaffolded.');
    }

    public reset(): SessionSnapshot {
        this.session.reset();
        this.notifyUpdated();
        return this.getSnapshot('Session cleared.');
    }

    public getTranscriptPlainText(): string {
        return this.session.getTranscriptPlainText();
    }

    public getCompiledMarkdown(version?: number): string {
        return this.session.getBriefMarkdown(version);
    }

    public isEmpty(): boolean {
        return this.session.isEmpty();
    }

    public getSnapshot(status?: string): SessionSnapshot {
        const termCount = this.deps.getVoiceContext().dictionary_context.length;
        const compileError = this.session.getLastCompileError();
        const briefMarkdownByVersion: Record<number, string> = {};
        for (const v of this.session.getBriefVersions()) {
            briefMarkdownByVersion[v.version] = v.brief.markdown;
        }
        return {
            transcriptHtml: this.session.formatTranscriptHtml(),
            briefHtml: this.session.formatBriefHtml(),
            compiled: this.session.isEmpty()
                ? EMPTY_COMPILED_PLACEHOLDER
                : this.session.getCompiledMarkdown() || compileError || EMPTY_COMPILED_PLACEHOLDER,
            compileError,
            needsRegenerate: this.session.getNeedsRegenerate(),
            briefMarkdownByVersion,
            segmentCount: this.session.getSegments().length,
            sttLabel: formatSttLabel(this.sttProviderLabel),
            compileLabel: formatCompileLabel(
                this.compileProviderLabel,
                this.deps.compileService.getActiveModelLabel()
            ),
            contextHint: formatContextHint(termCount),
            status
        };
    }

    private async maybeCompile(): Promise<void> {
        const live = vscode.workspace.getConfiguration().get<boolean>('teacher.compile.live', true);
        if (live && !this.session.isEmpty()) {
            await this.session.compile(this.deps.getVoiceContext, this.getCompileMode(), this.deps.compileService);
        }
    }

    private getCompileMode(): CompileMode {
        return vscode.workspace.getConfiguration().get<CompileMode>('teacher.compile.mode', 'teacher');
    }

    private notifyUpdated(): void {
        this.onUpdated?.();
    }
}

function mergeFixes(a: SttFix[], b: SttFix[]): SttFix[] {
    const seen = new Set<string>();
    const out: SttFix[] = [];
    for (const f of [...a, ...b]) {
        if (!isValidFix(f)) {
            continue;
        }
        const key = `${f.heard.toLowerCase()}→${f.corrected.toLowerCase()}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        out.push(f);
    }
    return out;
}

function isValidFix(f: SttFix): boolean {
    if (!f.heard || !f.corrected || f.heard === f.corrected) {
        return false;
    }
    if (/[<>]/.test(f.heard) || /[<>]/.test(f.corrected) || /span/i.test(f.corrected)) {
        return false;
    }
    return true;
}
