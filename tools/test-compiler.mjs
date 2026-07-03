#!/usr/bin/env node
import { compileSession } from '../out/compiler/TeacherCompiler.js';
import { buildSessionLogFromSegments, ensureSessionInBrief } from '../out/compiler/buildCompilePrompt.js';
import { analyzeSegments, formatSegmentLabel } from '../out/session/RetractionDetector.js';
import { emptyVoiceSessionContext } from '../out/context/VoiceSessionContext.js';

const ctx = emptyVoiceSessionContext();
ctx.targetFiles = ['src/ui/TeacherSessionPanel.ts', 'package.json', 'tools/mic-sidecar-server.mjs'];

let failed = false;
function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        failed = true;
    }
}

const seg1 = 'Fix the microphone icon to use a blue line icon and add a waveform beneath it.';
const seg2 = 'Remove the type instead button and add a spinner while processing.';
const seg3 = 'Use open line icons for copy and send to agent with double chevron.';

const brief = compileSession([seg1, seg2, seg3], ctx, 'teacher');

assert(!brief.goal.includes(seg1), 'goal must not contain first segment');
assert(brief.goal.includes('double chevron') || brief.goal === seg3, 'goal should be latest segment only');
assert(brief.superseded.some((s) => s.includes('microphone icon')), 'earlier segments should land in superseded');
assert(
    !brief.target.includes('TeacherSessionPanel.ts') || brief.goal.includes('TeacherSessionPanel'),
    'targets should not include unmentioned workspace files'
);

const correction = compileSession(
    [seg1, 'actually I meant use SVG stroke icons not emoji for everything'],
    ctx,
    'teacher'
);
assert(
    correction.goal.toLowerCase().includes('svg') || correction.goal.toLowerCase().includes('stroke'),
    'inline actually correction should drive goal'
);

const { detectPhraseFixes, parseCompiledMarkdown } = await import('../out/compiler/parseCompiledMarkdown.js');

const sttFixes = detectPhraseFixes(
    'keep the sign language consistent with the voice entry side',
    'keep the design language consistent with the voice entry side'
);
assert(sttFixes.some((f) => f.heard.toLowerCase().includes('sign')), 'should detect sign→design fix');

const { diffWordFixes, diffFixRanges } = await import('../out/stt/wordDiffFixes.js');
const { filterSpuriousFixes, heardDisplayForFix } = await import('../out/stt/fixQuality.js');
const crocFixes = diffFixRanges(
    'teacher inference Croc API key should just be inference API key',
    'teacher inference INFERENCE_API_KEY should just be inference API key'
);
assert(crocFixes.some((r) => r.fix.corrected === 'INFERENCE_API_KEY'), 'croc API key→INFERENCE_API_KEY');
assert(
    heardDisplayForFix({ heard: 'Grok API key', corrected: 'INFERENCE_API_KEY' }, 'teacher inference Croc API key'),
    'Croc API key'
);
const spurious = filterSpuriousFixes([
    { heard: 'Grok API key', corrected: 'INFERENCE_API_KEY' },
    { heard: 'key', corrected: 'INFERENCE_API_KEY' }
], 'teacher inference INFERENCE_API_KEY');
assert(spurious.length === 1 && spurious[0].heard.includes('API key'), 'drop key→INFERENCE_API_KEY artifact');
const launchRaw =
    "and I don't know exactly how but it should be made painfully obvious to the user exactly how they're supposed to like launch web browser";
const launchFinal =
    "and I don't know exactly how but it should be made painfully obvious to the user exactly how they're supposed to launch the web browser";
const launchSpurious = filterSpuriousFixes(
    [
        { heard: 'like', corrected: 'launch', source: 'polish' },
        { heard: 'launch', corrected: 'the', source: 'polish' }
    ],
    launchFinal,
    launchRaw
);
assert(launchSpurious.length === 0, 'drop like→launch and launch→the polish rephrase artifacts');
const polishFixes = diffWordFixes(
    "they're also should be no em dashes and tell maybe later",
    'there also should be no em dashes until maybe later'
);
assert(polishFixes.some((f) => f.corrected === 'until'), 'unequal polish should still record until fix');
assert(polishFixes.length >= 1, 'polish diff should record at least one fix');

const messy = parseCompiledMarkdown(`## Goal
No action needed.

## Target
- (no targets inferred — open files or speak file paths)

## Verification
- (none yet — say how to verify when ready)
- ---

---
**Reference only (superseded — do not implement unless asked again)**
- 1 [PRIOR — background]. earlier words here`);
assert(!messy.verification.some((v) => /^-{2,}$/.test(v) || v.includes('---')), 'no --- lines in verification');
assert(!messy.verification.some((v) => /^\(none yet/.test(v)), 'placeholder verification filtered');
assert(!messy.markdown.includes('## Verification'), 'formatted markdown omits verification when empty');
assert(messy.superseded[0]?.includes('[PRIOR') === false, 'superseded should strip weight prefix');

const segs = analyzeSegments([
    'Update the agent prompt to be generic.',
    'The first segment is included not constraint — later ones are corrections.'
]);
assert(formatSegmentLabel(segs[0], 0) === 'included', 'segment 1 label = included');
assert(formatSegmentLabel(segs[1], 1) === 'correction', 'segment 2 label = correction');
const sessionLog = buildSessionLogFromSegments(segs);
assert(sessionLog.length === 2, 'session log has both segments');
assert(sessionLog[0].startsWith('[included]'), 'session log marks included');
assert(sessionLog[1].startsWith('[correction]'), 'session log marks correction');

const singleSegBrief = parseCompiledMarkdown(`## Goal
Update the page title punctuation.

## Target
- (no targets inferred — open files or speak file paths)`);
const singleSegs = analyzeSegments(['Use a colon in the web title instead of an em dash.']);
const withSession = ensureSessionInBrief(singleSegBrief, singleSegs);
assert(withSession.sessionLog.length === 1, 'single segment still gets session log');
assert(withSession.sessionLog[0].startsWith('[included]'), 'single segment session uses included');
assert(withSession.markdown.includes('## Session - your words'), 'single-segment markdown includes session section');

const dupBrief = parseCompiledMarkdown(`## Goal\nTest.\n\n## Session - your words\n*Audit trail: foo.*\n- *Audit trail: foo.*\n- [included] hello`);
assert(dupBrief.sessionLog.length === 1, 'duplicate audit disclaimer stripped from session log');
assert(dupBrief.sessionLog[0].startsWith('[included]'), 'session log keeps segment after dedupe');

const truncatedSessionBrief = parseCompiledMarkdown(`## Goal
Release pipeline and Whisper.

## Target
- (no targets inferred — open files or speak file paths)

## Session - your words
- [included] first segment about releases.
- [correction] second about Whisper.`);
const sevenSegs = analyzeSegments([
    'First segment about releases.',
    'Second about Whisper.',
    'Third about VS Code send.',
    'Fourth correction on VS Code not TV.',
    'Fifth about cursor reliance.',
    'Sixth about fix highlight UI.',
    'Seventh wondering if this one appears.'
]);
const backfilled = ensureSessionInBrief(truncatedSessionBrief, sevenSegs);
assert(backfilled.sessionLog.length === 7, 'truncated LLM session log backfilled from all segments');
assert(backfilled.sessionLog[6].includes('Seventh'), 'latest segment present after backfill');

const { finalizeLlmCompiledBrief } = await import('../out/compiler/finalizeLlmBrief.js');
const { normalizeLlmBriefMarkdown } = await import('../out/compiler/parseCompiledMarkdown.js');

const longSeg =
    'We need to refactor the compile validation so it parses model output before rejecting it instead of requiring an exact heading substring match in the raw text.';
const longSegs = analyzeSegments([longSeg]);

function assertFinalizeOk(raw, label, segs = longSegs) {
    const r = finalizeLlmCompiledBrief(raw, segs);
    assert(r.ok, `${label}: ${!r.ok ? r.message : 'ok'}`);
    if (r.ok) {
        assert(r.brief.markdown.includes('## Goal'), `${label}: canonical markdown has ## Goal`);
    }
}

assertFinalizeOk(
    `## goal
Refactor compile validation to parse before rejecting.`,
    'lowercase ## goal heading'
);

assertFinalizeOk(
    `Goal: Refactor compile validation to parse before rejecting.

## Target
- src/providers/compile/CompileService.ts`,
    'Goal: label without markdown heading'
);

assertFinalizeOk(
    `Here is the synthesized brief for your voice session.

## Goal
Refactor compile validation to parse before rejecting.

## Target
- src/providers/compile/CompileService.ts`,
    'prose preamble before first heading'
);

const missingSessionResult = finalizeLlmCompiledBrief(
    `## Goal
Refactor compile validation.

## Target
- src/providers/compile/CompileService.ts`,
    longSegs
);
assert(missingSessionResult.ok, 'missing session heading with active segments');
assert(
    missingSessionResult.ok && missingSessionResult.brief.sessionLog.length === 1,
    'missing session heading injects session log from segments'
);

assertFinalizeOk(
    `\`\`\`markdown
## Goal
Refactor compile validation to parse before rejecting.

## Target
- src/providers/compile/CompileService.ts
\`\`\``,
    'fenced markdown wrapper'
);

const verbatimResult = finalizeLlmCompiledBrief(
    `## Goal
${longSeg}

## Target
- (no targets inferred: speak file paths; browser UI cannot open files)`,
    longSegs
);
assert(!verbatimResult.ok && verbatimResult.reason === 'verbatim', 'verbatim transcript still rejected');

const emptyResult = finalizeLlmCompiledBrief('Thanks for using Teacher!', analyzeSegments([]));
assert(!emptyResult.ok && emptyResult.reason === 'malformed', 'empty unusable output still rejected');

const normalized = normalizeLlmBriefMarkdown('Preamble\n\n## goal\nFix it.');
assert(normalized.startsWith('## goal'), 'normalize strips preamble before first heading');

if (failed) {
    process.exitCode = 1;
    console.error('compiler tests had failures');
} else {
    console.log('compiler tests passed');
}
