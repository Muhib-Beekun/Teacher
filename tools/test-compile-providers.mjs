#!/usr/bin/env node
import {
    isEmptyLlmResponse,
    planEmptyVscodeLmFallback,
    resolveCompileProvider
} from '../out/providers/compile/resolveCompileProvider.js';

let failed = false;
function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        failed = true;
    }
}

function resolve(input) {
    return resolveCompileProvider(input).provider;
}

function resolveReason(input) {
    return resolveCompileProvider(input).reason;
}

const allAvailable = { cloud: true, ollama: true, vscodeLm: true };
const noneAvailable = { cloud: false, ollama: false, vscodeLm: false };

// local + auto
assert(
    resolve({ setting: 'auto', remote: false, allowVscodeLmOnRemote: false, available: allAvailable }) === 'ollama',
    'local auto prefers ollama when all available'
);
assert(
    resolve({
        setting: 'auto',
        remote: false,
        allowVscodeLmOnRemote: false,
        available: { cloud: true, ollama: false, vscodeLm: true }
    }) === 'cloud',
    'local auto picks cloud when ollama missing'
);
assert(
    resolve({
        setting: 'auto',
        remote: false,
        allowVscodeLmOnRemote: false,
        available: { cloud: false, ollama: false, vscodeLm: true }
    }) === 'vscode-lm',
    'local auto uses vscode-lm when only option'
);

// remote + auto
assert(
    resolve({ setting: 'auto', remote: true, allowVscodeLmOnRemote: false, available: allAvailable }) === 'ollama',
    'remote auto prefers ollama over vscode-lm'
);
assert(
    resolve({
        setting: 'auto',
        remote: true,
        allowVscodeLmOnRemote: false,
        available: { cloud: true, ollama: false, vscodeLm: true }
    }) === 'cloud',
    'remote auto uses cloud when ollama unavailable'
);
assert(
    resolve({
        setting: 'auto',
        remote: true,
        allowVscodeLmOnRemote: false,
        available: { cloud: false, ollama: false, vscodeLm: true }
    }) === 'none',
    'remote auto skips vscode-lm when allowOnRemote=false and no cloud/ollama'
);
assert(
    resolve({
        setting: 'auto',
        remote: true,
        allowVscodeLmOnRemote: true,
        available: { cloud: false, ollama: false, vscodeLm: true }
    }) === 'vscode-lm',
    'remote auto allows vscode-lm when allowOnRemote=true'
);

// explicit providers
assert(
    resolve({ setting: 'cloud', remote: true, allowVscodeLmOnRemote: false, available: allAvailable }) === 'cloud',
    'explicit cloud unchanged on remote'
);
assert(
    resolve({ setting: 'ollama', remote: true, allowVscodeLmOnRemote: false, available: allAvailable }) === 'ollama',
    'explicit ollama unchanged on remote'
);
assert(
    resolve({ setting: 'cloud', remote: false, allowVscodeLmOnRemote: false, available: noneAvailable }) === 'none',
    'explicit cloud fails when unavailable'
);

// explicit vscode-lm on remote
assert(
    resolve({
        setting: 'vscode-lm',
        remote: true,
        allowVscodeLmOnRemote: false,
        available: { cloud: true, ollama: true, vscodeLm: true }
    }) === 'cloud',
    'explicit vscode-lm on remote falls back to cloud'
);
assert(
    resolve({
        setting: 'vscode-lm',
        remote: true,
        allowVscodeLmOnRemote: false,
        available: { cloud: false, ollama: true, vscodeLm: true }
    }) === 'ollama',
    'explicit vscode-lm on remote falls back to ollama'
);
assert(
    resolve({
        setting: 'vscode-lm',
        remote: true,
        allowVscodeLmOnRemote: false,
        available: { cloud: false, ollama: false, vscodeLm: true }
    }) === 'none',
    'explicit vscode-lm on remote with no fallback returns none'
);
assert(
    resolveReason({
        setting: 'vscode-lm',
        remote: true,
        allowVscodeLmOnRemote: false,
        available: { cloud: false, ollama: false, vscodeLm: true }
    }).includes('no cloud/ollama fallback'),
    'explicit vscode-lm on remote logs actionable reason'
);
assert(
    resolve({
        setting: 'vscode-lm',
        remote: true,
        allowVscodeLmOnRemote: true,
        available: allAvailable
    }) === 'vscode-lm',
    'explicit vscode-lm on remote honored when allowOnRemote=true'
);

// empty vscode-lm response fallback
assert(isEmptyLlmResponse(''), 'empty string detected');
assert(isEmptyLlmResponse('   \n  '), 'whitespace-only detected');
assert(!isEmptyLlmResponse('## Goal\nHi'), 'non-empty passes');

const fallbackCloud = planEmptyVscodeLmFallback('', { cloud: true, ollama: true, vscodeLm: true });
assert(fallbackCloud.action === 'fallback' && fallbackCloud.provider === 'cloud', 'empty vscode-lm falls back to cloud first');

const fallbackOllama = planEmptyVscodeLmFallback('  ', { cloud: false, ollama: true, vscodeLm: true });
assert(fallbackOllama.action === 'fallback' && fallbackOllama.provider === 'ollama', 'empty vscode-lm falls back to ollama');

const noFallback = planEmptyVscodeLmFallback('', { cloud: false, ollama: false, vscodeLm: true });
assert(noFallback.action === 'fail' && noFallback.message.includes('empty output'), 'empty vscode-lm with no fallback fails clearly');

const okPrimary = planEmptyVscodeLmFallback('## Goal\nDone', { cloud: true, ollama: true, vscodeLm: true });
assert(okPrimary.action === 'use-primary', 'non-empty vscode-lm response uses primary');

if (failed) {
    process.exitCode = 1;
    console.error('compile provider tests had failures');
} else {
    console.log('compile provider tests passed');
}
