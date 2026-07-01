#!/usr/bin/env node
import { compileSession } from '../out/compiler/TeacherCompiler.js';
import { detectPhraseFixes } from '../out/compiler/parseCompiledMarkdown.js';
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

const sttFixes = detectPhraseFixes(
    'keep the sign language consistent with the voice entry side',
    'keep the design language consistent with the voice entry side'
);
assert(sttFixes.some((f) => f.heard.toLowerCase().includes('sign')), 'should detect sign→design fix');

const { parseCompiledMarkdown } = await import('../out/compiler/parseCompiledMarkdown.js');
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

if (failed) {
    process.exitCode = 1;
    console.error('compiler tests had failures');
} else {
    console.log('compiler tests passed');
}
