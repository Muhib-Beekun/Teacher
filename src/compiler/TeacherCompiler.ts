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
    const intentSegments = getIntentSegments(active);

    const goal = extractGoal(active, intentSegments);
    const constraints = extractConstraints(active);
    const verification = extractVerification(active);
    const latestText = intentSegments.length ? intentSegments[intentSegments.length - 1].text : '';
    const target = extractTarget(latestText, voiceContext);
    const priorChunks = intentSegments.slice(0, -1).map((s) => s.text).filter(Boolean);
    const supersededQuotes = [
        ...superseded.map((s) => s.text).filter(Boolean),
        ...priorChunks
    ];

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

function getIntentSegments(active: Segment[]): Segment[] {
    return active.filter(
        (s) =>
            !/^(ignore that|disregard that|scratch that|forget that)\b/i.test(s.text.trim()) &&
            !s.tags.some((t) => t.kind === 'retract' && t.scope === 'previous_segment')
    );
}

function extractGoal(active: Segment[], intentSegments?: Segment[]): string {
    for (let i = active.length - 1; i >= 0; i--) {
        const correct = active[i].tags.find((t) => t.kind === 'correct');
        if (correct && correct.kind === 'correct' && correct.phrase) {
            return correct.phrase;
        }
    }

    const intents = intentSegments ?? getIntentSegments(active);

    if (!intents.length) {
        return 'No current intent detected yet.';
    }

    return intents[intents.length - 1].text;
}

function extractConstraints(active: Segment[]): string[] {
    const items: string[] = [];
    for (const seg of active) {
        for (const tag of seg.tags) {
            if (tag.kind === 'constraint') {
                items.push(tag.text);
            }
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
        return [];
    }
    return items;
}

function extractTarget(latestSpeech: string, voiceContext: VoiceSessionContext): string[] {
    const targets = new Set<string>();
    if (!latestSpeech.trim()) {
        return [];
    }
    const speech = latestSpeech;
    const speechLower = speech.toLowerCase();

    const pathLike = speech.match(/[`'"]?([\w./\\-]+\.(ts|tsx|js|jsx|py|go|rs|md|html|json|mjs))[`'"]?/gi);
    if (pathLike) {
        for (const match of pathLike) {
            targets.add(match.replace(/[`'"]/g, ''));
        }
    }

    for (const file of voiceContext.targetFiles) {
        const base = file.split(/[/\\]/).pop() ?? file;
        if (speech.includes(file) || speechLower.includes(base.toLowerCase())) {
            targets.add(file);
        }
    }

    for (const term of voiceContext.dictionary_context.slice(0, 50)) {
        if (term.includes('.') && speechLower.includes(term.toLowerCase())) {
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
        ...(verification.length ? verification.map((v) => `- ${v}`) : ['- (none yet — say how to verify when ready)']),
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
