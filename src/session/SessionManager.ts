import { VoiceSessionContext } from '../context/VoiceSessionContext';
import { CompileMode } from '../compiler/TeacherCompiler';
import { CompileService } from '../providers/compile/CompileService';
import { analyzeSegments, formatSegmentLabel } from './RetractionDetector';
import { CompiledBrief, RawSegment, SttFix, SttSegmentAudit } from './types';
import { diffWordFixes } from '../stt/wordDiffFixes';
import { filterSpuriousFixes, heardDisplayForFix, resolveFixRanges } from '../stt/fixQuality';

export interface BriefVersion {
    version: number;
    segmentCount: number;
    brief: CompiledBrief;
}

export class SessionManager {
    private readonly segments: RawSegment[] = [];
    private briefVersions: BriefVersion[] = [];
    private compiledBrief: CompiledBrief | null = null;
    private lastCompileError: string | undefined;
    private needsRegenerate = false;
    private briefVersionCounter = 0;

    private static readonly MAX_BRIEF_VERSIONS = 20;

    public getRawTexts(): string[] {
        return this.segments.map((s) => s.text);
    }

    public getSegments(): readonly RawSegment[] {
        return this.segments;
    }

    public getAnalyzedSegments() {
        return analyzeSegments(this.getRawTexts());
    }

    public appendSegment(
        text: string,
        textRaw?: string,
        fixes: SttFix[] = [],
        audit?: SttSegmentAudit
    ): void {
        const trimmed = text.trim();
        if (!trimmed) {
            return;
        }
        this.segments.push({
            text: trimmed,
            textRaw: (textRaw ?? trimmed).trim(),
            fixes: sanitizeFixes(trimmed, fixes),
            audit
        });
        this.needsRegenerate = true;
    }

    public updateSegment(index: number, text: string): boolean {
        const seg = this.segments[index];
        if (!seg) {
            return false;
        }
        const trimmed = text.trim();
        if (!trimmed || seg.text.trim() === trimmed) {
            return false;
        }
        seg.text = trimmed;
        seg.textRaw = trimmed;
        seg.fixes = [];
        this.needsRegenerate = true;
        return true;
    }

    public dismissSuggestedFix(index: number, heard: string, corrected: string): boolean {
        const seg = this.segments[index];
        if (!seg) {
            return false;
        }
        const plainHeard = heard.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        const plainCorrected = corrected.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        if (seg.text.includes(plainCorrected)) {
            seg.text = seg.text.replace(plainCorrected, plainHeard);
        }
        const before = seg.fixes.length;
        seg.fixes = seg.fixes.filter(
            (f) => !(f.heard === plainHeard && f.corrected === plainCorrected)
        );
        if (seg.fixes.length < before) {
            this.needsRegenerate = true;
            return true;
        }
        return false;
    }

    public markNeedsRegenerate(): void {
        this.needsRegenerate = true;
    }

    public clearNeedsRegenerate(): void {
        this.needsRegenerate = false;
    }

    public getNeedsRegenerate(): boolean {
        return this.needsRegenerate;
    }

    public async compile(
        getContext: () => VoiceSessionContext,
        mode: CompileMode,
        compileService: CompileService,
        options?: { fresh?: boolean }
    ): Promise<CompiledBrief | null> {
        this.lastCompileError = undefined;
        try {
            const priorBrief = options?.fresh
                ? undefined
                : (this.briefVersions[0]?.brief ?? this.compiledBrief ?? undefined);
            this.compiledBrief = await compileService.compile(
                this.getRawTexts(),
                getContext(),
                mode,
                priorBrief
            );
            this.briefVersionCounter += 1;
            const version = this.briefVersionCounter;
            this.briefVersions.unshift({
                version,
                segmentCount: this.segments.length,
                brief: this.compiledBrief
            });
            if (this.briefVersions.length > SessionManager.MAX_BRIEF_VERSIONS) {
                this.briefVersions.length = SessionManager.MAX_BRIEF_VERSIONS;
            }
            this.needsRegenerate = false;
            return this.compiledBrief;
        } catch (err) {
            this.lastCompileError = err instanceof Error ? err.message : String(err);
            return null;
        }
    }

    public getCurrentBrief(): CompiledBrief | null {
        return this.compiledBrief;
    }

    public getLastCompileError(): string | undefined {
        return this.lastCompileError;
    }

    public getBriefVersions(): readonly BriefVersion[] {
        return this.briefVersions;
    }

    public getLatestBriefVersion(): number | undefined {
        return this.briefVersions[0]?.version;
    }

    public getBriefMarkdown(version?: number): string {
        if (version !== undefined) {
            return this.briefVersions.find((v) => v.version === version)?.brief.markdown ?? '';
        }
        return this.compiledBrief?.markdown ?? '';
    }

    /** Harness/tests only — inject a compiled brief without calling Grok. */
    public setCompiledBrief(brief: CompiledBrief): void {
        this.compiledBrief = brief;
        this.briefVersionCounter = 1;
        this.briefVersions = [{ version: 1, segmentCount: this.segments.length, brief }];
        this.lastCompileError = undefined;
    }

    public getCompiledMarkdown(): string {
        return this.compiledBrief?.markdown ?? '';
    }

    public isEmpty(): boolean {
        return this.segments.length === 0;
    }

    public getTranscriptPlainText(): string {
        return this.segments.map((s) => s.text).join('\n\n');
    }

    public getTotalFixCount(): number {
        return this.segments.reduce((n, s) => n + s.fixes.length, 0);
    }

    public reset(): void {
        this.segments.length = 0;
        this.briefVersions.length = 0;
        this.compiledBrief = null;
        this.lastCompileError = undefined;
        this.needsRegenerate = false;
        this.briefVersionCounter = 0;
    }

    public formatTranscriptHtml(): string {
        const analyzed = this.getAnalyzedSegments();
        if (!analyzed.length) {
            return '<p class="empty">Speak into the mic. Your words land here when you pause.</p>';
        }

        return this.segments
            .map((raw, index) => {
                const meta = analyzed[index];
                const label = meta ? formatSegmentLabel(meta, index) : index === 0 ? 'included' : 'correction';
                const labelClass =
                    label === 'superseded'
                        ? 'tag-superseded'
                        : label === 'correction'
                          ? 'tag-correction'
                          : label === 'retraction'
                            ? 'tag-superseded'
                            : 'tag-included';
                const fixLog = renderFixLog(effectiveFixes(raw), raw.textRaw);
                const heardBlock = raw.textRaw.trim() !== raw.text.trim() || effectiveFixes(raw).length
                    ? `<div class="seg-heard"><span class="fix-log-label">STT heard:</span> ${escapeHtml(raw.textRaw)}</div>`
                    : '';
                return `<details class="seg" ${index === this.segments.length - 1 ? 'open' : ''}>
  <summary><span class="seg-chevron" aria-hidden="true"></span><span class="seg-num">${index + 1}</span><span class="seg-label ${labelClass}">${label}</span><span class="seg-preview">${escapeHtml(preview(raw.text))}</span></summary>
  <div class="seg-body">
    ${heardBlock}
    <div class="seg-text" contenteditable="true" spellcheck="true" data-segment-index="${index}">${renderSegmentTextHtml(raw, index)}</div>
    ${fixLog}
  </div>
</details>`;
            })
            .join('');
    }

    public formatBriefHtml(): string {
        if (this.lastCompileError && !this.briefVersions.length) {
            return `<p class="empty compile-error"><strong>Brief compile failed</strong><br>${escapeHtml(this.lastCompileError)}</p>`;
        }
        if (!this.briefVersions.length) {
            if (this.lastCompileError) {
                return `<p class="empty compile-error"><strong>Brief compile failed</strong><br>${escapeHtml(this.lastCompileError)}</p>`;
            }
            return '<p class="empty">Speak. Your agent brief appears here after each pause.</p>';
        }

        return this.briefVersions
            .map((v, idx) => {
                const latest = idx === 0;
                const labelClass = latest ? 'tag-included' : 'tag-superseded';
                const label = latest ? 'current' : 'prior';
                return `<details class="seg brief-seg" data-brief-version="${v.version}" ${latest ? 'open' : ''}>
  <summary><span class="seg-chevron" aria-hidden="true"></span><span class="seg-num">${v.version}</span><span class="seg-label ${labelClass}">${label}</span><span class="seg-preview">${escapeHtml(preview(v.brief.goal))}</span></summary>
  <div class="seg-body">${renderBriefSections(v.brief)}<div class="brief-card-actions">
    <button type="button" class="card-action brief-copy" data-brief-version="${v.version}" title="Copy this prompt">
      <svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
      Copy
    </button>
    <button type="button" class="card-action brief-send" data-brief-version="${v.version}" title="Send this prompt">
      <svg viewBox="0 0 24 24"><path d="M6 8l8 4-8 4V8z"/><path d="M16 8l4 4-4 4V8z"/></svg>
      Send
    </button>
  </div></div>
</details>`;
            })
            .join('');
    }
}

function renderBriefSections(brief: CompiledBrief): string {
    const sections: [string, string][] = [['Goal', brief.goal]];

    if (brief.target.length) {
        sections.push(['Target', brief.target.map((t) => `- ${t}`).join('\n')]);
    } else {
        sections.push(['Target', '(no targets inferred: speak file paths; browser UI cannot open files)']);
    }

    if (brief.constraints.length) {
        sections.push(['Constraints', brief.constraints.map((c) => `- ${c}`).join('\n')]);
    }

    if (brief.verification.length) {
        sections.push(['Verification', brief.verification.map((v) => `- ${v}`).join('\n')]);
    }

    if (brief.sessionLog.length) {
        const sessionBody = [
            'Audit trail: how the speaker arrived at this brief. Read alongside Goal for corrections and thought process.',
            ...brief.sessionLog.map((s) => `- ${s}`)
        ].join('\n');
        sections.push(['Session - your words', sessionBody]);
    }

    if (brief.superseded.length) {
        sections.push(['Reference only', brief.superseded.map((s) => `- ${s}`).join('\n')]);
    }

    return sections
        .map(
            ([heading, body]) =>
                `<div class="brief-section"><div class="brief-heading">${heading}</div><div class="seg-text brief-text">${escapeHtml(body)}</div></div>`
        )
        .join('');
}

function renderSegmentTextHtml(raw: RawSegment, segmentIndex: number): string {
    const fixes = effectiveFixes(raw);
    if (!fixes.length) {
        return escapeHtml(raw.text);
    }

    const ranges = resolveFixRanges(raw.text, fixes, raw.textRaw);
    if (!ranges.length) {
        return escapeHtml(raw.text);
    }

    let html = '';
    let pos = 0;
    for (const r of ranges) {
        if (r.start < pos) {
            continue;
        }
        const heard = heardDisplayForFix(r.fix, raw.textRaw);
        html += escapeHtml(raw.text.slice(pos, r.start));
        const slice = raw.text.slice(r.start, r.end);
        html += `<span class="fix-word" data-segment-index="${segmentIndex}" data-heard="${escapeAttr(heard)}" data-corrected="${escapeAttr(r.fix.corrected)}" title="Heard: ${escapeAttr(heard)}">${escapeHtml(slice)}</span>`;
        pos = r.end;
    }
    html += escapeHtml(raw.text.slice(pos));
    return html;
}

function effectiveFixes(raw: RawSegment): SttFix[] {
    const stored = filterSpuriousFixes(sanitizeFixes(raw.text, raw.fixes), raw.text, raw.textRaw);
    if (stored.length) {
        return stored;
    }
    const fromRaw = filterSpuriousFixes(sanitizeFixes(raw.text, diffWordFixes(raw.textRaw, raw.text)), raw.text, raw.textRaw);
    if (fromRaw.length) {
        return fromRaw;
    }
    const audit = raw.audit;
    if (!audit || audit.sttHeard.trim() === raw.text.trim()) {
        return [];
    }
    if (audit.afterPolish !== audit.afterDictionary) {
        return sanitizeFixes(raw.text, diffWordFixes(audit.afterDictionary, raw.text));
    }
    if (audit.afterDictionary !== audit.afterLexicon) {
        return sanitizeFixes(raw.text, diffWordFixes(audit.afterLexicon, raw.text));
    }
    return sanitizeFixes(raw.text, diffWordFixes(audit.sttHeard, raw.text));
}

function findCorrectedRanges(
    text: string,
    fixes: SttFix[]
): { start: number; end: number; fix: SttFix }[] {
    const occupied = new Array<boolean>(text.length).fill(false);
    const ranges: { start: number; end: number; fix: SttFix }[] = [];
    const sorted = [...fixes].sort((a, b) => b.corrected.length - a.corrected.length);

    for (const fix of sorted) {
        const candidates = [
            fix.corrected,
            fix.corrected.replace(/[.,!?;:]+$/, ''),
            stripEdgePunctuation(fix.corrected)
        ].filter((v, i, arr) => v && arr.indexOf(v) === i);

        for (const needle of candidates) {
            let from = 0;
            while (from < text.length) {
                const idx = text.indexOf(needle, from);
                if (idx < 0) {
                    break;
                }
                const end = idx + needle.length;
                if (!occupied.slice(idx, end).some(Boolean)) {
                    for (let k = idx; k < end; k++) {
                        occupied[k] = true;
                    }
                    ranges.push({ start: idx, end, fix });
                    break;
                }
                from = idx + 1;
            }
            if (ranges.some((r) => r.fix === fix)) {
                break;
            }
        }
    }

    return ranges.sort((a, b) => a.start - b.start);
}

function stripEdgePunctuation(value: string): string {
    return value.replace(/^[^\w]+|[^\w]+$/g, '');
}

function sanitizeFixes(text: string, fixes: SttFix[]): SttFix[] {
    return fixes.filter((f) => {
        if (!f.heard || !f.corrected || f.heard === f.corrected) {
            return false;
        }
        if (f.heard.includes('<') || f.corrected.includes('<') || f.corrected.includes('span')) {
            return false;
        }
        return textIncludesCorrected(text, f.corrected);
    });
}

function textIncludesCorrected(text: string, corrected: string): boolean {
    if (text.includes(corrected)) {
        return true;
    }
    const bare = stripEdgePunctuation(corrected);
    return bare.length > 0 && text.includes(bare);
}

function renderFixLog(fixes: SttFix[], textRaw: string): string {
    if (!fixes.length) {
        return '';
    }
    const items = fixes.map((f) => {
        const heard = heardDisplayForFix(f, textRaw);
        const src = f.source ? ` <span class="fix-src">(${f.source})</span>` : '';
        return `${escapeHtml(heard)}→${escapeHtml(f.corrected)}${src}`;
    }).join(', ');
    return `<div class="fix-log"><span class="fix-log-label">Auto-corrected:</span> ${items}</div>`;
}

function preview(text: string): string {
    return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
    return escapeHtml(value).replace(/'/g, '&#39;');
}
