#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
    buildCloudInferenceLabel,
    formatInferenceConfigSource
} from '../out/config/inferenceDisplay.js';

assert.equal(formatInferenceConfigSource('env', 'env'), 'from .env');
assert.equal(formatInferenceConfigSource('settings', 'settings'), 'from settings');
assert.equal(
    formatInferenceConfigSource('env', 'settings'),
    'URL from .env, model from settings'
);

const grok = buildCloudInferenceLabel(
    {
        baseUrl: 'https://api.x.ai/v1',
        model: 'grok-4-fast-reasoning',
        presetId: 'xai',
        baseUrlSource: 'env',
        modelSource: 'env'
    },
    'none'
);
assert.match(grok, /grok-4-fast-reasoning/);
assert.match(grok, /api\.x\.ai/);
assert.match(grok, /from \.env/);
assert.match(grok, /API key not set/);

console.log('inference-display tests passed');
