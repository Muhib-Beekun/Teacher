import * as vscode from 'vscode';
import { loadWorkspaceEnv } from './config/loadWorkspaceEnv';
import { resolveInferenceConfig } from './config/resolveInferenceConfig';
import { ensureCodewordsFile } from './config/CodewordsManager';
import { WebAppServer } from './capture/WebAppServer';
import { WorkspaceContextIndex } from './context/WorkspaceContextIndex';
import { sendBrief } from './insert/InsertRouter';
import { CompileService } from './providers/compile/CompileService';
import { SttService } from './providers/stt/SttService';
import { getLlmApiKey, getLlmKeySource, promptDeepgramApiKey, promptLlmApiKey, setLlmApiKey } from './secrets/SecretStorage';
import { TeacherSessionPanel } from './ui/TeacherSessionPanel';
import { BrowserSessionBridge, ContextRebuildMode } from './web/BrowserSessionBridge';
import { gatherExtensionDiagnostics } from './host/extensionDiagnostics';
import { UpdateService } from './update/UpdateService';

const CURSOR_SETTINGS_FILTER = '@ext:muhib-beekun.teacher';
const GITHUB_RELEASES_URL = 'https://github.com/Muhib-Beekun/Teacher/releases/latest';

export function activate(context: vscode.ExtensionContext): void {
    loadWorkspaceEnv();
    const contextIndex = new WorkspaceContextIndex();
    void (async () => {
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            await ensureCodewordsFile(context.extensionPath, folder);
        }
    })();
    const output = vscode.window.createOutputChannel('Teacher');
    const updateService = new UpdateService(context, output);
    const sttService = new SttService(context.secrets, output);
    const compileService = new CompileService(output, () => getLlmApiKey(context.secrets));
    const webApp = new WebAppServer(context.extensionPath);
    webApp.setOutput(output);

    const getRebuildMode = (): ContextRebuildMode =>
        vscode.workspace.getConfiguration('teacher.context').get<ContextRebuildMode>('rebuildMode', 'clearSession');

    const bridge = new BrowserSessionBridge({
        getVoiceContext: () => contextIndex.getContext(),
        getRebuildMode,
        rebuildContext: async (recentUtterance) => {
            await contextIndex.refresh(recentUtterance ? { recentUtterance } : {});
        },
        ensureCodewordsFile: async () => {
            for (const folder of vscode.workspace.workspaceFolders ?? []) {
                await ensureCodewordsFile(context.extensionPath, folder);
            }
        },
        getLlmKeySource: () => getLlmKeySource(context.secrets),
        sttService,
        compileService,
        getServerUrl: () => webApp.getUrl(),
        setLlmApiKey: async (key) => {
            await setLlmApiKey(context.secrets, key);
        },
        getDiagnostics: () => gatherExtensionDiagnostics(updateService.getCachedCheck()),
        checkForUpdates: (options) => updateService.checkForUpdates(options),
        updateFromOpenVsx: () => updateService.updateFromOpenVsx()
    });

    webApp.setHealthProvider(async () => {
        const compile = await compileService.resolveProviderId();
        const llmKeySet = await compileService.isLlmConfigured();
        const ollamaUp = await compileService.isOllamaAvailable();
        const vscodeLmUp = await compileService.isVscodeLmAvailable();
        return {
            stt: await sttService.resolveProviderId(),
            compile,
            compilerKeySet: llmKeySet || ollamaUp || vscodeLmUp,
            compileReady: compile !== 'none',
            llmKeySet,
            ollamaUp,
            vscodeLmUp
        };
    });

    const startWebApp = () => webApp.start(bridge);

    let panel: TeacherSessionPanel;
    const openWebUi = async () => {
        await startWebApp();
        await webApp.openInBrowser();
        await panel.notifyWebUiOpened(webApp.getUrl());
    };

    panel = new TeacherSessionPanel(context, {
        bridge,
        sendBrief,
        sttService,
        compileService,
        openWebUi,
        getWebUiUrl: () => webApp.getUrl()
    });

    webApp.setActionHandler(async (action) => {
        if (action === 'openVsCodeSettings') {
            // Opening Settings from the extension correlated with Cursor renderer freezes
            // (JSON.stringify blocked ~15s+ in main.log). Copy filter instead.
            await vscode.env.clipboard.writeText(CURSOR_SETTINGS_FILTER);
            return {
                ok: true,
                message: `Copied "${CURSOR_SETTINGS_FILTER}". In Cursor press Ctrl+, and paste into Settings search.`
            };
        }
        if (action === 'checkForUpdates') {
            const result = await bridge.checkForUpdates({ notify: false, silent: true });
            return { ok: result.status !== 'error', message: result.message };
        }
        if (action === 'updateFromOpenVsx') {
            const result = await bridge.updateFromOpenVsx();
            return result;
        }
        if (action === 'openGitHubReleases') {
            await vscode.env.openExternal(vscode.Uri.parse(GITHUB_RELEASES_URL));
            return { ok: true, message: 'Opened GitHub Releases in your browser.' };
        }
        return { ok: false, message: `Unknown action: ${action}` };
    });

    webApp.setWhisperPickHandler(async (target) => {
        if (target === 'binary') {
            const picked = await vscode.window.showOpenDialog({
                canSelectMany: false,
                canSelectFiles: true,
                canSelectFolders: false,
                openLabel: 'Select whisper.cpp CLI',
                title: 'whisper.cpp binary (whisper-cli or main.exe)',
                filters: process.platform === 'win32'
                    ? { Executables: ['exe'], 'All files': ['*'] }
                    : undefined
            });
            return picked?.[0]?.fsPath;
        }

        const picked = await vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFiles: true,
            canSelectFolders: false,
            openLabel: 'Select model',
            title: 'Whisper GGML/GGUF model file',
            filters: {
                Models: ['bin', 'gguf'],
                'All files': ['*']
            }
        });
        return picked?.[0]?.fsPath;
    });

    webApp.setSendHandler(async (source, briefVersion) => {
        const result = await panel.sendToAgent(source, briefVersion);
        if (!result) {
            return { ok: false, message: 'Session is empty. Speak first.' };
        }
        if (result.submitted) {
            return { ok: true, message: 'Sent to Cursor agent.' };
        }
        if (result.pasted) {
            return { ok: true, message: 'Pasted into Composer. Press Enter if needed.' };
        }
        return { ok: true, message: 'Brief copied to clipboard.' };
    });

    bridge.onUpdated = () => {
        if (panel.isOpen()) {
            void panel.refreshFromBridge();
        }
    };

    const envWatcher = vscode.workspace.createFileSystemWatcher('**/.env');
    envWatcher.onDidChange(() => loadWorkspaceEnv());
    envWatcher.onDidCreate(() => loadWorkspaceEnv());
    envWatcher.onDidDelete(() => loadWorkspaceEnv());

    context.subscriptions.push(
        envWatcher,
        vscode.workspace.onDidChangeWorkspaceFolders(async (e) => {
            loadWorkspaceEnv();
            for (const folder of e.added) {
                await ensureCodewordsFile(context.extensionPath, folder);
            }
            if (e.added.length || e.removed.length) {
                contextIndex.onWorkspaceFoldersChanged();
            }
        })
    );

    void bridge.init().then(() => startWebApp()).then(async (port) => {
        output.appendLine(`[web] Teacher UI ready at http://127.0.0.1:${port}/`);
        output.appendLine('[web] MICROPHONE: open Chrome or Edge at the URL above (Teacher: Open Web UI). Allow mic when prompted.');
        const llmOk = await compileService.isLlmConfigured();
        if (llmOk) {
            const { baseUrl, model } = resolveInferenceConfig();
            output.appendLine(`[inference] ${model} @ ${baseUrl} (key from env / SecretStorage)`);
        } else {
            output.appendLine(
                '[inference] No API key. Use Teacher Configuration, workspace .env (INFERENCE_API_KEY), or Teacher: Set Inference API Key.'
            );
        }
    }).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        output.appendLine(`[web] Server failed to start: ${msg}`);
        output.show(true);
        void vscode.window.showErrorMessage(`Teacher web server failed: ${msg}`);
    });

    void contextIndex.initialize();

    context.subscriptions.push(
        output,
        { dispose: () => webApp.stop() },
        { dispose: () => contextIndex.dispose() },
        vscode.workspace.onDidOpenTextDocument((doc) => {
            if (doc.uri.scheme === 'file') {
                contextIndex.onDocumentOpened(doc.uri);
            }
        }),
        vscode.workspace.onDidCloseTextDocument((doc) => {
            if (doc.uri.scheme === 'file') {
                contextIndex.onDocumentClosed(doc.uri);
            }
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (getRebuildMode() === 'onFileChange' && event.document.uri.scheme === 'file') {
                contextIndex.onDocumentSaved(event.document.uri);
            }
        }),
        vscode.window.onDidChangeActiveTextEditor(() => {
            contextIndex.scheduleRankRefresh();
        }),
        vscode.workspace.onDidCreateFiles((event) => {
            if (getRebuildMode() === 'onFileChange') {
                contextIndex.onFilesCreated(event.files);
            }
        }),
        vscode.workspace.onDidDeleteFiles((event) => {
            if (getRebuildMode() === 'onFileChange') {
                contextIndex.onFilesDeleted(event.files);
            }
        }),
        vscode.workspace.onDidRenameFiles((event) => {
            if (getRebuildMode() === 'onFileChange') {
                for (const { oldUri, newUri } of event.files) {
                    contextIndex.onFilesRenamed(oldUri, newUri);
                }
            }
        }),

        vscode.commands.registerCommand('teacher.startSession', async () => {
            await contextIndex.refresh();
            await panel.startSession();
        }),

        vscode.commands.registerCommand('teacher.openMicSidecar', openWebUi),
        vscode.commands.registerCommand('teacher.openWebUi', openWebUi),

        vscode.commands.registerCommand('teacher.appendSegment', async () => {
            await panel.startSession();
            const segmentText = await vscode.window.showInputBox({
                title: 'Teacher: Append Segment',
                placeHolder: 'Type a segment.',
                prompt: 'Adds to the current session without ending it.'
            });
            if (segmentText?.trim()) {
                await panel.appendSegment(segmentText.trim());
            }
        }),

        vscode.commands.registerCommand('teacher.compile', async () => {
            await panel.startSession();
            await panel.forceCompile();
            vscode.window.showInformationMessage('Teacher re-scaffolded the agent prompt.');
        }),

        vscode.commands.registerCommand('teacher.send', async () => {
            const result = await panel.sendToAgent();
            if (!result) {
                vscode.window.showWarningMessage('Teacher session is empty. Add a segment before sending.');
                return;
            }
            output.appendLine(`[send] target=${result.target} pasted=${result.pasted} submitted=${result.submitted}`);
            if (result.submitted) {
                vscode.window.showInformationMessage('Teacher sent your compiled brief to the agent.');
            } else if (result.pasted) {
                vscode.window.showInformationMessage('Teacher pasted into Composer. Press Enter if needed.');
            } else {
                vscode.window.showInformationMessage('Brief copied to clipboard.');
            }
        }),

        vscode.commands.registerCommand('teacher.setInferenceApiKey', async () => {
            await promptLlmApiKey(context.secrets);
        }),

        vscode.commands.registerCommand('teacher.setDeepgramKey', async () => {
            await promptDeepgramApiKey(context.secrets);
        }),

        vscode.commands.registerCommand('teacher.dictateHere', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor for Dictate Here.');
                return;
            }
            await editor.edit((b) => b.insert(editor.selection.active, '[Teacher verbatim]'));
        }),

        vscode.commands.registerCommand('teacher.endSession', async () => {
            panel.endSession();
        }),

        vscode.commands.registerCommand('teacher.rebuildIndex', async () => {
            const ctx = await contextIndex.rebuild();
            output.clear();
            output.show(true);
            output.appendLine(`Index rebuilt: ${ctx.dictionary_context.length} terms`);
            await panel.forceCompile();
            vscode.window.showInformationMessage(`Context index rebuilt (${ctx.dictionary_context.length} terms).`);
        }),

        vscode.commands.registerCommand('teacher.checkForUpdates', async () => {
            await bridge.checkForUpdates({ notify: true });
            if (panel.isOpen()) {
                await panel.refreshFromBridge();
            }
        }),

        vscode.commands.registerCommand('teacher.updateFromOpenVsx', async () => {
            const result = await bridge.updateFromOpenVsx();
            if (!result.ok) {
                vscode.window.showWarningMessage(result.message);
            }
        })
    );

    void updateService.checkForUpdates({ notify: false, silent: true });
}

export function deactivate(): void { }
