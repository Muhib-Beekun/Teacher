import { SttFix } from '../session/types';

/** Fast local fixes for common dev-voice STT mistakes (always applied before LLM polish). */
const PHRASE_RULES: { pattern: RegExp; replacement: string }[] = [
    { pattern: /\bobama\b/gi, replacement: 'Ollama' },
    { pattern: /\bolama\b/gi, replacement: 'Ollama' },
    { pattern: /\b(?:croc|rock|crock|grok)\s+api\s+key\b/gi, replacement: 'INFERENCE_API_KEY' },
    { pattern: /\binference\s+api\s+key\b/gi, replacement: 'INFERENCE_API_KEY' },
    { pattern: /\bsign language\b/gi, replacement: 'design language' },
    { pattern: /\bancient prompt\b/gi, replacement: 'agent prompt' },
    { pattern: /\bagents prompt\b/gi, replacement: 'agent prompt' },
    { pattern: /\bcoated 14b\b/gi, replacement: 'coder:14b' },
    { pattern: /\bwhen 2\.5\b/gi, replacement: 'qwen2.5' },
    { pattern: /\blang fuse\b/gi, replacement: 'Langfuse' },
    { pattern: /\blaying off fuse\b/gi, replacement: 'Langfuse' }
];

export function applyDevVoiceLexicon(text: string): { text: string; fixes: SttFix[] } {
    if (!text.trim()) {
        return { text, fixes: [] };
    }

    const fixes: SttFix[] = [];
    let result = text;

    for (const rule of PHRASE_RULES) {
        result = result.replace(rule.pattern, (match) => {
            const corrected = preserveCase(match, rule.replacement);
            if (match !== corrected) {
                fixes.push({ heard: match, corrected, heardOriginal: match });
            }
            return corrected;
        });
    }

    return { text: result, fixes: dedupeFixes(fixes) };
}

function dedupeFixes(fixes: SttFix[]): SttFix[] {
    const seen = new Set<string>();
    return fixes.filter((f) => {
        const key = `${f.heard.toLowerCase()}→${f.corrected.toLowerCase()}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
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
