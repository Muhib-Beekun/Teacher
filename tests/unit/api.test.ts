import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { appSettings, statusText, statusKind, codewordsTerms, codewordsPath, briefMarkdown } from '../../src/web-ui/state';
import * as api from '../../src/web-ui/api';

const mockFetch = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    appSettings.value = null;
    statusText.value = '';
    statusKind.value = '';
    codewordsTerms.value = [];
    briefMarkdown.value = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('api: loadSettings', () => {
    it('populates appSettings from server response', async () => {
        const settings = { extensionVersion: '0.1.0', compilerReady: true };
        mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ settings, runtime: null }) });

        await api.loadSettings();
        expect(appSettings.value).toEqual(settings);
    });

    it('handles fetch failure gracefully', async () => {
        mockFetch.mockRejectedValueOnce(new Error('network'));
        await api.loadSettings();
        expect(appSettings.value).toBeNull();
    });
});

describe('api: patchSetting', () => {
    it('sends PATCH and updates settings on success', async () => {
        const settings = { compileLive: false };
        mockFetch.mockResolvedValueOnce({
            json: () => Promise.resolve({ ok: true, settings })
        });

        await api.patchSetting('teacher.compile.live', false);
        expect(mockFetch).toHaveBeenCalledWith('/api/settings', expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ key: 'teacher.compile.live', value: false }),
        }));
        expect(appSettings.value).toEqual(settings);
    });

    it('shows error status on failure', async () => {
        mockFetch.mockResolvedValueOnce({
            json: () => Promise.resolve({ ok: false, error: 'invalid key' })
        });

        await api.patchSetting('bad.key', 'x');
        expect(statusText.value).toBe('invalid key');
        expect(statusKind.value).toBe('warn');
    });
});

describe('api: saveLlmKey', () => {
    it('returns true and shows ok status on success', async () => {
        const settings = { llmKeySet: true };
        mockFetch
            .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true, settings }) })
            .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true, compileReady: true }) })
            .mockResolvedValueOnce({ json: () => Promise.resolve({ settings: {}, runtime: null }) });

        const result = await api.saveLlmKey('sk-test');
        expect(result).toBe(true);
        expect(statusText.value).toContain('saved');
    });

    it('rejects blank keys without calling fetch', async () => {
        const callsBefore = mockFetch.mock.calls.length;
        const result = await api.saveLlmKey('  ');
        expect(result).toBe(false);
        expect(statusKind.value).toBe('warn');
        expect(mockFetch.mock.calls.length).toBe(callsBefore);
    });
});

describe('api: loadCodewords', () => {
    it('populates codeword signals', async () => {
        mockFetch.mockResolvedValueOnce({
            json: () => Promise.resolve({ ok: true, terms: ['Preact', 'Vitest'], path: '.teacher/codewords.txt' })
        });

        await api.loadCodewords();
        expect(codewordsTerms.value).toEqual(['Preact', 'Vitest']);
        expect(codewordsPath.value).toBe('.teacher/codewords.txt');
    });
});

describe('api: clearSession', () => {
    it('resets briefMarkdown and applies session', async () => {
        briefMarkdown.value = '## Goal\nOld.';
        mockFetch.mockResolvedValueOnce({
            json: () => Promise.resolve({ session: { transcriptHtml: '', briefHtml: '', compiled: '', briefMarkdownByVersion: {}, segmentCount: 0, sttLabel: '', compileLabel: '', contextHint: '' } })
        });

        await api.clearSession();
        expect(briefMarkdown.value).toBe('');
    });
});

describe('api: handleChange', () => {
    it('creates a change handler that patches settings', async () => {
        mockFetch.mockResolvedValueOnce({
            json: () => Promise.resolve({ ok: true, settings: {} })
        });

        const callsBefore = mockFetch.mock.calls.length;
        const handler = api.handleChange('teacher.compile.live');
        const event = { currentTarget: { type: 'checkbox', checked: false } } as unknown as Event;
        handler(event);

        await vi.waitFor(() => {
            expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
        });

        const patchCall = mockFetch.mock.calls.find(
            (c: unknown[]) => c[1] && (c[1] as Record<string, string>).method === 'PATCH'
                && typeof c[1] === 'object' && JSON.parse((c[1] as Record<string, string>).body).key === 'teacher.compile.live'
        );
        expect(patchCall).toBeDefined();
    });
});
