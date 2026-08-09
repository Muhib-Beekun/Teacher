import { formatSegmentLabel } from '../session/RetractionDetector';
import { SessionManager } from '../session/SessionManager';
import { formatBriefMarkdown } from '../compiler/parseCompiledMarkdown';

export {
    buildRelayDispatchText,
    resolveDispatchPayload,
    type DispatchMeta,
    type DispatchMode
} from './dispatchPacket';

/** Full handoff for Cursor agent: compiled brief + complete Your Words audit trail. */
export function buildAgentHandoff(session: SessionManager): string {
    const briefMd = session.getCompiledMarkdown().trim();
    const segments = session.getAnalyzedSegments();
    const raw = session.getSegments();

    const wordsLines = raw.map((seg, index) => {
        const meta = segments[index];
        const role = meta ? formatSegmentLabel(meta, index) : index === 0 ? 'included' : 'correction';
        return `${index + 1}. [${role}] ${seg.text}`;
    });

    const version = session.getLatestBriefVersion();

    const parts: string[] = [
        '# Teacher session handoff',
        '',
        'Use the compiled agent prompt below as the task. Your words are the full lecture audit trail — read them (and any superseded reference in the brief) to understand corrections and what changed.',
        ''
    ];

    if (briefMd && !briefMd.startsWith('Speak')) {
        const header = version ? `## Agent prompt (v${version})` : '## Agent prompt (current)';
        parts.push(header, '', briefMd, '');
    }

    if (wordsLines.length) {
        parts.push('---', '', '## Your words — full session', '', ...wordsLines.map((l) => `- ${l}`), '');
    }

    return parts.join('\n').trim();
}

export function buildWordsOnlyHandoff(session: SessionManager): string {
    return buildAgentHandoff(session);
}

/** Prior brief markdown for compile continuity (current only — no version stack). */
export function priorBriefForCompile(session: SessionManager) {
    const brief = session.getCurrentBrief();
    return brief ?? undefined;
}

export function formatBriefForEval(brief: ReturnType<SessionManager['getCurrentBrief']>): string {
    if (!brief) {
        return '';
    }
    return formatBriefMarkdown(brief);
}
