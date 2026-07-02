import { RawSegment, SttFix } from '../session/types';

export interface SttAuditSegment {
    index: number;
    sttHeard: string;
    afterLexicon: string;
    afterDictionary: string;
    final: string;
    fixes: SttFix[];
}

/** Session-local STT audit — copy and share deltas without Langfuse. */
export function buildSttAuditReport(segments: readonly RawSegment[]): string {
    if (!segments.length) {
        return 'No segments in this session.';
    }

    const lines: string[] = [
        '# Teacher STT audit',
        '',
        'Per-segment pipeline: what the mic/browser heard → lexicon → dictionary → polish (final).',
        'Fixes list only changes with a recorded source. Copy this block to report inconsistencies.',
        ''
    ];

    segments.forEach((seg, i) => {
        const audit = seg.audit;
        const n = i + 1;
        lines.push(`## Segment ${n}`);
        lines.push('');
        lines.push('### Pipeline');
        lines.push(`- **STT heard:** ${audit?.sttHeard ?? seg.textRaw}`);
        if (audit && audit.afterLexicon !== audit.sttHeard) {
            lines.push(`- **After lexicon:** ${audit.afterLexicon}`);
        }
        if (audit && audit.afterDictionary !== audit.afterLexicon) {
            lines.push(`- **After dictionary:** ${audit.afterDictionary}`);
        }
        if (audit && audit.afterPolish !== audit.afterDictionary) {
            lines.push(`- **After polish:** ${audit.afterPolish}`);
        }
        lines.push(`- **Final (stored):** ${seg.text}`);
        lines.push('');

        if (seg.fixes.length) {
            lines.push('### Corrections applied');
            for (const f of seg.fixes) {
                const src = f.source ? ` [${f.source}]` : '';
                lines.push(`- \`${f.heard}\` → \`${f.corrected}\`${src}`);
            }
            lines.push('');
        } else if (seg.text.trim() !== seg.textRaw.trim()) {
            lines.push('### Note');
            lines.push('- Text changed but no individual fixes were recorded (check pipeline above).');
            lines.push('');
        } else {
            lines.push('### Corrections applied');
            lines.push('- (none)');
            lines.push('');
        }
    });

    const totalFixes = segments.reduce((n, s) => n + s.fixes.length, 0);
    lines.push('---', '', `**Total segments:** ${segments.length} · **Total fix entries:** ${totalFixes}`);

    return lines.join('\n');
}
