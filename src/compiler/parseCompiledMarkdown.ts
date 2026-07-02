import { CompiledBrief } from '../session/types';
import { diffWordFixes } from '../stt/wordDiffFixes';

const PLACEHOLDER_PATTERNS = [
    /^\(none/i,
    /^no targets inferred/i,
    /^none yet/i,
    /^none detected/i,
    /^no superseded/i
];

const GARBAGE_LINE = /^-{2,}$|^-?\s*---+\s*$|^\*\*reference only/i;

/** Parse Teacher markdown brief from LLM output into structured fields. */
export function parseCompiledMarkdown(markdown: string): CompiledBrief {
    const goal = extractSection(markdown, 'Goal') || 'No current intent detected yet.';
    const target = sanitizeBullets(extractBulletList(markdown, 'Target'));
    const constraints = sanitizeBullets(extractBulletList(markdown, 'Constraints'));
    const verification = sanitizeBullets(extractBulletList(markdown, 'Verification'));
    const sessionLog = sanitizeSessionBullets(sanitizeBullets(extractSessionLog(markdown)));
    const superseded = sanitizeSuperseded(extractSuperseded(markdown));

    const brief: CompiledBrief = {
        markdown: '',
        goal: goal.trim(),
        target,
        constraints,
        verification,
        sessionLog,
        superseded
    };
    brief.markdown = formatBriefMarkdown(brief);
    return brief;
}

/** Rebuild clean agent markdown (no stray --- in Verification, tight reference block). */
export function formatBriefMarkdown(brief: CompiledBrief): string {
    const lines: string[] = ['## Goal', brief.goal.trim(), ''];

    lines.push('## Target');
    if (brief.target.length) {
        lines.push(...brief.target.map((t) => `- ${t}`));
    } else {
        lines.push('- (no targets inferred: speak file paths; browser UI cannot open files)');
    }
    lines.push('');

    if (brief.constraints.length) {
        lines.push('## Constraints');
        lines.push(...brief.constraints.map((c) => `- ${c}`));
        lines.push('');
    }

    if (brief.verification.length) {
        lines.push('## Verification');
        lines.push(...brief.verification.map((v) => `- ${v}`));
        lines.push('');
    }

    if (brief.sessionLog.length) {
        lines.push('## Session - your words');
        lines.push('*Audit trail: how the speaker arrived at this brief. Read alongside Goal for corrections and thought process.*');
        lines.push(...brief.sessionLog.map((s) => `- ${s}`));
        lines.push('');
    }

    lines.push('---');
    lines.push('**Reference only (superseded - do not implement unless asked again)**');
    if (brief.superseded.length) {
        lines.push(...brief.superseded.map((s) => `- ${s}`));
    } else {
        lines.push('- No superseded items detected yet.');
    }

    return lines.join('\n').trim();
}

function extractSection(md: string, heading: string): string {
    const re = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|\\n---\\s*\\n|$)`, 'i');
    const match = md.match(re);
    if (!match) {
        return '';
    }
    return match[1].trim();
}

function extractBulletList(md: string, heading: string): string[] {
    const body = extractSection(md, heading);
    if (!body) {
        return [];
    }
    return body
        .split('\n')
        .map((line) => line.replace(/^[-*]\s+/, '').replace(/^`(.+)`$/, '$1').trim())
        .filter((line) => line.length > 0);
}

function sanitizeBullets(items: string[]): string[] {
    return items.filter((line) => {
        if (GARBAGE_LINE.test(line)) {
            return false;
        }
        if (PLACEHOLDER_PATTERNS.some((p) => p.test(line))) {
            return false;
        }
        return true;
    });
}

function sanitizeSessionBullets(items: string[]): string[] {
    return items.filter((line) => {
        const stripped = line.replace(/^\*+|\*+$/g, '').trim();
        if (/^audit trail:/i.test(stripped)) {
            return false;
        }
        return stripped.length > 0;
    });
}

function extractSessionLog(md: string): string[] {
    const body =
        extractSection(md, 'Session - your words') ||
        extractSection(md, 'Session — your words') ||
        extractSection(md, 'Session');
    if (!body) {
        return [];
    }
    return body
        .split('\n')
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter((line) => line.length > 0);
}

function extractSuperseded(md: string): string[] {
    const marker = '**Reference only (superseded';
    const idx = md.indexOf(marker);
    if (idx < 0) {
        return [];
    }
    const tail = md.slice(idx);
    return tail
        .split('\n')
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter((line) => line.length > 0);
}

function sanitizeSuperseded(items: string[]): string[] {
    return items
        .filter((line) => !line.startsWith('**') && !GARBAGE_LINE.test(line))
        .filter((line) => !PLACEHOLDER_PATTERNS.some((p) => p.test(line)))
        .map(stripSegmentWeightPrefix)
        .filter(Boolean);
}

/** Remove compile prompt metadata like "1 [PRIOR — ...]. text" → text */
function stripSegmentWeightPrefix(line: string): string {
    return line
        .replace(/^\d+\s*\[(?:LATEST|RECENT|PRIOR)[^\]]*\]\.\s*/i, '')
        .replace(/^\d+\.\s*/, '')
        .trim();
}

/** Detect phrase-level STT fixes between adjacent pipeline stages (not full-utterance word diff). */
export function detectPhraseFixes(before: string, after: string): { heard: string; corrected: string }[] {
    return diffWordFixes(before, after);
}
