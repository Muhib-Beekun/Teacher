#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
    buildCloudInferenceLabel,
    formatInferenceConfigSource
} from '../out/config/inferenceDisplay.js';
import { matchInferencePreset } from '../out/config/inferencePresets.js';

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

assert.equal(
    matchInferencePreset('https://api.x.ai/v1', 'grok-4-fast-reasoning'),
    'xai'
);
assert.equal(
    matchInferencePreset('https://api.x.ai/v1', 'grok-3-mini'),
    'xai',
    'URL-only match when model differs from preset default'
);
assert.equal(matchInferencePreset('https://openrouter.ai/api/v1', 'openai/gpt-4o-mini'), 'openrouter');

console.log('inference-display tests passed');
