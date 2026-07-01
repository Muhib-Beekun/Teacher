import { compileSession, CompileMode } from '../compiler/TeacherCompiler';
import { VoiceSessionContext } from '../context/VoiceSessionContext';
import { analyzeSegments, formatSegmentLabel } from './RetractionDetector';
import { CompiledBrief, Segment } from './types';

export class SessionManager {
    private readonly rawSegments: string[] = [];
    private compiledBrief: CompiledBrief | null = null;
    private compiledOverride: string | null = null;

    public getRawSegments(): readonly string[] {
        return this.rawSegments;
    }

    public getAnalyzedSegments(): Segment[] {
        return analyzeSegments(this.rawSegments);
    }

    public appendSegment(text: string): void {
        const trimmed = text.trim();
        if (!trimmed) {
            return;
        }
        this.rawSegments.push(trimmed);
        this.compiledOverride = null;
    }

    public compile(getContext: () => VoiceSessionContext, mode: CompileMode): CompiledBrief {
        this.compiledBrief = compileSession(this.rawSegments, getContext(), mode);
        return this.compiledBrief;
    }

    public getCompiledMarkdown(mode: CompileMode, getContext: () => VoiceSessionContext): string {
        if (this.compiledOverride !== null) {
            return this.compiledOverride;
        }
        if (!this.compiledBrief) {
            this.compile(getContext, mode);
        }
        return this.compiledBrief?.markdown ?? '';
    }

    public setCompiledOverride(text: string): void {
        this.compiledOverride = text;
    }

    public clearCompiledOverride(): void {
        this.compiledOverride = null;
    }

    public isEmpty(): boolean {
        return this.rawSegments.length === 0;
    }

    public reset(): void {
        this.rawSegments.length = 0;
        this.compiledBrief = null;
        this.compiledOverride = null;
    }

    public formatTranscriptHtml(): string {
        const segments = this.getAnalyzedSegments();
        if (!segments.length) {
            return '<p class="empty">Session ready. Tap mic or type to begin.</p>';
        }

        return segments
            .map((seg) => {
                const label = formatSegmentLabel(seg);
                const labelClass = label === 'superseded' ? 'tag-superseded' : label === 'correction' ? 'tag-correction' : 'tag-included';
                return `<details class="seg" ${seg.index === segments.length - 1 ? 'open' : ''}>
  <summary><span class="seg-num">${seg.index + 1}</span><span class="seg-label ${labelClass}">${label}</span><span class="seg-preview">${escapeHtml(preview(seg.text))}</span></summary>
  <div class="seg-body">${escapeHtml(seg.text)}</div>
</details>`;
            })
            .join('');
    }
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
