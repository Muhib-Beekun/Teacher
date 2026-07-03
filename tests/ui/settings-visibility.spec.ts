import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const HTML_PATH = path.resolve(__dirname, '../../media/teacher-app.html');

const MOCK_PRESETS = [
    { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyHint: 'sk-…' },
    { id: 'xai', label: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', model: 'grok-4-fast-reasoning', keyHint: 'xai-…' },
    { id: 'ollama-openai', label: 'Ollama (OpenAI-compatible)', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5-coder:14b', keyHint: 'ollama (often unused)' }
];

const MOCK_MODELS = [
    { id: 'gpt-4o-mini', label: 'OpenAI gpt-4o-mini', provider: 'openai' },
    { id: 'grok-4-fast-reasoning', label: 'xAI grok-4-fast-reasoning', provider: 'xai' },
    { id: 'qwen2.5-coder:14b', label: 'Ollama qwen2.5-coder:14b', provider: 'ollama-openai' }
];

function makeSettings(overrides: Record<string, unknown> = {}) {
    return {
        compileLive: true,
        polishStt: true,
        homonymPass: true,
        sendAutoPaste: true,
        sendAutoSubmit: true,
        compileMode: 'teacher',
        compileProvider: 'auto',
        sttProvider: 'auto',
        compilerKeySet: false,
        compilerReady: true,
        sttLabel: 'Web Speech',
        compileLabel: 'cloud',
        contextHint: '200 terms',
        contextRebuildMode: 'clearSession',
        sidecarPort: 3721,
        serverUrl: 'http://127.0.0.1:3721',
        llmKeySet: false,
        llmBaseUrl: 'https://api.openai.com/v1',
        llmModel: 'gpt-4o-mini',
        llmConfigSource: 'default',
        llmBaseUrlSource: 'default',
        llmModelSource: 'default',
        llmKeySource: 'none',
        cloudInferenceLabel: 'gpt-4o-mini @ https://api.openai.com/v1',
        activeCompileLabel: 'cloud',
        activeCompileProvider: 'cloud',
        compileProviderSetting: 'auto',
        inferenceModels: MOCK_MODELS,
        inferencePresets: MOCK_PRESETS,
        inferencePresetId: 'openai',
        extensionVersion: '0.0.65',
        vscodeSettingsFilter: '@ext:muhib-beekun.teacher',
        whisper: { binaryPath: '', modelPath: '', binaryOk: false, modelOk: false },
        whisperReleasesUrl: '',
        whisperModelsUrl: '',
        ...overrides
    };
}

async function loadPage(page: Page) {
    await page.goto(`file://${HTML_PATH}`);
    // Stub fetch so the page doesn't try to hit the real server
    await page.evaluate(() => {
        (window as any).fetch = () => Promise.resolve({ json: () => Promise.resolve({}) });
    });
}

async function applySettings(page: Page, overrides: Record<string, unknown> = {}) {
    const settings = makeSettings(overrides);
    await page.evaluate((s) => {
        (window as any).openSettings();
        (window as any).applySettingsView(s);
    }, settings);
}

function isVisible(page: Page, selector: string) {
    return page.locator(selector).isVisible();
}

test.describe('settings field visibility by provider', () => {
    test('cloud provider (OpenAI): shows model + key, hides URL', async ({ page }) => {
        await loadPage(page);
        await applySettings(page, { inferencePresetId: 'openai' });

        await expect(page.locator('#modelRow')).toBeVisible();
        await expect(page.locator('#apiKeyRow')).toBeVisible();
        await expect(page.locator('#customUrlRow')).toBeHidden();
        await expect(page.locator('#customModelRow')).toBeHidden();
    });

    test('cloud provider (xAI): shows model + key, hides URL', async ({ page }) => {
        await loadPage(page);
        await applySettings(page, { inferencePresetId: 'xai', llmBaseUrl: 'https://api.x.ai/v1', llmModel: 'grok-4-fast-reasoning' });

        await expect(page.locator('#modelRow')).toBeVisible();
        await expect(page.locator('#apiKeyRow')).toBeVisible();
        await expect(page.locator('#customUrlRow')).toBeHidden();
        await expect(page.locator('#customModelRow')).toBeHidden();
    });

    test('Ollama: shows model, hides key + URL', async ({ page }) => {
        await loadPage(page);
        await applySettings(page, { inferencePresetId: 'ollama-openai', llmBaseUrl: 'http://127.0.0.1:11434/v1', llmModel: 'qwen2.5-coder:14b' });

        await expect(page.locator('#modelRow')).toBeVisible();
        await expect(page.locator('#apiKeyRow')).toBeHidden();
        await expect(page.locator('#customUrlRow')).toBeHidden();
        await expect(page.locator('#customModelRow')).toBeHidden();
    });

    test('Custom: shows model + key + URL', async ({ page }) => {
        await loadPage(page);
        await applySettings(page, { inferencePresetId: 'custom', llmBaseUrl: 'https://my-server.com/v1', llmModel: 'my-model' });

        await expect(page.locator('#modelRow')).toBeVisible();
        await expect(page.locator('#apiKeyRow')).toBeVisible();
        await expect(page.locator('#customUrlRow')).toBeVisible();
        await expect(page.locator('#customModelRow')).toBeHidden();
    });

    test('env lock: shows lock message when source is env', async ({ page }) => {
        await loadPage(page);
        await applySettings(page, { llmBaseUrlSource: 'env', llmModelSource: 'env' });

        await expect(page.locator('#inferenceEnvNote')).toBeVisible();
    });

    test('no env lock: hides lock message when source is settings', async ({ page }) => {
        await loadPage(page);
        await applySettings(page, { llmBaseUrlSource: 'settings', llmModelSource: 'settings' });

        await expect(page.locator('#inferenceEnvNote')).toBeHidden();
    });

    test('Custom model option reveals custom model input', async ({ page }) => {
        await loadPage(page);
        await applySettings(page, { inferencePresetId: 'openai' });

        await page.locator('#setLlmModel').selectOption('__custom__');
        await expect(page.locator('#customModelRow')).toBeVisible();
    });

    test('version is displayed in status block', async ({ page }) => {
        await loadPage(page);
        await applySettings(page, { extensionVersion: '0.0.65' });

        await expect(page.locator('#settingsVersion')).toContainText('v0.0.65');
    });
});
