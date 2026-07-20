/** Shared camelCase / multi-word symbol utilities for STT homonym pass and Target inference. */

export function splitCamelCase(term: string): string[] {
    return term
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/[\s._-]+/)
        .filter((p) => p.length > 0);
}

export function compactAlpha(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/gi, '');
}

export function looksLikeCodeSymbol(term: string): boolean {
    return /[@./_-]|[A-Z].*[a-z]|[a-z]+[A-Z]/.test(term) && term.length >= 4;
}

/** Spoken form of BrowserSessionBridge → "browser session bridge". */
export function spokenSymbolPhrase(term: string): string {
    return splitCamelCase(term)
        .map((p) => p.toLowerCase())
        .join(' ');
}

/**
 * True if speech references a camelCase symbol (spaced, compact, or per-word fuzzy).
 */
export function speechMentionsSymbol(speechLower: string, term: string): boolean {
    if (!looksLikeCodeSymbol(term) || term.includes('/')) {
        return false;
    }

    const parts = splitCamelCase(term).map((p) => p.toLowerCase());
    if (parts.length < 2) {
        return speechLower.includes(term.toLowerCase());
    }

    const phrase = parts.join(' ');
    if (speechLower.includes(phrase)) {
        return true;
    }

    const compactTerm = compactAlpha(term);
    const compactSpeech = compactAlpha(speechLower);
    if (compactTerm.length >= 8 && compactSpeech.includes(compactTerm)) {
        return true;
    }

    return orderedPartsInSpeech(speechLower, parts);
}

function orderedPartsInSpeech(speechLower: string, parts: string[]): boolean {
    const words = speechLower.match(/[a-z0-9]+/gi) ?? [];
    if (words.length < parts.length) {
        return false;
    }

    for (let start = 0; start <= words.length - parts.length; start++) {
        let ok = true;
        for (let i = 0; i < parts.length; i++) {
            if (!wordMatchesPart(words[start + i], parts[i])) {
                ok = false;
                break;
            }
        }
        if (ok) {
            return true;
        }
    }
    return false;
}

function wordMatchesPart(word: string, part: string): boolean {
    const w = word.toLowerCase();
    const p = part.toLowerCase();
    if (w === p) {
        return true;
    }
    if (p.length < 4) {
        return w === p;
    }
    const dist = levenshtein(w, p);
    const maxLen = Math.max(w.length, p.length);
    return dist <= 1 && maxLen >= 4;
}

export interface PhraseSymbolFix {
    heard: string;
    corrected: string;
    start: number;
    end: number;
}

/** Stem for phrase matching — strip a trailing file extension when present. */
function symbolStemForPhraseMatch(term: string): string | null {
    if (!term || term.includes('/')) {
        return null;
    }
    const stem = term.includes('.') ? term.replace(/\.[^.]+$/, '') : term;
    if (!looksLikeCodeSymbol(stem)) {
        return null;
    }
    return stem;
}

/** Find multi-word spoken phrases that should be a single camelCase dictionary symbol. */
export function findPhraseSymbolFixes(text: string, dictionary: string[]): PhraseSymbolFix[] {
    const fixes: PhraseSymbolFix[] = [];
    const lower = text.toLowerCase();

    for (const term of dictionary) {
        const stem = symbolStemForPhraseMatch(term);
        if (!stem) {
            continue;
        }
        const parts = splitCamelCase(stem).map((p) => p.toLowerCase());
        if (parts.length < 2) {
            continue;
        }

        const phrase = parts.join(' ');
        const idx = lower.indexOf(phrase);
        if (idx >= 0) {
            fixes.push({
                heard: text.slice(idx, idx + phrase.length),
                corrected: stem,
                start: idx,
                end: idx + phrase.length
            });
            continue;
        }

        const windowFix = findSlidingWindowFix(text, stem, parts);
        if (windowFix) {
            fixes.push(windowFix);
        }
    }

    return dedupeOverlapping(fixes);
}

function findSlidingWindowFix(text: string, term: string, parts: string[]): PhraseSymbolFix | null {
    const wordRe = /[a-zA-Z0-9]+/g;
    const words: { text: string; start: number; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = wordRe.exec(text)) !== null) {
        words.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    }
    if (words.length < parts.length) {
        return null;
    }

    for (let i = 0; i <= words.length - parts.length; i++) {
        let matched = true;
        for (let j = 0; j < parts.length; j++) {
            if (!wordMatchesPart(words[i + j].text, parts[j])) {
                matched = false;
                break;
            }
        }
        if (!matched) {
            continue;
        }
        const start = words[i].start;
        const end = words[i + parts.length - 1].end;
        const heard = text.slice(start, end);
        if (heard === term) {
            return null;
        }
        return { heard, corrected: term, start, end };
    }
    return null;
}

function dedupeOverlapping(fixes: PhraseSymbolFix[]): PhraseSymbolFix[] {
    const sorted = [...fixes].sort((a, b) => b.heard.length - a.heard.length || a.start - b.start);
    const used: { start: number; end: number }[] = [];
    const out: PhraseSymbolFix[] = [];
    for (const fix of sorted) {
        if (used.some((u) => overlaps(u, fix))) {
            continue;
        }
        used.push({ start: fix.start, end: fix.end });
        out.push(fix);
    }
    return out.sort((a, b) => b.start - a.start);
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
    return a.start < b.end && b.start < a.end;
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
