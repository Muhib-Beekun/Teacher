import { describe, expect, it, vi } from 'vitest';
import {
    isAllowedDownloadUrl,
    parseOpenVsxLatestPayload,
    OPEN_VSX_EXTENSION_NAME,
    OPEN_VSX_PUBLISHER,
    fetchOpenVsxLatest
} from '../../src/update/openVsxClient';

describe('openVsxClient', () => {
    it('parses valid latest payload', () => {
        const parsed = parseOpenVsxLatestPayload({
            namespace: OPEN_VSX_PUBLISHER,
            name: OPEN_VSX_EXTENSION_NAME,
            version: '0.1.2',
            files: {
                download: 'https://open-vsx.org/api/muhib-beekun/teacher/0.1.2/file/muhib-beekun.teacher-0.1.2.vsix'
            }
        });
        expect(parsed).toEqual({
            version: '0.1.2',
            downloadUrl: 'https://open-vsx.org/api/muhib-beekun/teacher/0.1.2/file/muhib-beekun.teacher-0.1.2.vsix'
        });
    });

    it('rejects wrong namespace or malformed download url', () => {
        expect(parseOpenVsxLatestPayload({ namespace: 'other', name: 'teacher', version: '1.0.0', files: {} })).toBeNull();
        expect(
            parseOpenVsxLatestPayload({
                namespace: OPEN_VSX_PUBLISHER,
                name: OPEN_VSX_EXTENSION_NAME,
                version: '1.0.0',
                files: { download: 'https://evil.example/teacher.vsix' }
            })
        ).toBeNull();
    });

    it('allows only Teacher Open VSX download urls', () => {
        expect(
            isAllowedDownloadUrl('https://open-vsx.org/api/muhib-beekun/teacher/0.1.1/file/muhib-beekun.teacher-0.1.1.vsix')
        ).toBe(true);
        expect(isAllowedDownloadUrl('https://example.com/x.vsix')).toBe(false);
    });

    it('retries once on Open VSX 404 propagation lag', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    namespace: OPEN_VSX_PUBLISHER,
                    name: OPEN_VSX_EXTENSION_NAME,
                    version: '0.1.2',
                    files: { download: 'https://open-vsx.org/api/muhib-beekun/teacher/0.1.2/file/muhib-beekun.teacher-0.1.2.vsix' }
                })
            });

        const sleep = vi.fn().mockResolvedValue(undefined);
        const latest = await fetchOpenVsxLatest({ fetchImpl, sleep, retryDelayMs: 1 });
        expect(latest.version).toBe('0.1.2');
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledOnce();
    });
});
