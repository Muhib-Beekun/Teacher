import { VoiceSessionContext } from '../context/VoiceSessionContext';
import { extractWorkspaceTargets } from '../context/targetMatch';
import { buildSessionLogFromSegments } from './buildCompilePrompt';
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
        sessionLog: [],
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
    const target = extractWorkspaceTargets(latestText, voiceContext);
    const priorChunks = intentSegments.slice(0, -1).map((s) => s.text).filter(Boolean);
    const supersededQuotes = [
        ...superseded.map((s) => s.text).filter(Boolean),
        ...priorChunks
    ];
    const sessionLog = buildSessionLogFromSegments(segments);

    const markdown = formatMarkdown(goal, target, constraints, verification, sessionLog, supersededQuotes);

    return {
        markdown,
        goal,
        target,
        constraints,
        verification,
        sessionLog,
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

function formatMarkdown(
    goal: string,
    target: string[],
    constraints: string[],
    verification: string[],
    sessionLog: string[],
    superseded: string[]
): string {
    const lines: string[] = [
        '## Goal',
        goal,
        '',
        '## Target',
        ...(target.length ? target.map((t) => `- \`${t}\``) : ['- (no targets inferred: speak file paths; browser UI cannot open files)']),
        ''
    ];

    if (constraints.length) {
        lines.push('## Constraints', ...constraints.map((c) => `- ${c}`), '');
    }

    if (verification.length) {
        lines.push('## Verification', ...verification.map((v) => `- ${v}`), '');
    }

    if (sessionLog.length) {
        lines.push(
            '## Session - your words',
            '*Audit trail: how the speaker arrived at this brief. Read alongside Goal for corrections and thought process.*',
            ...sessionLog.map((s) => `- ${s}`),
            ''
        );
    }

    lines.push(
        '---',
        '**Reference only (superseded - do not implement unless asked again)**'
    );

    if (superseded.length) {
        lines.push(...superseded.map((s) => `- ${s}`));
    } else {
        lines.push('- No superseded items detected yet.');
    }

    return lines.join('\n');
}
