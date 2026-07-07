import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { UpdateCheckResult } from '../shared/types';
import {
    pinStateHint,
    readExtensionPinState,
    TEACHER_EXTENSION_ID,
    tryClearExtensionPin
} from './extensionProfileState';
import { downloadVsixToFile, fetchOpenVsxLatest } from './openVsxClient';
import {
    buildUpdateCheckError,
    buildUpdateCheckResult,
    canInstallUpdate,
    pickAvailableUpdateCheck
} from './updateLogic';

export type { UpdateCheckResult } from '../shared/types';
export type UpdateCheckStatus = UpdateCheckResult['status'];

export interface UpdateServiceDeps {
    fetchLatest: typeof fetchOpenVsxLatest;
    downloadVsix: typeof downloadVsixToFile;
    installVsix: (vsixUri: vscode.Uri) => Promise<void>;
    getExtensionFsPath: () => string | undefined;
    mkdirSync: typeof fs.mkdirSync;
    showWarningMessage: (message: string, ...items: string[]) => Thenable<string | undefined>;
    showInformationMessage: (message: string, ...items: string[]) => Thenable<string | undefined>;
    withProgress: <T>(
        options: vscode.ProgressOptions,
        task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Thenable<T>
    ) => Thenable<T>;
    executeCommand: (command: string, ...args: unknown[]) => Thenable<unknown>;
}

function defaultDeps(context: vscode.ExtensionContext): UpdateServiceDeps {
    return {
        fetchLatest: fetchOpenVsxLatest,
        downloadVsix: downloadVsixToFile,
        installVsix: (vsixUri) => installVsixAndWait(vsixUri),
        getExtensionFsPath: () => vscode.extensions.getExtension(TEACHER_EXTENSION_ID)?.extensionUri.fsPath,
        mkdirSync: fs.mkdirSync,
        showWarningMessage: (message, ...items) => vscode.window.showWarningMessage(message, ...items),
        showInformationMessage: (message, ...items) => vscode.window.showInformationMessage(message, ...items),
        withProgress: (options, task) => vscode.window.withProgress(options, task),
        executeCommand: (command, ...args) => vscode.commands.executeCommand(command, ...args)
    };
}

async function installVsixAndWait(vsixUri: vscode.Uri): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            subscription.dispose();
            resolve();
        }, 120_000);
        const subscription = vscode.extensions.onDidChange(() => {
            if (vscode.extensions.getExtension(TEACHER_EXTENSION_ID)) {
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

export class UpdateService {
    private lastCheck: UpdateCheckResult | null = null;
    private readonly deps: UpdateServiceDeps;

    public constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly output: vscode.OutputChannel,
        deps?: Partial<UpdateServiceDeps>
    ) {
        this.deps = { ...defaultDeps(context), ...deps };
    }

    public getInstalledVersion(): string {
        return this.context.extension.packageJSON.version ?? '?';
    }

    public getCachedCheck(): UpdateCheckResult | null {
        return this.lastCheck;
    }

    public async checkForUpdates(options: { notify?: boolean; silent?: boolean } = {}): Promise<UpdateCheckResult> {
        const installedVersion = this.getInstalledVersion();
        try {
            const latest = await this.deps.fetchLatest();
            const result = buildUpdateCheckResult(installedVersion, latest);
            this.lastCheck = result;
            this.output.appendLine(`[update] ${result.message}`);
            if (options.notify !== false && !options.silent) {
                await this.showCheckNotification(result);
            }
            return result;
        } catch (err) {
            const result = buildUpdateCheckError(installedVersion, err);
            this.lastCheck = result;
            this.output.appendLine(`[update] check failed: ${err instanceof Error ? err.message : String(err)}`);
            if (options.notify !== false && !options.silent) {
                await this.deps.showWarningMessage(result.message);
            }
            return result;
        }
    }

    public async updateFromOpenVsx(): Promise<{ ok: boolean; message: string }> {
        const check = pickAvailableUpdateCheck(
            this.lastCheck,
            await this.checkForUpdates({ notify: false, silent: true })
        );

        if (check.status === 'error') {
            return { ok: false, message: check.message };
        }
        if (!canInstallUpdate(check)) {
            return { ok: false, message: check.message };
        }

        const extensionFsPath = this.deps.getExtensionFsPath();
        if (extensionFsPath) {
            const pinState = readExtensionPinState(extensionFsPath, TEACHER_EXTENSION_ID);
            if (pinState === 'pinned') {
                const cleared = tryClearExtensionPin(extensionFsPath, TEACHER_EXTENSION_ID);
                this.output.appendLine(
                    cleared
                        ? '[update] cleared pinned flag in profile extensions.json before install'
                        : '[update] extension is pinned; install may require unpinning in Extensions view'
                );
            }
        }

        try {
            const updatesDir = path.join(this.context.globalStorageUri.fsPath, 'updates');
            this.deps.mkdirSync(updatesDir, { recursive: true });
            const vsixPath = path.join(updatesDir, `teacher-${check.latestVersion}.vsix`);
            this.output.appendLine(`[update] downloading ${check.downloadUrl}`);
            await this.deps.downloadVsix(check.downloadUrl, vsixPath);
            const vsixUri = vscode.Uri.file(vsixPath);
            this.output.appendLine(`[update] installing ${vsixPath}`);
            await this.deps.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Installing Teacher v${check.latestVersion}…` },
                async () => {
                    await this.deps.installVsix(vsixUri);
                }
            );

            const runningVersion = this.getInstalledVersion();
            let message = `Installed Teacher v${check.latestVersion}. Reload the window if you have not already.`;
            if (runningVersion !== check.latestVersion) {
                message += ` Running version is still v${runningVersion} until reload.`;
                if (extensionFsPath && readExtensionPinState(extensionFsPath, TEACHER_EXTENSION_ID) === 'pinned') {
                    message += ` Extension is still pinned (${pinStateHint('pinned')}). Unpin in Extensions, then retry.`;
                }
            }

            const reload = 'Reload Window';
            const choice = await this.deps.showInformationMessage(
                `Teacher v${check.latestVersion} installed. Reload the window to activate the update.`,
                reload
            );
            if (choice === reload) {
                await this.deps.executeCommand('workbench.action.reloadWindow');
            }
            return { ok: true, message };
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
            const choice = await this.deps.showInformationMessage(result.message, update);
            if (choice === update) {
                const install = await this.updateFromOpenVsx();
                if (!install.ok) {
                    await this.deps.showWarningMessage(install.message);
                }
            }
            return;
        }
        if (result.status === 'current') {
            await this.deps.showInformationMessage(result.message);
            return;
        }
        await this.deps.showWarningMessage(result.message);
    }
}
