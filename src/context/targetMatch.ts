import { VoiceSessionContext } from './VoiceSessionContext';
import { looksLikeResolvableSymbol, linkSymbolToOpenFile } from './targetMatchInternals';
import { speechMentionsSymbol, compactAlpha } from '../stt/symbolPhraseMatch';

/** Infer ## Target file paths from speech + vectorless workspace context. */
export function extractWorkspaceTargets(latestSpeech: string, voiceContext: VoiceSessionContext): string[] {
    const targets = new Set<string>();
    if (!latestSpeech.trim()) {
        return [];
    }

    const speech = latestSpeech;
    const speechLower = speech.toLowerCase();

    for (const match of speech.match(/[`'"]?([\w./\\-]+\.(ts|tsx|js|jsx|py|go|rs|md|html|json|mjs|cjs))[`'"]?/gi) ?? []) {
        targets.add(match.replace(/[`'"]/g, ''));
    }

    for (const file of voiceContext.targetFiles) {
        const base = file.split(/[/\\]/).pop() ?? file;
        const baseNoExt = base.replace(/\.[^.]+$/, '');
        if (
            speech.includes(file) ||
            speechLower.includes(base.toLowerCase()) ||
            fuzzyMentionsBasename(speechLower, baseNoExt) ||
            fuzzyMentionsBasename(speechLower, base)
        ) {
            targets.add(file);
        }
    }

    for (const term of voiceContext.dictionary_context) {
        const lower = term.toLowerCase();
        if (term.includes('.') && speechLower.includes(lower)) {
            targets.add(term);
            continue;
        }
        if (!looksLikeResolvableSymbol(term)) {
            continue;
        }
        if (!speechMentionsSymbol(speechLower, term) && !fuzzyMentionsBasename(speechLower, term)) {
            continue;
        }
        const linked = linkSymbolToOpenFile(term, voiceContext.targetFiles);
        if (linked) {
            targets.add(linked);
        }
    }

    return [...targets];
}

/** @deprecated use speechMentionsSymbol — kept for tests importing fuzzyMentions */
export function fuzzyMentions(speechLower: string, term: string): boolean {
    if (speechMentionsSymbol(speechLower, term)) {
        return true;
    }
    return fuzzyMentionsBasename(speechLower, term);
}

function fuzzyMentionsBasename(speechLower: string, term: string): boolean {
    const needle = term.toLowerCase().replace(/[^a-z0-9_@./-]/gi, '');
    if (needle.length < 3) {
        return false;
    }
    if (speechLower.includes(needle)) {
        return true;
    }

    const compactSpeech = compactAlpha(speechLower);
    const compactNeedle = compactAlpha(needle);
    if (compactNeedle.length >= 5 && compactSpeech.includes(compactNeedle)) {
        return true;
    }

    const words = speechLower.split(/\s+/).filter((w) => w.length >= 3);
    for (const word of words) {
        const w = word.replace(/[^a-z0-9]/gi, '');
        if (w.length < 3) {
            continue;
        }
        const dist = levenshtein(w, compactNeedle);
        const maxLen = Math.max(w.length, compactNeedle.length);
        if (maxLen >= 4 && dist <= 2 && 1 - dist / maxLen >= 0.75) {
            return true;
        }
    }

    if (needle.includes('-')) {
        const spaced = needle.replace(/-/g, ' ');
        if (speechLower.includes(spaced)) {
            return true;
        }
        const parts = needle.split('-').filter((p) => p.length >= 2);
        if (parts.length >= 2 && parts.every((p) => speechLower.includes(p.toLowerCase()))) {
            return true;
        }
    }

    return false;
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
