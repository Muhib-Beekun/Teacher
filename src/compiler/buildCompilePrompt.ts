import { Segment } from '../session/types';
import { VoiceSessionContext } from '../context/VoiceSessionContext';
import { CompiledBrief } from '../session/types';
import { formatBriefMarkdown } from './parseCompiledMarkdown';

/** Role label for Your Words pane and ## Session section in agent briefs. */
export function segmentVoiceRole(seg: Segment, index: number): 'included' | 'correction' | 'retraction' | 'superseded' {
    if (seg.superseded) {
        return 'superseded';
    }
    if (seg.tags.some((t) => t.kind === 'retract')) {
        return 'retraction';
    }
    if (index === 0) {
        return 'included';
    }
    return 'correction';
}

export function buildSessionLogFromSegments(segments: Segment[]): string[] {
    return segments
        .map((seg, index) => ({ seg, index }))
        .filter(({ seg }) => !seg.superseded)
        .map(({ seg, index }) => `[${segmentVoiceRole(seg, index)}] ${seg.text}`);
}

export function buildCompilePrompt(
    segments: Segment[],
    ctx: VoiceSessionContext,
    priorBrief?: CompiledBrief
): { system: string; user: string } {
    const system = `You are Teacher: synthesize a continuous voice LECTURE into one Cursor agent brief.

The speaker lectures their AI: segment 1 is the initial ask [included]; every later segment is usually a [correction] or refinement. The agent must understand the FULL lecture, not only the last sentence.

CRITICAL rules:
1. ## Goal = CUMULATIVE synthesized intent from ALL active (non-superseded) segments. Merge earlier asks with later corrections. Never drop substantive prior asks unless retracted.
   **Format:** When there are multiple distinct asks, do NOT write one dense paragraph. Use:
   - One short intro sentence (overall objective).
   - Bulleted chunks: each bullet = one scoped topic or action ("Discuss …", "Implement …", "Fix …").
   - If the speaker wants both analysis and code changes, split them clearly (e.g. discussion bullets vs implementation bullets).
2. Latest segment often refines or corrects: fold it into Goal; do NOT replace the entire Goal with only the latest utterance.
3. Meta-feedback about Teacher, prompt structure, or UI labels IS valid Goal content when that is what the speaker wants changed. The browser tab label is the page **title** (web title), not the topbar header.
4. Write direct agent instructions. Never mention Grok, Teacher, compiler, or that a tool scaffolded this brief.
5. ## Target = file paths explicitly mentioned in speech. If none: - (no targets inferred: speak file paths; browser UI cannot open files)
6. ## Constraints ONLY for enduring rules about the WORK product, not for naming voice segments. Omit if none.
7. ## Verification ONLY when the speaker said how to verify. Omit if none. Never put "---" inside Verification.
8. ## Session — your words (ALWAYS REQUIRED): verbatim list of each active segment with role prefix:
   - [included] first segment text
   - [correction] later segment text
   Include FULL segment text even when there is only one segment. Do NOT repeat the audit-trail disclaimer as a bullet; it is added automatically.
9. Retracted/superseded content only in the reference block at the end, not in Goal or Session.
10. Output ends with a single line "---" then the reference header.
11. NEVER use em dashes (—) anywhere in output. Use a colon, comma, hyphen (-), or rewrite the sentence instead.

Output markdown: ## Goal, ## Target, optional ## Constraints / ## Verification, ## Session - your words (always), then:
---
**Reference only (superseded - do not implement unless asked again)**`;

    const priorBlock = priorBrief
        ? `\nPrevious compiled brief (speaker may be correcting: merge with full session, do not discard prior substance):\n${formatBriefMarkdown(priorBrief)}\n`
        : '';

    const segmentLines = segments
        .map((s, i) => {
            const role = segmentVoiceRole(s, i);
            const tag = s.superseded ? ' (superseded)' : i === segments.length - 1 ? ' (newest)' : '';
            return `${i + 1} [${role}]${tag}. ${s.text}`;
        })
        .join('\n');

    const user = `Workspace context: ${ctx.targetFiles.slice(0, 10).join(', ') || 'none'}
${priorBlock}
Full voice lecture (all segments: synthesize Goal from the whole arc, not newest alone):

${segmentLines}`;

    return { system, user };
}

export function ensureSessionInBrief(brief: CompiledBrief, segments: Segment[]): CompiledBrief {
    const active = segments.filter((s) => !s.superseded);
    if (!active.length) {
        return brief;
    }
    const sessionLog = brief.sessionLog.length > 0
        ? sanitizeSessionLog(brief.sessionLog)
        : buildSessionLogFromSegments(segments);
    if (!sessionLog.length) {
        return brief;
    }
    const updated = { ...brief, sessionLog };
    updated.markdown = formatBriefMarkdown(updated);
    return updated;
}

function sanitizeSessionLog(lines: string[]): string[] {
    return lines
        .map((line) => line.replace(/^\*+|\*+$/g, '').trim())
        .filter((line) => {
            if (!line) {
                return false;
            }
            if (/^audit trail:/i.test(line)) {
                return false;
            }
            return true;
        });
}
