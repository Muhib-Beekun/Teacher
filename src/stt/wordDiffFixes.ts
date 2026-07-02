import { SttFix } from '../session/types';

const PHRASE_RULES: [RegExp, string][] = [
    [/\bobama\b/gi, 'Ollama'],
    [/\bolama\b/gi, 'Ollama'],
    [/\b(?:croc|rock|crock|grok)\s+api\s+key\b/gi, 'INFERENCE_API_KEY'],
    [/\binference\s+api\s+key\b/gi, 'INFERENCE_API_KEY'],
    [/\bsign language\b/gi, 'design language'],
    [/\bancient prompt\b/gi, 'agent prompt'],
    [/\bagents prompt\b/gi, 'agent prompt'],
    [/\blang fuse\b/gi, 'Langfuse'],
    [/\blaying off fuse\b/gi, 'Langfuse'],
    [/\blink fuse\b/gi, 'Langfuse'],
    [/\bopen api\b/gi, 'OpenAI API']
];

export interface FixRange {
    fix: SttFix;
    start: number;
    end: number;
}

interface WordSpan {
    word: string;
    start: number;
    end: number;
}

interface WordEdit {
    heard?: string;
    corrected?: string;
    afterIdx?: number;
}

const DEFAULT_MAX_WORDS = 500;

/** Word-level diff between adjacent STT pipeline stages (handles unequal word counts). */
export function diffWordFixes(before: string, after: string, maxWords = DEFAULT_MAX_WORDS): SttFix[] {
    return diffFixRanges(before, after, maxWords).map((r) => r.fix);
}

/** Diff with character ranges in the `after` text for accurate highlighting. */
export function diffFixRanges(before: string, after: string, maxWords = DEFAULT_MAX_WORDS): FixRange[] {
    if (before === after || !before.trim() || !after.trim()) {
        return [];
    }

    const ranges: FixRange[] = [];
    for (const [pattern, corrected] of PHRASE_RULES) {
        const match = before.match(pattern);
        if (!match) {
            continue;
        }
        const idx = after.indexOf(corrected);
        if (idx < 0) {
            const loose = after.toLowerCase().indexOf(corrected.toLowerCase());
            if (loose < 0) {
                continue;
            }
            ranges.push({
                fix: { heard: match[0], corrected },
                start: loose,
                end: loose + corrected.length
            });
            continue;
        }
        ranges.push({
            fix: { heard: match[0], corrected },
            start: idx,
            end: idx + corrected.length
        });
    }

    const beforeSpans = tokenizeSpans(before);
    const afterSpans = tokenizeSpans(after);
    if (!beforeSpans.length || !afterSpans.length) {
        return dedupeRanges(ranges);
    }
    if (beforeSpans.length > maxWords || afterSpans.length > maxWords) {
        return dedupeRanges(ranges);
    }

    const ops = coalesceWordEdits(
        alignWordEdits(
            beforeSpans.map((s) => s.word),
            afterSpans.map((s) => s.word)
        )
    );

    for (const op of ops) {
        if (!op.heard || !op.corrected || op.afterIdx === undefined || wordsEquivalent(op.heard, op.corrected)) {
            continue;
        }
        const a = op.heard.replace(/[^\w]/g, '');
        const b = op.corrected.replace(/[^\w]/g, '');
        if (a.length < 2 && b.length < 2) {
            continue;
        }
        const span = afterSpans[op.afterIdx];
        if (!span) {
            continue;
        }
        ranges.push({
            fix: { heard: op.heard, corrected: span.word },
            start: span.start,
            end: span.end
        });
    }

    return dedupeRanges(ranges);
}

function tokenizeSpans(text: string): WordSpan[] {
    const out: WordSpan[] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        out.push({ word: m[0], start: m.index, end: m.index + m[0].length });
    }
    return out;
}

function alignWordEdits(before: string[], after: string[]): WordEdit[] {
    const n = before.length;
    const m = after.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            if (wordsEquivalent(before[i - 1], after[j - 1])) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
            }
        }
    }

    const ops: WordEdit[] = [];
    let i = n;
    let j = m;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && wordsEquivalent(before[i - 1], after[j - 1])) {
            i--;
            j--;
            continue;
        }
        if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
            ops.unshift({ heard: before[i - 1], corrected: after[j - 1], afterIdx: j - 1 });
            i--;
            j--;
        } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
            ops.unshift({ corrected: after[j - 1], afterIdx: j - 1 });
            j--;
        } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
            ops.unshift({ heard: before[i - 1] });
            i--;
        } else {
            break;
        }
    }
    return ops;
}

function coalesceWordEdits(ops: WordEdit[]): WordEdit[] {
    const out: WordEdit[] = [];
    for (let i = 0; i < ops.length; i++) {
        const cur = ops[i];
        const next = ops[i + 1];
        if (cur.heard && !cur.corrected && next?.corrected && !next.heard) {
            out.push({ heard: cur.heard, corrected: next.corrected, afterIdx: next.afterIdx });
            i++;
            continue;
        }
        if (cur.corrected && !cur.heard && next?.heard && !next.corrected) {
            out.push({ heard: next.heard, corrected: cur.corrected, afterIdx: cur.afterIdx });
            i++;
            continue;
        }
        out.push(cur);
    }
    return out;
}

export function wordsEquivalent(a: string, b: string): boolean {
    const na = a.replace(/[^\w]/g, '').toLowerCase();
    const nb = b.replace(/[^\w]/g, '').toLowerCase();
    if (!na || !nb) {
        return a === b;
    }
    if (na === nb) {
        return true;
    }
    if (na.length >= 4 && nb.length >= 4) {
        return levenshtein(na, nb) <= 1;
    }
    return false;
}

function dedupeRanges(ranges: FixRange[]): FixRange[] {
    const seen = new Set<string>();
    const out: FixRange[] = [];
    for (const r of ranges.sort((a, b) => a.start - b.start || b.end - a.end)) {
        const key = `${r.start}:${r.end}:${r.fix.heard.toLowerCase()}→${r.fix.corrected.toLowerCase()}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        out.push(r);
    }
    return out;
}

function levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] =
                b.charAt(i - 1) === a.charAt(j - 1)
                    ? matrix[i - 1][j - 1]
                    : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
    }
    return matrix[b.length][a.length];
}
