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
3. **Corrections override earlier wording.** When a [correction] segment says "X should be Y" or "I said X but meant Y", you MUST use Y (not X) everywhere in the Goal. The corrected term replaces the original - do not keep the original alongside the correction. Likewise, if the speaker manually edited a segment's text (marked "(edited)"), prefer the edited text over any earlier version.
4. Meta-feedback about Teacher, prompt structure, STT fix UI, send/auto-submit, or compile behavior IS valid Goal content when the speaker wants it fixed. Include EVERY active segment in Goal synthesis — do not skip later segments because they sound meta or UI-related.
5. Write direct agent instructions. Never mention Grok, Teacher, compiler, or that a tool scaffolded this brief.
6. ## Target = file paths explicitly mentioned in speech. If none: - (no targets inferred: speak file paths; browser UI cannot open files)
7. ## Constraints ONLY for enduring rules about the WORK product, not for naming voice segments. Omit if none.
8. ## Verification ONLY when the speaker said how to verify. Omit if none. Never put "---" inside Verification.
9. ## Session — your words (ALWAYS REQUIRED): verbatim list of each active segment with role prefix:
   - [included] first segment text
   - [correction] later segment text
   Include FULL segment text even when there is only one segment. Do NOT repeat the audit-trail disclaimer as a bullet; it is added automatically.
10. Retracted/superseded content only in the reference block at the end, not in Goal or Session.
11. Output ends with a single line "---" then the reference header.
12. NEVER use em dashes (—) anywhere in output. Use a colon, comma, hyphen (-), or rewrite the sentence instead.

Output markdown: ## Goal, ## Target, optional ## Constraints / ## Verification, ## Session - your words (always), then:
---
**Reference only (superseded - do not implement unless asked again)**`;

    const priorBlock = priorBrief
        ? `\nPrevious compiled brief (speaker may be correcting: merge with full session, do not discard prior substance):\n${formatBriefMarkdown(priorBrief)}\n`
        : '';

    const segmentLines = segments
        .map((s, i) => {
            const role = segmentVoiceRole(s, i);
            const tags: string[] = [];
            if (s.superseded) tags.push('superseded');
            if (s.edited) tags.push('edited');
            if (i === segments.length - 1) tags.push('newest');
            const tag = tags.length ? ` (${tags.join(', ')})` : '';
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
    const fromSegments = buildSessionLogFromSegments(segments);
    const fromLlm = sanitizeSessionLog(brief.sessionLog);
    // Session audit trail must list every active segment — do not trust a truncated LLM session block.
    const sessionLog =
        fromLlm.length >= fromSegments.length ? fromLlm : fromSegments;
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
