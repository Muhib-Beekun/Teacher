import { test, expect, Page } from '@playwright/test';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const MEDIA_DIR = path.resolve(__dirname, '../../media');

const MOCK_PRESETS = [
    { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyHint: 'sk-…' },
    { id: 'xai', label: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', model: 'grok-4-fast-reasoning', keyHint: 'xai-…' },
    { id: 'ollama-openai', label: 'Ollama (OpenAI-compatible)', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5-coder:14b', keyHint: 'ollama (often unused)' },
];

const MOCK_MODELS = [
    { id: 'gpt-4o-mini', label: 'OpenAI gpt-4o-mini', provider: 'openai' },
    { id: 'grok-4-fast-reasoning', label: 'xAI grok-4-fast-reasoning', provider: 'xai' },
    { id: 'qwen2.5-coder:14b', label: 'Ollama qwen2.5-coder:14b', provider: 'ollama-openai' },
];

function defaultDiagnostics(overrides: Record<string, unknown> = {}) {
    return {
        extensionHost: 'local',
        remoteName: '',
        installChannelHint: 'Open VSX / VSIX (manual updates)',
        envOverrideDetected: false,
        envOverrideHint: '',
        vscodeLmRemoteWarning: false,
        updateStatus: 'unknown',
        ...overrides,
    };
}

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
        extensionVersion: '0.1.0',
        diagnostics: defaultDiagnostics(),
        vscodeSettingsFilter: '@ext:muhib-beekun.teacher',
        whisper: { binaryPath: '', modelPath: '', binaryExists: false, modelExists: false, ready: false, statusLabel: 'not configured' },
        whisperReleasesUrl: '',
        whisperModelsUrl: '',
        ...overrides,
    };
}

let server: http.Server;
let port: number;
let currentSettings = makeSettings();

test.beforeAll(async () => {
    currentSettings = makeSettings();

    server = http.createServer((req, res) => {
        const url = req.url ?? '/';

        if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
            const html = fs.readFileSync(path.join(MEDIA_DIR, 'teacher-app.html'), 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
        }

        if (req.method === 'GET' && url === '/teacher-app.js') {
            const js = fs.readFileSync(path.join(MEDIA_DIR, 'teacher-app.js'), 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
            res.end(js);
            return;
        }

        if (req.method === 'GET' && url === '/teacher-app.css') {
            const css = fs.readFileSync(path.join(MEDIA_DIR, 'teacher-app.css'), 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
            res.end(css);
            return;
        }

        if (req.method === 'GET' && url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, compileReady: true, stt: 'webspeech', url: `http://127.0.0.1:${port}/` }));
            return;
        }

        if (req.method === 'GET' && url === '/api/settings') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                ok: true,
                settings: currentSettings,
                runtime: { url: `http://127.0.0.1:${port}/`, segmentCount: 0, needsRegenerate: false, contextTermCount: 200, targetFileCount: 3, totalFixCount: 0 },
            }));
            return;
        }

        if (req.method === 'GET' && url === '/api/session') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                ok: true,
                session: { transcriptHtml: '<p class="empty">Session ready.</p>', briefHtml: '<p class="empty">Speak.</p>', compiled: '', briefMarkdownByVersion: {}, segmentCount: 0, sttLabel: '', compileLabel: '', contextHint: '' },
            }));
            return;
        }

        if (req.method === 'GET' && url === '/api/codewords') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, terms: [], path: '.teacher/codewords.txt' }));
            return;
        }

        if (req.method === 'POST' && url === '/api/action') {
            let body = '';
            req.on('data', (c) => { body += c; });
            req.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, message: 'Action ok (mock).' }));
            });
            return;
        }

        if (req.method === 'PATCH' && url === '/api/settings') {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.key === 'teacher.inference.llm.baseUrl') {
                        currentSettings = makeSettings({ ...currentSettings, llmBaseUrl: parsed.value });
                    } else if (parsed.key === 'teacher.inference.llm.model') {
                        currentSettings = makeSettings({ ...currentSettings, llmModel: parsed.value });
                    } else if (parsed.key === 'teacher.compile.provider') {
                        currentSettings = makeSettings({ ...currentSettings, compileProvider: parsed.value });
                    }
                } catch {}
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, settings: currentSettings }));
            });
            return;
        }

        if (url === '/icon.png' || url === '/favicon.ico') {
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(Buffer.alloc(0));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
    });

    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            port = (server.address() as { port: number }).port;
            resolve();
        });
    });
});

test.afterAll(() => {
    server?.close();
});

async function loadPage(page: Page, settingsOverrides: Record<string, unknown> = {}) {
    currentSettings = makeSettings(settingsOverrides);
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForSelector('header.topbar');
}

async function openSettings(page: Page) {
    await page.click('button:has-text("Settings")');
    await page.waitForSelector('.settings-panel');
}

test.describe('settings field visibility by provider', () => {
    test('cloud provider (OpenAI): shows model + key, hides URL', async ({ page }) => {
        await loadPage(page, { inferencePresetId: 'openai' });
        await openSettings(page);

        await expect(page.locator('#setLlmModel')).toBeVisible();
        await expect(page.locator('#setLlmKey')).toBeVisible();
        await expect(page.locator('#setLlmBaseUrl')).toBeHidden();
    });

    test('cloud provider (xAI): shows model + key, hides URL', async ({ page }) => {
        await loadPage(page, { inferencePresetId: 'xai', llmBaseUrl: 'https://api.x.ai/v1', llmModel: 'grok-4-fast-reasoning' });
        await openSettings(page);

        await expect(page.locator('#setLlmModel')).toBeVisible();
        await expect(page.locator('#setLlmKey')).toBeVisible();
        await expect(page.locator('#setLlmBaseUrl')).toBeHidden();
    });

    test('Ollama: shows model, hides key + URL', async ({ page }) => {
        await loadPage(page, { inferencePresetId: 'ollama-openai', llmBaseUrl: 'http://127.0.0.1:11434/v1', llmModel: 'qwen2.5-coder:14b' });
        await openSettings(page);

        await expect(page.locator('#setLlmModel')).toBeVisible();
        await expect(page.locator('#setLlmKey')).toBeHidden();
        await expect(page.locator('#setLlmBaseUrl')).toBeHidden();
    });

    test('Custom: shows model + key + URL', async ({ page }) => {
        await loadPage(page, { inferencePresetId: 'custom', llmBaseUrl: 'https://my-server.com/v1', llmModel: 'my-model' });
        await openSettings(page);

        await expect(page.locator('#setLlmModel')).toBeVisible();
        await expect(page.locator('#setLlmKey')).toBeVisible();
        await expect(page.locator('#setLlmBaseUrl')).toBeVisible();
    });

    test('env lock: shows lock message when source is env', async ({ page }) => {
        await loadPage(page, { llmBaseUrlSource: 'env', llmModelSource: 'env' });
        await openSettings(page);

        await expect(page.locator('text=Locked by')).toBeVisible();
    });

    test('no env lock: hides lock message when source is settings', async ({ page }) => {
        await loadPage(page, { llmBaseUrlSource: 'settings', llmModelSource: 'settings' });
        await openSettings(page);

        await expect(page.locator('text=Locked by')).toBeHidden();
    });

    test('Custom model option reveals custom model input', async ({ page }) => {
        await loadPage(page, { inferencePresetId: 'openai' });
        await openSettings(page);

        await page.locator('#setLlmModel').selectOption('__custom__');
        await expect(page.locator('#setLlmModelCustom')).toBeVisible();
    });

    test('version is displayed in status block', async ({ page }) => {
        await loadPage(page, { extensionVersion: '0.1.0' });
        await openSettings(page);

        await expect(page.locator('.settings-status')).toContainText('v0.1.0');
    });
});

test.describe('main UI layout', () => {
    test('renders topbar with brand', async ({ page }) => {
        await loadPage(page);
        await expect(page.locator('h1:has-text("Teacher")')).toBeVisible();
        await expect(page.locator('text=Lecture your AI')).toBeVisible();
    });

    test('renders three-column layout', async ({ page }) => {
        await loadPage(page);
        await expect(page.locator('.capture-col')).toBeVisible();
        await expect(page.locator('text=Your Words')).toBeVisible();
        await expect(page.locator('text=Agent Prompt')).toBeVisible();
    });

    test('settings panel opens and closes', async ({ page }) => {
        await loadPage(page);
        await page.click('button:has-text("Settings")');
        await expect(page.locator('.settings-panel')).toBeVisible();
        await page.click('button:has-text("Done")');
        await expect(page.locator('.settings-panel')).toBeHidden();
    });

    test('Escape closes settings', async ({ page }) => {
        await loadPage(page);
        await page.click('button:has-text("Settings")');
        await expect(page.locator('.settings-panel')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.settings-panel')).toBeHidden();
    });
});

test.describe('accessibility', () => {
    test('settings dialog has correct ARIA attributes', async ({ page }) => {
        await loadPage(page);
        await openSettings(page);

        const panel = page.locator('.settings-panel');
        await expect(panel).toHaveAttribute('role', 'dialog');
        await expect(panel).toHaveAttribute('aria-modal', 'true');
        await expect(panel).toHaveAttribute('aria-labelledby', 'settingsTitle');
    });

    test('status area has aria-live', async ({ page }) => {
        await loadPage(page);
        const status = page.locator('.topbar .status');
        await expect(status).toHaveAttribute('aria-live', 'polite');
    });

    test('transcript pane has region role', async ({ page }) => {
        await loadPage(page);
        const region = page.locator('[aria-label="Transcript segments"]');
        await expect(region).toBeVisible();
    });

    test('brief pane has region role', async ({ page }) => {
        await loadPage(page);
        const region = page.locator('[aria-label="Compiled brief"]');
        await expect(region).toBeVisible();
    });

    test('icon buttons have aria-labels', async ({ page }) => {
        await loadPage(page);
        await expect(page.locator('[aria-label="Copy STT audit"]')).toBeVisible();
        await expect(page.locator('[aria-label="Copy your words"]')).toBeVisible();
        await expect(page.locator('[aria-label="Copy agent prompt"]')).toBeVisible();
        await expect(page.locator('[aria-label="Send agent prompt"]')).toBeVisible();
    });
});
