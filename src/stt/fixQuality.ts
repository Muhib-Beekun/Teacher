import { SttFix } from '../session/types';
import { FixRange } from './wordDiffFixes';

/** Drop word-diff artifacts like `key` → `INFERENCE_API_KEY` when a longer fix already covers the span. */
export function filterSpuriousFixes(fixes: SttFix[], text: string): SttFix[] {
    const valid = fixes.filter((f) => {
        if (!f.heard || !f.corrected || f.heard === f.corrected) {
            return false;
        }
        if (!text.includes(f.corrected) && !text.includes(stripEdgePunctuation(f.corrected))) {
            return false;
        }
        const heardCore = f.heard.replace(/[^\w]/g, '').toLowerCase();
        const correctedCore = f.corrected.replace(/[^\w]/g, '').toLowerCase();
        if (
            heardCore.length < 4 &&
            correctedCore.length > heardCore.length + 4 &&
            correctedCore.includes(heardCore) &&
            /_/.test(f.corrected)
        ) {
            return false;
        }
        return true;
    });

    const sorted = [...valid].sort(
        (a, b) => b.corrected.length - a.corrected.length || b.heard.length - a.heard.length
    );
    const dominated = new Set<SttFix>();
    for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i];
        for (let j = i + 1; j < sorted.length; j++) {
            const b = sorted[j];
            if (a.corrected === b.corrected && a.heard.toLowerCase().includes(b.heard.toLowerCase())) {
                dominated.add(b);
            }
            if (
                a.heard.toLowerCase() === b.heard.toLowerCase() &&
                a.corrected.toLowerCase().includes(b.corrected.toLowerCase())
            ) {
                dominated.add(b);
            }
        }
    }
    return sorted.filter((f) => !dominated.has(f));
}

/** Map stored fixes to non-overlapping highlight ranges in final text. */
export function resolveFixRanges(text: string, fixes: SttFix[]): FixRange[] {
    const filtered = filterSpuriousFixes(fixes, text);
    const occupied = new Array<boolean>(text.length).fill(false);
    const ranges: FixRange[] = [];
    const sorted = [...filtered].sort(
        (a, b) => b.corrected.length - a.corrected.length || b.heard.length - a.heard.length
    );

    for (const fix of sorted) {
        const needles = [
            fix.corrected,
            fix.corrected.replace(/[.,!?;:]+$/, ''),
            stripEdgePunctuation(fix.corrected)
        ].filter((v, i, arr) => v && arr.indexOf(v) === i);

        for (const needle of needles) {
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
                    ranges.push({ fix, start: idx, end });
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

/** What the mic actually said — prefer textRaw phrase over pipeline intermediate. */
export function heardDisplayForFix(fix: SttFix, textRaw: string): string {
    if (fix.heardOriginal?.trim()) {
        return fix.heardOriginal.trim();
    }

    const literalIdx = textRaw.toLowerCase().indexOf(fix.heard.toLowerCase());
    if (literalIdx >= 0) {
        return textRaw.slice(literalIdx, literalIdx + fix.heard.length);
    }

    if (/_API_KEY$/i.test(fix.corrected)) {
        const envHeard = textRaw.match(
            /\b(?:croc|rock|crock|grok|inference)\s+api\s+key\b/i
        );
        if (envHeard) {
            return envHeard[0];
        }
    }

    if (/inference/i.test(fix.corrected) || /INFERENCE_API_KEY/i.test(fix.corrected)) {
        const inferenceHeard = textRaw.match(/\b(?:croc|rock|crock|grok)\b/i);
        if (inferenceHeard && fix.heard.toLowerCase().includes('grok')) {
            return fix.heard.replace(/grok/i, inferenceHeard[0]);
        }
    }

    return fix.heard;
}

export function attachHeardOriginal(fix: SttFix, textRaw: string, stageBefore?: string): SttFix {
    if (fix.heardOriginal) {
        return fix;
    }

    if (/_API_KEY$/i.test(fix.corrected)) {
        const m = textRaw.match(/\b(?:croc|rock|crock|grok|inference)\s+api\s+key\b/i);
        if (m) {
            return { ...fix, heardOriginal: m[0] };
        }
    }

    if (stageBefore) {
        const idx = stageBefore.toLowerCase().indexOf(fix.heard.toLowerCase());
        if (idx >= 0) {
            const ratio = idx / Math.max(stageBefore.length, 1);
            const approx = Math.floor(ratio * textRaw.length);
            const window = textRaw.slice(Math.max(0, approx - 20), approx + fix.heard.length + 20);
            const local = window.match(
                new RegExp(`\\b${escapeRegExp(fix.heard)}\\b`, 'i')
            );
            if (local && local.index !== undefined) {
                const start = Math.max(0, approx - 20) + local.index;
                return { ...fix, heardOriginal: textRaw.slice(start, start + local[0].length) };
            }
        }
    }

    const rawIdx = textRaw.toLowerCase().indexOf(fix.heard.toLowerCase());
    if (rawIdx >= 0) {
        return { ...fix, heardOriginal: textRaw.slice(rawIdx, rawIdx + fix.heard.length) };
    }

    return fix;
}

function stripEdgePunctuation(value: string): string {
    return value.replace(/^[^\w]+|[^\w]+$/g, '');
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
