import * as vscode from 'vscode';
import { CompileMode } from '../compiler/TeacherCompiler';
import { VoiceSessionContext } from '../context/VoiceSessionContext';
import { CompileService } from '../providers/compile/CompileService';
import { SttService } from '../providers/stt/SttService';
import { SessionManager } from '../session/SessionManager';
import { SttFix, SttSegmentAudit } from '../session/types';
import { applyDevVoiceLexicon } from '../stt/DevVoiceLexicon';
import { attachHeardOriginal, filterSpuriousFixes } from '../stt/fixQuality';
import { discoverWhisperPaths, setWhisperPath, testWhisperSetup } from '../stt/WhisperSetup';
import {
    getCodewordsRelPath,
    getPrimaryWorkspaceFolder,
    normalizeCodewordTerms,
    readFileCodewords,
    writeFileCodewords
} from '../config/CodewordsManager';
import { readAppSettings, updateAppSetting, AppSettingsView } from './AppSettings';
import { buildAgentHandoff } from './buildAgentHandoff';
import { buildSttAuditReport } from './buildSttAudit';
import { formatCompileLabel, formatContextHint, formatSttLabel } from './labels';
import { EMPTY_COMPILED_PLACEHOLDER, SessionSnapshot } from './types';

export type ContextRebuildMode = 'clearSession' | 'onFileChange' | 'eachSegment';

export interface BrowserSessionBridgeDeps {
    getVoiceContext: () => VoiceSessionContext;
    getRebuildMode: () => ContextRebuildMode;
    rebuildContext: (recentUtterance?: string) => Promise<void>;
    ensureCodewordsFile: () => Promise<void>;
    sttService: SttService;
    compileService: CompileService;
    getServerUrl: () => string;
    setLlmApiKey: (key: string) => Promise<void>;
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

        const { text, textRaw, fixes, audit } = await this.runSttPipeline(trimmed);
        await this.maybeRebuildAfterSegment(text);
        this.session.appendSegment(text, textRaw, fixes, audit);
        await this.maybeCompileLive();
        await this.refreshProviderLabel();
        this.notifyUpdated();
        const status = formatSegmentStatus('Added', text, textRaw, fixes, this.session.getLastCompileError());
        return this.getSnapshot(status);
    }

    public async appendAudio(buffer: Buffer, mimeType: string): Promise<SessionSnapshot> {
        const result = await this.deps.sttService.transcribeAudio(
            buffer,
            mimeType,
            this.deps.getVoiceContext()
        );
        const { text, textRaw, fixes, audit } = await this.runSttPipeline(result.textRaw, result.fixes);
        await this.maybeRebuildAfterSegment(text);
        this.session.appendSegment(text, textRaw, fixes, audit);
        await this.maybeCompileLive();
        await this.refreshProviderLabel();
        this.notifyUpdated();
        const status = formatSegmentStatus('Transcribed', text, result.textRaw, fixes, this.session.getLastCompileError());
        return this.getSnapshot(status);
    }

    public getSttAuditReport(): string {
        return buildSttAuditReport(this.session.getSegments());
    }

    private async runSttPipeline(
        sttHeard: string,
        initialFixes: SttFix[] = []
    ): Promise<{ text: string; textRaw: string; fixes: SttFix[]; audit: SttSegmentAudit }> {
        const textRaw = sttHeard.trim();
        const ctx = this.deps.getVoiceContext();

        const lexicon = applyDevVoiceLexicon(textRaw);
        let text = lexicon.text;
        let fixes = mergeFixes(
            enrichFixes(tagFixes(initialFixes, 'dictionary'), textRaw),
            enrichFixes(tagFixes(lexicon.fixes, 'lexicon'), textRaw)
        );
        const afterLexicon = text;

        const dict = this.deps.sttService.applyDictionaryCorrections(text, ctx);
        text = dict.text;
        fixes = mergeFixes(fixes, enrichFixes(tagFixes(dict.fixes, 'dictionary'), textRaw, afterLexicon));
        const afterDictionary = text;

        let afterPolish = text;
        if (await this.deps.compileService.isPolishEnabled()) {
            try {
                const beforePolish = text;
                const polished = await this.deps.compileService.polishTranscript(beforePolish, ctx);
                if (polished.trim() && polished.trim() !== beforePolish) {
                    const polishFixes = this.deps.compileService
                        .detectFixes(beforePolish, polished.trim())
                        .filter(isValidFix);
                    text = polished.trim();
                    afterPolish = text;
                    fixes = mergeFixes(
                        fixes,
                        enrichFixes(tagFixes(polishFixes, 'polish'), textRaw, beforePolish)
                    );
                }
            } catch {
                /* keep dictionary-corrected text */
            }
        }

        return {
            text,
            textRaw,
            fixes: filterSpuriousFixes(fixes, text, textRaw),
            audit: { sttHeard: textRaw, afterLexicon, afterDictionary, afterPolish }
        };
    }

    public getAgentHandoff(): string {
        return buildAgentHandoff(this.session);
    }

    public async updateSegment(index: number, text: string, _recompile = false): Promise<SessionSnapshot> {
        if (!this.session.updateSegment(index, text)) {
            return this.getSnapshot();
        }
        this.notifyUpdated();
        return this.getSnapshot('Segment updated. Tap refresh to recompile brief.');
    }

    public async getAppSettings(): Promise<AppSettingsView> {
        const snap = this.getSnapshot();
        const compile = await this.deps.compileService.resolveProviderId();
        const llmKeySet = await this.deps.compileService.isLlmConfigured();
        return readAppSettings({
            sttLabel: snap.sttLabel,
            compileLabel: snap.compileLabel,
            contextHint: snap.contextHint,
            compilerKeySet: llmKeySet || (await this.deps.compileService.isOllamaAvailable()),
            compilerReady: compile !== 'none',
            serverUrl: this.deps.getServerUrl(),
            llmKeySet
        });
    }

    public async setLlmApiKey(key: string): Promise<AppSettingsView> {
        await this.deps.setLlmApiKey(key);
        await this.refreshProviderLabel();
        return this.getAppSettings();
    }

    public async patchAppSetting(key: string, value: boolean | string | number): Promise<AppSettingsView> {
        await updateAppSetting(key, value);
        if (
            key === 'teacher.compile.live'
            || key === 'teacher.compile.mode'
            || key.startsWith('teacher.stt.')
        ) {
            await this.refreshProviderLabel();
        }
        return this.getAppSettings();
    }

    public async discoverWhisper(): Promise<{ settings: AppSettingsView; message: string }> {
        const found = await discoverWhisperPaths();
        if (found.binaryPath) {
            await setWhisperPath('binaryPath', found.binaryPath);
        }
        if (found.modelPath) {
            await setWhisperPath('modelPath', found.modelPath);
        }
        await this.refreshProviderLabel();
        return { settings: await this.getAppSettings(), message: found.message };
    }

    public async testWhisper(): Promise<{ ok: boolean; message: string; settings: AppSettingsView }> {
        const result = await testWhisperSetup();
        await this.refreshProviderLabel();
        return { ...result, settings: await this.getAppSettings() };
    }

    public async getCodewords(): Promise<{ terms: string[]; path: string; ok: boolean; message?: string }> {
        const folder = getPrimaryWorkspaceFolder();
        if (!folder) {
            return { ok: false, terms: [], path: getCodewordsRelPath(), message: 'Open a workspace folder first.' };
        }
        await this.deps.ensureCodewordsFile();
        const terms = await readFileCodewords(folder);
        return { ok: true, terms, path: getCodewordsRelPath() };
    }

    public async setCodewords(terms: string[]): Promise<{ ok: boolean; terms: string[]; path: string; message: string }> {
        const folder = getPrimaryWorkspaceFolder();
        if (!folder) {
            return { ok: false, terms: [], path: getCodewordsRelPath(), message: 'Open a workspace folder first.' };
        }
        await this.deps.ensureCodewordsFile();
        const normalized = normalizeCodewordTerms(terms);
        await writeFileCodewords(folder, normalized);
        await this.deps.rebuildContext();
        return {
            ok: true,
            terms: normalized,
            path: getCodewordsRelPath(),
            message: `Saved ${normalized.length} glossary term(s) and refreshed workspace index.`
        };
    }

    public async revertFix(index: number, heard: string, corrected: string): Promise<SessionSnapshot> {
        if (!this.session.dismissSuggestedFix(index, heard, corrected)) {
            return this.getSnapshot();
        }
        this.notifyUpdated();
        return this.getSnapshot('Reverted correction. Tap refresh to recompile brief.');
    }

    public async forceCompile(): Promise<SessionSnapshot> {
        const segmentCount = this.session.getSegments().length;
        await this.session.compile(
            this.deps.getVoiceContext,
            this.getCompileMode(),
            this.deps.compileService,
            { fresh: true }
        );
        await this.refreshProviderLabel();
        this.notifyUpdated();
        return this.getSnapshot(
            segmentCount
                ? `Re-scaffolded from ${segmentCount} segment(s) in Your Words.`
                : 'Re-scaffolded.'
        );
    }

    public async reset(): Promise<SessionSnapshot> {
        this.session.reset();
        await this.deps.rebuildContext();
        this.notifyUpdated();
        return this.getSnapshot('Session cleared. Workspace index refreshed.');
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

    public getTotalFixCount(): number {
        return this.session.getTotalFixCount();
    }

    public getContextPayload(): {
        dictionary_context: string[];
        targetFiles: string[];
        stt_prompt: string;
        topTerms: string[];
    } {
        const ctx = this.deps.getVoiceContext();
        return {
            dictionary_context: ctx.dictionary_context,
            targetFiles: ctx.targetFiles,
            stt_prompt: ctx.stt_prompt,
            topTerms: ctx.dictionary_context.slice(0, 32)
        };
    }

    public getSnapshot(status?: string): SessionSnapshot {
        const ctx = this.deps.getVoiceContext();
        const termCount = ctx.dictionary_context.length;
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
            briefVersion: this.session.getLatestBriefVersion(),
            briefMarkdownByVersion,
            segmentCount: this.session.getSegments().length,
            sttLabel: formatSttLabel(this.sttProviderLabel),
            compileLabel: formatCompileLabel(
                this.compileProviderLabel,
                this.deps.compileService.getActiveModelLabel()
            ),
            contextHint: formatContextHint(termCount, ctx.targetFiles.length),
            status
        };
    }

    private async maybeRebuildAfterSegment(text: string): Promise<void> {
        if (this.deps.getRebuildMode() === 'eachSegment') {
            await this.deps.rebuildContext(text);
        }
    }

    private async maybeCompileLive(): Promise<void> {
        if (!this.isLiveCompileEnabled() || this.session.isEmpty()) {
            return;
        }
        await this.session.compile(
            this.deps.getVoiceContext,
            this.getCompileMode(),
            this.deps.compileService
        );
    }

    private isLiveCompileEnabled(): boolean {
        return vscode.workspace.getConfiguration('teacher.compile').get<boolean>('live', true);
    }

    private getCompileMode(): CompileMode {
        return vscode.workspace.getConfiguration().get<CompileMode>('teacher.compile.mode', 'teacher');
    }

    private notifyUpdated(): void {
        this.onUpdated?.();
    }
}

function enrichFixes(fixes: SttFix[], textRaw: string, stageBefore?: string): SttFix[] {
    return fixes.map((f) => attachHeardOriginal(f, textRaw, stageBefore));
}

function tagFixes(fixes: SttFix[], source: SttFix['source']): SttFix[] {
    return fixes.map((f) => ({ ...f, source: f.source ?? source }));
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

function formatSegmentStatus(
    verb: string,
    text: string,
    textRaw: string,
    fixes: SttFix[],
    compileError?: string
): string {
    const parts: string[] = [];
    if (fixes.length) {
        const detail = fixes.map((f) => `${f.heard}→${f.corrected}`).join(', ');
        parts.push(`Auto-corrected: ${detail}`);
    } else if (text.trim() !== textRaw.trim()) {
        parts.push('Transcript polished (word-level detail unavailable)');
    }
    const compileNote = compileError
        ? 'Agent prompt compile failed — tap refresh to retry.'
        : 'Agent prompt updated.';
    if (parts.length) {
        return `${verb}. ${parts.join('. ')}. ${compileNote}`;
    }
    return verb === 'Transcribed'
        ? `Transcribed and added. ${compileNote}`
        : `Added. ${compileNote}`;
}
