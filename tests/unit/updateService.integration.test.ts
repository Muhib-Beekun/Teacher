import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { UpdateService } from '../../src/update/UpdateService';

const DOWNLOAD_URL =
    'https://open-vsx.org/api/muhib-beekun/teacher/0.1.2/file/muhib-beekun.teacher-0.1.2.vsix';

describe('UpdateService integration', () => {
    let tempDir: string;

    afterEach(() => {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    function makeService(overrides: {
        installedVersion?: string;
        fetchLatest?: ReturnType<typeof vi.fn>;
        downloadVsix?: ReturnType<typeof vi.fn>;
        installVsix?: ReturnType<typeof vi.fn>;
    } = {}) {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-update-'));
        const output = { appendLine: vi.fn() } as unknown as vscode.OutputChannel;
        const context = {
            extension: { packageJSON: { version: overrides.installedVersion ?? '0.1.1' } },
            globalStorageUri: { fsPath: tempDir }
        } as vscode.ExtensionContext;

        const fetchLatest =
            overrides.fetchLatest ??
            vi.fn().mockResolvedValue({
                version: '0.1.2',
                downloadUrl: DOWNLOAD_URL
            });
        const downloadVsix = overrides.downloadVsix ?? vi.fn().mockResolvedValue(undefined);
        const installVsix = overrides.installVsix ?? vi.fn().mockResolvedValue(undefined);

        const service = new UpdateService(context, output, {
            fetchLatest,
            downloadVsix,
            installVsix,
            getExtensionFsPath: () => undefined,
            mkdirSync: fs.mkdirSync,
            showWarningMessage: vi.fn().mockResolvedValue(undefined),
            showInformationMessage: vi.fn().mockResolvedValue(undefined),
            withProgress: (_opts, task) => task({ report: vi.fn() }),
            executeCommand: vi.fn().mockResolvedValue(undefined)
        });

        return { service, fetchLatest, downloadVsix, installVsix, output };
    }

    it('checks Open VSX and caches available update', async () => {
        const { service, fetchLatest } = makeService();
        const result = await service.checkForUpdates({ notify: false, silent: true });

        expect(fetchLatest).toHaveBeenCalledOnce();
        expect(result.status).toBe('available');
        expect(result.installedVersion).toBe('0.1.1');
        expect(result.latestVersion).toBe('0.1.2');
        expect(service.getCachedCheck()?.status).toBe('available');
    });

    it('reports current when installed matches latest', async () => {
        const { service } = makeService({ installedVersion: '0.1.2' });
        const result = await service.checkForUpdates({ notify: false, silent: true });
        expect(result.status).toBe('current');
    });

    it('surfaces fetch errors without throwing', async () => {
        const { service } = makeService({
            fetchLatest: vi.fn().mockRejectedValue(new Error('Open VSX returned HTTP 404'))
        });
        const result = await service.checkForUpdates({ notify: false, silent: true });
        expect(result.status).toBe('error');
        expect(result.message).toContain('404');
    });

    it('downloads and installs when update is available', async () => {
        const { service, downloadVsix, installVsix } = makeService();
        await service.checkForUpdates({ notify: false, silent: true });

        const result = await service.updateFromOpenVsx();
        expect(result.ok).toBe(true);
        expect(downloadVsix).toHaveBeenCalledWith(
            DOWNLOAD_URL,
            path.join(tempDir, 'updates', 'teacher-0.1.2.vsix')
        );
        expect(installVsix).toHaveBeenCalledOnce();
    });

    it('returns failure when install command rejects', async () => {
        const { service } = makeService({
            installVsix: vi.fn().mockRejectedValue(new Error('install rejected'))
        });
        await service.checkForUpdates({ notify: false, silent: true });
        const result = await service.updateFromOpenVsx();
        expect(result.ok).toBe(false);
        expect(result.message).toContain('install rejected');
    });

    it('skips install when already up to date', async () => {
        const { service, downloadVsix, installVsix } = makeService({ installedVersion: '0.1.2' });
        const result = await service.updateFromOpenVsx();
        expect(result.ok).toBe(false);
        expect(downloadVsix).not.toHaveBeenCalled();
        expect(installVsix).not.toHaveBeenCalled();
    });
});
