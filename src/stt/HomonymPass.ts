import { SttFix } from '../session/types';

/** Apply workspace dictionary corrections — conservative; opt-in via teacher.stt.homonymPass. */
export function applyHomonymPass(text: string, dictionary: string[]): { text: string; fixes: SttFix[] } {
    if (!text.trim() || !dictionary.length) {
        return { text, fixes: [] };
    }

    const fixes: SttFix[] = [];
    const tokens = text.split(/(\s+|[.,!?;:'"()[\]{}])/);
    const corrected = tokens.map((token) => {
        if (!token.trim() || token.trim().length < 3) {
            return token;
        }
        const match = findBestDictionaryMatch(token, dictionary);
        if (match && match.term.toLowerCase() !== token.toLowerCase()) {
            fixes.push({ heard: token, corrected: match.term });
            return preserveCase(token, match.term);
        }
        return token;
    });

    return { text: corrected.join(''), fixes };
}

function findBestDictionaryMatch(word: string, dictionary: string[]): { term: string; score: number } | null {
    const lower = word.toLowerCase().replace(/[^a-z0-9_@./-]/gi, '');
    if (lower.length < 3) {
        return null;
    }

    let best: { term: string; score: number } | null = null;
    for (const term of dictionary) {
        const t = term.toLowerCase();
        if (t.length < 3 || !looksLikeCodeTerm(term)) {
            continue;
        }
        const dist = levenshtein(lower, t);
        const maxLen = Math.max(lower.length, t.length);
        const similarity = 1 - dist / maxLen;
        if (similarity >= 0.9 && dist <= 2) {
            if (!best || similarity > best.score) {
                best = { term, score: similarity };
            }
        }
    }
    return best;
}

function looksLikeCodeTerm(term: string): boolean {
    return /[@./_-]|[A-Z].*[a-z]|[a-z]+[A-Z]/.test(term);
}

function preserveCase(original: string, replacement: string): string {
    if (original === original.toUpperCase()) {
        return replacement.toUpperCase();
    }
    if (original[0] === original[0]?.toUpperCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
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
