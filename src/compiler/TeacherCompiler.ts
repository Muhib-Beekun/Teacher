import { VoiceSessionContext } from '../context/VoiceSessionContext';
import { analyzeSegments } from '../session/RetractionDetector';
import { CompiledBrief, Segment } from '../session/types';

export type CompileMode = 'teacher' | 'verbatim' | 'polish';

export function compileSession(
    rawSegments: string[],
    voiceContext: VoiceSessionContext,
    mode: CompileMode = 'teacher'
): CompiledBrief {
    if (mode === 'verbatim') {
        return compileVerbatim(rawSegments);
    }

    const segments = analyzeSegments(rawSegments);
    return compileTeacher(segments, voiceContext);
}

function compileVerbatim(rawSegments: string[]): CompiledBrief {
    const text = rawSegments.join('\n\n');
    return {
        markdown: text,
        goal: text,
        target: [],
        constraints: [],
        verification: [],
        superseded: []
    };
}

function compileTeacher(segments: Segment[], voiceContext: VoiceSessionContext): CompiledBrief {
    const active = segments.filter((s) => !s.superseded);
    const superseded = segments.filter((s) => s.superseded);

    const goal = extractGoal(active);
    const constraints = extractConstraints(active);
    const verification = extractVerification(active);
    const target = extractTarget(active, voiceContext);
    const supersededQuotes = superseded.map((s) => s.text).filter(Boolean);

    const markdown = formatMarkdown(goal, target, constraints, verification, supersededQuotes);

    return {
        markdown,
        goal,
        target,
        constraints,
        verification,
        superseded: supersededQuotes
    };
}

function extractGoal(active: Segment[]): string {
    for (let i = active.length - 1; i >= 0; i--) {
        const correct = active[i].tags.find((t) => t.kind === 'correct');
        if (correct && correct.kind === 'correct' && correct.phrase) {
            return correct.phrase;
        }
    }

    const intentSegments = active.filter(
        (s) =>
            !/^(ignore that|disregard that|scratch that|forget that)\b/i.test(s.text.trim()) &&
            !s.tags.some((t) => t.kind === 'retract' && t.scope === 'previous_segment')
    );

    if (!intentSegments.length) {
        return 'No current intent detected yet.';
    }

    return intentSegments.map((s) => s.text).join(' ');
}

function extractConstraints(active: Segment[]): string[] {
    const items: string[] = [];
    for (const seg of active) {
        for (const tag of seg.tags) {
            if (tag.kind === 'constraint') {
                items.push(tag.text);
            }
        }
        if (/\b(don't|do not|never|without|must not)\b/i.test(seg.text)) {
            items.push(seg.text);
        }
    }
    return [...new Set(items)];
}

function extractVerification(active: Segment[]): string[] {
    const items: string[] = [];
    for (const seg of active) {
        for (const tag of seg.tags) {
            if (tag.kind === 'verification') {
                items.push(tag.text);
            }
        }
    }
    if (!items.length) {
        items.push('Define how done is verified.');
    }
    return items;
}

function extractTarget(active: Segment[], voiceContext: VoiceSessionContext): string[] {
    const targets = new Set<string>(voiceContext.targetFiles.slice(0, 8));

    const speech = active.map((s) => s.text).join(' ');
    const pathLike = speech.match(/[`'"]?([\w./-]+\.(ts|tsx|js|jsx|py|go|rs|md|html|json))[`'"]?/gi);
    if (pathLike) {
        for (const match of pathLike) {
            targets.add(match.replace(/[`'"]/g, ''));
        }
    }

    for (const term of voiceContext.dictionary_context.slice(0, 20)) {
        if (speech.toLowerCase().includes(term.toLowerCase()) && term.includes('.')) {
            targets.add(term);
        }
    }

    return [...targets];
}

function formatMarkdown(
    goal: string,
    target: string[],
    constraints: string[],
    verification: string[],
    superseded: string[]
): string {
    const lines: string[] = [
        '## Goal',
        goal,
        '',
        '## Target',
        ...(target.length ? target.map((t) => `- \`${t}\``) : ['- (no targets inferred — open files or speak file paths)']),
        '',
        '## Constraints',
        ...(constraints.length ? constraints.map((c) => `- ${c}`) : ['- (none detected)']),
        '',
        '## Verification',
        ...verification.map((v) => `- ${v}`),
        '',
        '---',
        '**Reference only (superseded — do not implement unless asked again)**'
    ];

    if (superseded.length) {
        lines.push(...superseded.map((s) => `- ${s}`));
    } else {
        lines.push('- No superseded items detected yet.');
    }

    return lines.join('\n');
}
