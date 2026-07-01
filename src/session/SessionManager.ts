import { VoiceSessionContext } from '../context/VoiceSessionContext';
import { CompileMode } from '../compiler/TeacherCompiler';
import { CompileService } from '../providers/compile/CompileService';
import { analyzeSegments, formatSegmentLabel } from './RetractionDetector';
import { CompiledBrief, RawSegment, SttFix } from './types';

export class SessionManager {
    private readonly segments: RawSegment[] = [];
    private compiledBrief: CompiledBrief | null = null;
    private compiledOverride: string | null = null;

    public getRawTexts(): string[] {
        return this.segments.map((s) => s.text);
    }

    public getSegments(): readonly RawSegment[] {
        return this.segments;
    }

    public getAnalyzedSegments() {
        return analyzeSegments(this.getRawTexts());
    }

    public appendSegment(text: string, textRaw?: string, fixes: SttFix[] = []): void {
        const trimmed = text.trim();
        if (!trimmed) {
            return;
        }
        this.segments.push({
            text: trimmed,
            textRaw: (textRaw ?? trimmed).trim(),
            fixes
        });
        this.compiledOverride = null;
    }

    public async compile(
        getContext: () => VoiceSessionContext,
        mode: CompileMode,
        compileService: CompileService
    ): Promise<CompiledBrief> {
        this.compiledBrief = await compileService.compile(this.getRawTexts(), getContext(), mode);
        return this.compiledBrief;
    }

    public getCompiledMarkdown(): string {
        if (this.compiledOverride !== null) {
            return this.compiledOverride;
        }
        return this.compiledBrief?.markdown ?? '';
    }

    public setCompiledOverride(text: string): void {
        this.compiledOverride = text;
    }

    public isEmpty(): boolean {
        return this.segments.length === 0;
    }

    public reset(): void {
        this.segments.length = 0;
        this.compiledBrief = null;
        this.compiledOverride = null;
    }

    public formatTranscriptHtml(): string {
        const analyzed = this.getAnalyzedSegments();
        if (!analyzed.length) {
            return '<p class="empty">Session ready. Click mic or Type to begin.</p>';
        }

        return this.segments
            .map((raw, index) => {
                const meta = analyzed[index];
                const label = meta ? formatSegmentLabel(meta) : 'included';
                const labelClass =
                    label === 'superseded' ? 'tag-superseded' : label === 'correction' ? 'tag-correction' : 'tag-included';
                const bodyHtml = renderTextWithFixes(raw.text, raw.fixes);
                const fixBanner =
                    raw.fixes.length > 0
                        ? `<div class="fix-banner"><b>${raw.fixes.length} word${raw.fixes.length > 1 ? 's' : ''} fixed</b> · tap yellow word to see what was heard</div>`
                        : '';
                return `<details class="seg" ${index === this.segments.length - 1 ? 'open' : ''}>
  <summary><span class="seg-num">${index + 1}</span><span class="seg-label ${labelClass}">${label}</span><span class="seg-preview">${escapeHtml(preview(raw.text))}</span></summary>
  <div class="seg-body">${fixBanner}${bodyHtml}</div>
</details>`;
            })
            .join('');
    }
}

function renderTextWithFixes(text: string, fixes: SttFix[]): string {
    if (!fixes.length) {
        return escapeHtml(text);
    }
    let html = escapeHtml(text);
    for (const fix of fixes) {
        const corrected = escapeHtml(fix.corrected);
        const heard = escapeHtml(fix.heard);
        const span = `<span class="fix-word" data-heard="${heard}" title="heard: ${heard}">${corrected}</span>`;
        html = html.replace(corrected, span);
    }
    return html;
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
