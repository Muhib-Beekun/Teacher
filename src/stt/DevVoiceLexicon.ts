import { SttFix } from '../session/types';

/** Fast local fixes for common dev-voice STT mistakes (always applied before Grok polish). */
const PHRASE_RULES: { pattern: RegExp; replacement: string }[] = [
    { pattern: /\bobama\b/gi, replacement: 'Ollama' },
    { pattern: /\bolama\b/gi, replacement: 'Ollama' },
    { pattern: /\bcroc\b/gi, replacement: 'Grok' },
    { pattern: /\bbrock\b/gi, replacement: 'Grok' },
    { pattern: /\bsign language\b/gi, replacement: 'design language' },
    { pattern: /\bancient prompt\b/gi, replacement: 'agent prompt' },
    { pattern: /\bagents prompt\b/gi, replacement: 'agent prompt' },
    { pattern: /\bcoated 14b\b/gi, replacement: 'coder:14b' },
    { pattern: /\bwhen 2\.5\b/gi, replacement: 'qwen2.5' }
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
                fixes.push({ heard: match, corrected });
            }
            return corrected;
        });
    }

    if (/\b(brief|compile|grok|xai|inference|teacher|remote|api key)\b/i.test(result)) {
        result = result.replace(/\brock\b/gi, (match) => {
            const corrected = preserveCase(match, 'Grok');
            if (match !== corrected) {
                fixes.push({ heard: match, corrected });
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
