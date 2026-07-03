import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
import { appSettings, settingsOpen, statusText, statusKind, micRuntime, runtime, codewordsTerms, codewordsPath, compilingBrief, briefVersion, needsRegenerate, briefHtml, transcriptHtml } from '../../src/web-ui/state';

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) }));

import { TopBar } from '../../src/web-ui/components/TopBar';
import { StatusBlock } from '../../src/web-ui/components/StatusBlock';
import { SpeechSection } from '../../src/web-ui/components/SpeechSection';
import { CompileSection } from '../../src/web-ui/components/CompileSection';
import { SendSection } from '../../src/web-ui/components/SendSection';
import { GlossarySection } from '../../src/web-ui/components/GlossarySection';
import { InferenceSection } from '../../src/web-ui/components/InferenceSection';
import { BriefPane } from '../../src/web-ui/components/BriefPane';
import { TranscriptPane } from '../../src/web-ui/components/TranscriptPane';
import { SettingsPanel } from '../../src/web-ui/components/SettingsPanel';

function makeTestSettings(overrides: Record<string, unknown> = {}) {
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
        llmBaseUrlSource: 'default' as const,
        llmModelSource: 'default' as const,
        llmKeySource: 'none' as const,
        cloudInferenceLabel: 'gpt-4o-mini @ https://api.openai.com/v1',
        activeCompileLabel: 'cloud',
        activeCompileProvider: 'cloud',
        compileProviderSetting: 'auto',
        inferenceModels: [
            { id: 'gpt-4o-mini', label: 'OpenAI gpt-4o-mini', provider: 'openai' },
            { id: 'qwen2.5-coder:14b', label: 'Ollama qwen2.5-coder:14b', provider: 'ollama-openai' },
        ],
        inferencePresets: [
            { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyHint: 'sk-…' },
            { id: 'ollama-openai', label: 'Ollama (OpenAI-compatible)', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5-coder:14b', keyHint: 'ollama (often unused)' },
        ],
        inferencePresetId: 'openai',
        extensionVersion: '0.1.0',
        vscodeSettingsFilter: '@ext:muhib-beekun.teacher',
        whisper: { binaryPath: '', modelPath: '', binaryExists: false, modelExists: false, ready: false, statusLabel: 'not configured' },
        whisperReleasesUrl: 'https://github.com/ggml-org/whisper.cpp/releases',
        whisperModelsUrl: 'https://huggingface.co/ggerganov/whisper.cpp/tree/main',
        ...overrides,
    } as any;
}

beforeEach(() => {
    cleanup();
    statusText.value = 'Ready';
    statusKind.value = 'ok';
    settingsOpen.value = false;
    micRuntime.value = 'idle';
    compilingBrief.value = false;
    briefVersion.value = undefined;
    needsRegenerate.value = false;
    briefHtml.value = '<p class="empty">Speak.</p>';
    transcriptHtml.value = '<p class="empty">Session ready.</p>';
    runtime.value = { url: '', segmentCount: 2, needsRegenerate: false, contextTermCount: 100, targetFileCount: 3, totalFixCount: 0 };
    codewordsTerms.value = [];
    codewordsPath.value = '.teacher/codewords.txt';
    appSettings.value = null;
});

describe('TopBar', () => {
    it('renders brand name and status', () => {
        render(<TopBar />);
        expect(screen.getByText('Teacher')).toBeDefined();
        expect(screen.getByText('Ready')).toBeDefined();
    });

    it('has settings and clear session buttons', () => {
        render(<TopBar />);
        expect(screen.getByText('Settings')).toBeDefined();
        expect(screen.getByText('Clear session')).toBeDefined();
    });

    it('opens settings on button click', () => {
        render(<TopBar />);
        fireEvent.click(screen.getByText('Settings'));
        expect(settingsOpen.value).toBe(true);
    });
});

describe('StatusBlock', () => {
    it('displays version from appSettings', () => {
        appSettings.value = makeTestSettings();
        const { container } = render(<StatusBlock />);
        expect(container.textContent).toContain('Teacher v0.1.0');
    });

    it('shows compile status', () => {
        appSettings.value = makeTestSettings({ compilerReady: true, activeCompileLabel: 'cloud' });
        const { container } = render(<StatusBlock />);
        expect(container.textContent).toContain('Compile: cloud');
    });

    it('shows segment count from runtime', () => {
        appSettings.value = makeTestSettings();
        const { container } = render(<StatusBlock />);
        expect(container.textContent).toContain('Segments: 2');
    });
});

describe('InferenceSection', () => {
    it('renders provider dropdown with presets', () => {
        appSettings.value = makeTestSettings();
        render(<InferenceSection />);
        const select = screen.getByLabelText('Provider') as HTMLSelectElement;
        expect(select).toBeDefined();
        expect(select.value).toBe('openai');
    });

    it('hides URL field for non-custom providers', () => {
        appSettings.value = makeTestSettings({ inferencePresetId: 'openai' });
        const { container } = render(<InferenceSection />);
        expect(container.querySelector('#setLlmBaseUrl')).toBeNull();
    });

    it('shows URL field for custom provider', () => {
        appSettings.value = makeTestSettings({ inferencePresetId: 'custom' });
        const { container } = render(<InferenceSection />);
        expect(container.querySelector('#setLlmBaseUrl')).not.toBeNull();
    });

    it('hides API key for Ollama', () => {
        appSettings.value = makeTestSettings({ inferencePresetId: 'ollama-openai' });
        const { container } = render(<InferenceSection />);
        expect(container.querySelector('#setLlmKey')).toBeNull();
    });

    it('shows API key for cloud providers', () => {
        appSettings.value = makeTestSettings({ inferencePresetId: 'openai' });
        const { container } = render(<InferenceSection />);
        expect(container.querySelector('#setLlmKey')).not.toBeNull();
    });

    it('shows env lock message when locked', () => {
        appSettings.value = makeTestSettings({ llmBaseUrlSource: 'env', llmModelSource: 'env' });
        const { container } = render(<InferenceSection />);
        expect(container.textContent).toContain('Locked by');
    });

    it('hides env lock when not locked', () => {
        appSettings.value = makeTestSettings({ llmBaseUrlSource: 'settings', llmModelSource: 'settings' });
        const { container } = render(<InferenceSection />);
        expect(container.textContent).not.toContain('Locked by');
    });
});

describe('SpeechSection', () => {
    it('renders STT provider select', () => {
        appSettings.value = makeTestSettings();
        render(<SpeechSection />);
        const select = screen.getByLabelText(/STT provider/i) as HTMLSelectElement;
        expect(select.value).toBe('auto');
    });

    it('renders checkboxes with correct checked state', () => {
        appSettings.value = makeTestSettings({ homonymPass: true, polishStt: false });
        render(<SpeechSection />);
        const homonym = screen.getByLabelText(/Fix misheard/i) as HTMLInputElement;
        const polish = screen.getByLabelText(/AI-powered cleanup/i) as HTMLInputElement;
        expect(homonym.checked).toBe(true);
        expect(polish.checked).toBe(false);
    });
});

describe('CompileSection', () => {
    it('renders compile mode select', () => {
        appSettings.value = makeTestSettings({ compileMode: 'verbatim' });
        render(<CompileSection />);
        const select = screen.getByLabelText('Mode') as HTMLSelectElement;
        expect(select.value).toBe('verbatim');
    });
});

describe('SendSection', () => {
    it('renders auto-paste and auto-submit checkboxes', () => {
        appSettings.value = makeTestSettings({ sendAutoPaste: true, sendAutoSubmit: false });
        render(<SendSection />);
        const paste = screen.getByLabelText(/Auto-paste/i) as HTMLInputElement;
        const submit = screen.getByLabelText(/Auto-submit/i) as HTMLInputElement;
        expect(paste.checked).toBe(true);
        expect(submit.checked).toBe(false);
    });
});

describe('GlossarySection', () => {
    it('shows empty message when no terms', () => {
        codewordsTerms.value = [];
        render(<GlossarySection />);
        expect(screen.getByText('No terms yet.')).toBeDefined();
    });

    it('lists existing terms', () => {
        codewordsTerms.value = ['Preact', 'esbuild'];
        render(<GlossarySection />);
        expect(screen.getByText('Preact')).toBeDefined();
        expect(screen.getByText('esbuild')).toBeDefined();
    });
});

describe('SettingsPanel', () => {
    it('does not render when closed', () => {
        settingsOpen.value = false;
        const { container } = render(<SettingsPanel />);
        expect(container.querySelector('.settings-panel')).toBeNull();
    });

    it('renders when open', () => {
        settingsOpen.value = true;
        appSettings.value = makeTestSettings();
        const { container } = render(<SettingsPanel />);
        expect(container.querySelector('.settings-panel')).not.toBeNull();
        expect(screen.getByText('Configuration')).toBeDefined();
    });

    it('closes on Done button click', () => {
        settingsOpen.value = true;
        appSettings.value = makeTestSettings();
        render(<SettingsPanel />);
        fireEvent.click(screen.getByText('Done'));
        expect(settingsOpen.value).toBe(false);
    });

    it('closes on Escape key', () => {
        settingsOpen.value = true;
        appSettings.value = makeTestSettings();
        render(<SettingsPanel />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(settingsOpen.value).toBe(false);
    });
});

describe('BriefPane', () => {
    it('renders agent prompt title', () => {
        render(<BriefPane />);
        expect(screen.getByText('Agent Prompt')).toBeDefined();
    });

    it('shows version in title when available', () => {
        briefVersion.value = 3;
        render(<BriefPane />);
        expect(screen.getByText('Agent Prompt · v3')).toBeDefined();
    });

    it('shows pulse-hint when stale', () => {
        needsRegenerate.value = true;
        const { container } = render(<BriefPane />);
        expect(container.querySelector('.pulse-hint')).not.toBeNull();
    });
});

describe('TranscriptPane', () => {
    it('renders Your Words heading', () => {
        render(<TranscriptPane />);
        expect(screen.getByText('Your Words')).toBeDefined();
    });

    it('renders transcript HTML', () => {
        transcriptHtml.value = '<p class="empty">Session ready.</p>';
        const { container } = render(<TranscriptPane />);
        expect(container.textContent).toContain('Session ready.');
    });
});
