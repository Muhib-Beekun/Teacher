import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { UpdateCheckResult } from '../shared/types';
import { downloadVsixToFile, fetchOpenVsxLatest } from './openVsxClient';
import { isNewerVersion } from './semverCompare';

export type { UpdateCheckResult } from '../shared/types';
export type UpdateCheckStatus = UpdateCheckResult['status'];

export class UpdateService {
    private lastCheck: UpdateCheckResult | null = null;

    public constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly output: vscode.OutputChannel
    ) {}

    public getInstalledVersion(): string {
        return this.context.extension.packageJSON.version ?? '?';
    }

    public getCachedCheck(): UpdateCheckResult | null {
        return this.lastCheck;
    }

    public async checkForUpdates(options: { notify?: boolean; silent?: boolean } = {}): Promise<UpdateCheckResult> {
        const installedVersion = this.getInstalledVersion();
        try {
            const latest = await fetchOpenVsxLatest();
            const result: UpdateCheckResult = isNewerVersion(latest.version, installedVersion)
                ? {
                      status: 'available',
                      installedVersion,
                      latestVersion: latest.version,
                      downloadUrl: latest.downloadUrl,
                      message: `Update available: v${latest.version} (installed v${installedVersion}).`,
                      checkedAt: Date.now()
                  }
                : {
                      status: 'current',
                      installedVersion,
                      latestVersion: latest.version,
                      downloadUrl: latest.downloadUrl,
                      message: `Teacher v${installedVersion} is up to date (Open VSX v${latest.version}).`,
                      checkedAt: Date.now()
                  };
            this.lastCheck = result;
            this.output.appendLine(`[update] ${result.message}`);
            if (options.notify !== false && !options.silent) {
                await this.showCheckNotification(result);
            }
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const result: UpdateCheckResult = {
                status: 'error',
                installedVersion,
                message: `Could not check Open VSX: ${msg}. Install manually from GitHub Releases or retry later.`,
                checkedAt: Date.now()
            };
            this.lastCheck = result;
            this.output.appendLine(`[update] check failed: ${msg}`);
            if (options.notify !== false && !options.silent) {
                await vscode.window.showWarningMessage(result.message);
            }
            return result;
        }
    }

    public async updateFromOpenVsx(): Promise<{ ok: boolean; message: string }> {
        const check =
            this.lastCheck?.status === 'available' && this.lastCheck.downloadUrl
                ? this.lastCheck
                : await this.checkForUpdates({ notify: false, silent: true });

        if (check.status === 'error') {
            return { ok: false, message: check.message };
        }
        if (check.status !== 'available' || !check.latestVersion || !check.downloadUrl) {
            return { ok: false, message: check.message };
        }

        try {
            const updatesDir = path.join(this.context.globalStorageUri.fsPath, 'updates');
            fs.mkdirSync(updatesDir, { recursive: true });
            const vsixPath = path.join(updatesDir, `teacher-${check.latestVersion}.vsix`);
            this.output.appendLine(`[update] downloading ${check.downloadUrl}`);
            await downloadVsixToFile(check.downloadUrl, vsixPath);
            const vsixUri = vscode.Uri.file(vsixPath);
            this.output.appendLine(`[update] installing ${vsixPath}`);
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Installing Teacher v${check.latestVersion}…` },
                async () => {
                    await this.installVsixAndWait(vsixUri);
                }
            );
            const reload = 'Reload Window';
            const choice = await vscode.window.showInformationMessage(
                `Teacher v${check.latestVersion} installed. Reload the window to activate the update.`,
                reload
            );
            if (choice === reload) {
                await vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
            return {
                ok: true,
                message: `Installed Teacher v${check.latestVersion}. Reload the window if you have not already.`
            };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.output.appendLine(`[update] install failed: ${msg}`);
            return {
                ok: false,
                message: `Update failed: ${msg}. Try Teacher: Check for Updates, then install the VSIX from GitHub Releases manually.`
            };
        }
    }

    private async showCheckNotification(result: UpdateCheckResult): Promise<void> {
        if (result.status === 'available') {
            const update = 'Update from Open VSX';
            const choice = await vscode.window.showInformationMessage(result.message, update);
            if (choice === update) {
                const install = await this.updateFromOpenVsx();
                if (!install.ok) {
                    await vscode.window.showWarningMessage(install.message);
                }
            }
            return;
        }
        if (result.status === 'current') {
            await vscode.window.showInformationMessage(result.message);
            return;
        }
        await vscode.window.showWarningMessage(result.message);
    }

    private async installVsixAndWait(vsixUri: vscode.Uri): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                subscription.dispose();
                resolve();
            }, 120_000);
            const subscription = vscode.extensions.onDidChange(() => {
                if (vscode.extensions.getExtension('muhib-beekun.teacher')) {
                    clearTimeout(timeout);
                    subscription.dispose();
                    resolve();
                }
            });
            vscode.commands
                .executeCommand('workbench.extensions.installExtension', vsixUri)
                .then(() => undefined, reject);
        });
    }
}
