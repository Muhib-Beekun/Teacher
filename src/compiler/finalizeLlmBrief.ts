import { ensureSessionInBrief } from './buildCompilePrompt';
import {
    isPlaceholderGoal,
    isVerbatimTranscriptBrief,
    normalizeLlmBriefMarkdown,
    parseCompiledMarkdown
} from './parseCompiledMarkdown';
import { CompiledBrief, Segment } from '../session/types';

export type CompileFinalizeFailureReason = 'malformed' | 'verbatim';

export type FinalizeLlmBriefResult =
    | { ok: true; brief: CompiledBrief }
    | { ok: false; reason: CompileFinalizeFailureReason; message: string; preview: string };

const PREVIEW_MAX = 480;

/** Parse, normalize, inject session, and validate LLM compile output. */
export function finalizeLlmCompiledBrief(rawMarkdown: string, segments: Segment[]): FinalizeLlmBriefResult {
    const normalized = normalizeLlmBriefMarkdown(rawMarkdown);
    let brief = parseCompiledMarkdown(normalized);
    brief = ensureSessionInBrief(brief, segments);

    if (isVerbatimTranscriptBrief(brief, segments)) {
        return {
            ok: false,
            reason: 'verbatim',
            message: 'Compiler returned a verbatim transcript instead of a synthesized agent brief',
            preview: truncatePreview(rawMarkdown)
        };
    }

    const validationError = validateParsedBrief(brief, segments);
    if (validationError) {
        return {
            ok: false,
            reason: 'malformed',
            message: validationError,
            preview: truncatePreview(rawMarkdown)
        };
    }

    return { ok: true, brief };
}

export function validateParsedBrief(brief: CompiledBrief, segments: Segment[]): string | undefined {
    const activeSegments = segments.filter((s) => !s.superseded);
    const goalUsable = !isPlaceholderGoal(brief.goal);
    const hasSession = brief.sessionLog.length > 0;
    const hasTargets = brief.target.length > 0;
    const hasConstraints = brief.constraints.length > 0;
    const hasVerification = brief.verification.length > 0;
    const hasRecoverableContent = hasSession || hasTargets || hasConstraints || hasVerification;

    if (goalUsable) {
        return undefined;
    }

    if (activeSegments.length > 0 && hasSession) {
        return undefined;
    }

    if (hasRecoverableContent) {
        return undefined;
    }

    return 'Compile output missing usable Goal or session content after parsing';
}

export function truncatePreview(text: string, max = PREVIEW_MAX): string {
    const oneLine = text.replace(/\s+/g, ' ').trim();
    if (oneLine.length <= max) {
        return oneLine;
    }
    return `${oneLine.slice(0, max)}…`;
}

export const REFORMAT_COMPILE_SYSTEM = `Convert the assistant's previous draft into valid Teacher brief markdown.

Use exactly these sections: ## Goal, ## Target, optional ## Constraints / ## Verification, ## Session - your words, then --- and:
**Reference only (superseded - do not implement unless asked again)**

Output ONLY the markdown brief. No preamble, apologies, or code fences.`;

export function buildReformatCompileUser(previousOutput: string): string {
    const body = previousOutput.length > 8000 ? `${previousOutput.slice(0, 8000)}…` : previousOutput;
    return `Previous output to reformat into valid Teacher brief markdown:\n\n${body}`;
}
