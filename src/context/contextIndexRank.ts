export interface TermCandidate {
    term: string;
    score: number;
    source: 'symbol' | 'dependency' | 'basename' | 'codeword' | 'open_file' | 'env';
}

export function rankAndCapTerms(candidates: TermCandidate[], maxTerms: number): string[] {
    const byTerm = new Map<string, { score: number; term: string }>();
    for (const { term, score } of candidates) {
        const normalized = term.trim();
        if (!normalized) {
            continue;
        }
        const key = normalized.toLowerCase();
        const prev = byTerm.get(key);
        if (!prev || score > prev.score) {
            byTerm.set(key, { score, term: normalized });
        }
    }

    return [...byTerm.values()]
        .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
        .slice(0, maxTerms)
        .map(({ term }) => term);
}

export function buildSttPromptFromTerms(terms: string[]): string {
    if (!terms.length) {
        return '';
    }
    const priority = terms.slice(0, 40).join(', ');
    const more = terms.length > 40 ? `, ${terms.slice(40, 80).join(', ')}` : '';
    return (
        `Software development dictation. Terms: ${priority}${more}. ` +
        'Common corrections: VS Code, Cursor, GitHub, Whisper, Ollama, INFERENCE_API_KEY not croc/rock API key, ' +
        'design language not sign language, agent prompt.'
    );
}

export function applyUtteranceBoost(candidates: TermCandidate[], utterance: string): void {
    const lower = utterance.toLowerCase();
    if (!lower) {
        return;
    }
    for (const candidate of candidates) {
        if (lower.includes(candidate.term.toLowerCase())) {
            candidate.score += 40;
        }
    }
}

export function isUsefulContextTerm(term: string): boolean {
    if (term.length < 2 || term.length > 80) {
        return false;
    }
    if (/^[\d_]+$/.test(term)) {
        return false;
    }
    // Markdown heading symbols / prose (often from open .md files) used to fill the
    // 200-term STT dictionary after the tiered index, so code symbols never ranked
    // and heard→corrected UI stopped appearing.
    if (/^\s*#/.test(term) || /\s/.test(term)) {
        return false;
    }
    if (!/[A-Za-z]/.test(term)) {
        return false;
    }
    return true;
}
