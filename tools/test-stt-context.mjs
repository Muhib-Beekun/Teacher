#!/usr/bin/env node
/**
 * Vectorless context → STT corrections + Target inference quality gate.
 */
import { applyDevVoiceLexicon } from '../out/stt/DevVoiceLexicon.js';
import { applyHomonymPass } from '../out/stt/HomonymPass.js';
import { speechMentionsSymbol } from '../out/stt/symbolPhraseMatch.js';
import { extractWorkspaceTargets } from '../out/context/targetMatch.js';
import { compileSession } from '../out/compiler/TeacherCompiler.js';
import { emptyVoiceSessionContext } from '../out/context/VoiceSessionContext.js';

let failed = 0;
function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        failed++;
    }
}

const ctx = emptyVoiceSessionContext();
ctx.targetFiles = [
    'media/teacher-app.html',
    'src/providers/compile/CompileService.ts',
    'src/web/BrowserSessionBridge.ts',
    'src/session/SessionManager.ts',
    'package.json'
];
ctx.dictionary_context = [
    'CompileService',
    'BrowserSessionBridge',
    'SessionManager',
    'WebAppServer',
    'Grok',
    'Ollama',
    'teacher-app.html',
    'puppeteer',
    '@vscode/vsce'
];

function stt(raw) {
    const lex = applyDevVoiceLexicon(raw);
    return applyHomonymPass(lex.text, ctx.dictionary_context).text;
}

// Dev lexicon
assert(stt('use Obama for local compile').includes('Ollama'), 'lexicon: Obama → Ollama');
assert(stt('wire Rock for compile with Grok api').includes('Grok'), 'lexicon: Rock → Grok');

// Single-token homonym + casing
assert(stt('update compileservice').includes('CompileService'), 'homonym: compileservice casing');

// Multi-word camelCase symbols
assert(stt('fix browser session bridge').includes('BrowserSessionBridge'), 'phrase: browser session bridge');
assert(stt('wire up the session manager').includes('SessionManager'), 'phrase: session manager');
assert(stt('change web app server port').includes('WebAppServer'), 'phrase: web app server');

// False positives — must not over-correct
assert(!stt('clear browser history cache').includes('BrowserSessionBridge'), 'no false positive: browser history');
assert(!stt('npm session list').includes('SessionManager'), 'no false positive: npm session');

// Target inference
assert(
    extractWorkspaceTargets('fix the teacher app html styling', ctx).includes('media/teacher-app.html'),
    'target: teacher app html'
);
assert(
    extractWorkspaceTargets('change CompileService to grok only', ctx).includes('src/providers/compile/CompileService.ts'),
    'target: CompileService'
);
assert(
    extractWorkspaceTargets('wire up browser session bridge', ctx).includes('src/web/BrowserSessionBridge.ts'),
    'target: spaced BrowserSessionBridge'
);
assert(
    extractWorkspaceTargets('update session manager labels', ctx).includes('src/session/SessionManager.ts'),
    'target: SessionManager'
);
assert(
    extractWorkspaceTargets('add a refresh button that pulses blue', ctx).length === 0,
    'target: no false positive on generic UI speech'
);

assert(speechMentionsSymbol('fix browser session bridge', 'BrowserSessionBridge'), 'speechMentionsSymbol: bridge');

const brief = compileSession(['Make the right pane match the left in teacher app html'], ctx, 'teacher');
assert(brief.target.some((t) => t.includes('teacher-app.html')), 'compile: brief Target includes teacher-app.html');

if (failed) {
    console.error(`stt-context tests: ${failed} failure(s)`);
    process.exitCode = 1;
} else {
    console.log('stt-context tests passed (lexicon + homonym + phrase symbols + target inference)');
}
