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

if (failed) {
    process.exitCode = 1;
    console.error('compiler tests had failures');
} else {
    console.log('compiler tests passed');
}
