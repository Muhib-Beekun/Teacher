import * as vscode from 'vscode';
import { loadWorkspaceEnv } from './config/loadWorkspaceEnv';
import { WebAppServer } from './capture/WebAppServer';
import { WorkspaceContextIndex } from './context/WorkspaceContextIndex';
import { sendBrief } from './insert/InsertRouter';
import { CompileService } from './providers/compile/CompileService';
import { SttService } from './providers/stt/SttService';
import { getGrokApiKey, promptDeepgramApiKey, promptGrokApiKey } from './secrets/SecretStorage';
import { TeacherSessionPanel } from './ui/TeacherSessionPanel';
import { BrowserSessionBridge } from './web/BrowserSessionBridge';

const REBUILD_DEBOUNCE_MS = 2500;

export function activate(context: vscode.ExtensionContext): void {
    loadWorkspaceEnv();
    const contextIndex = new WorkspaceContextIndex();
    const output = vscode.window.createOutputChannel('Teacher');
    const sttService = new SttService(context.secrets, output);
    const compileService = new CompileService(output, () => getGrokApiKey(context.secrets));
    const webApp = new WebAppServer(context.extensionPath);
    webApp.setOutput(output);

    const bridge = new BrowserSessionBridge({
        getVoiceContext: () => contextIndex.getContext(),
        rebuildContext: async (recentUtterance) => {
            await contextIndex.rebuild(recentUtterance ? { recentUtterance } : {});
        },
        sttService,
        compileService
    });

    webApp.setHealthProvider(async () => ({
        stt: await sttService.resolveProviderId(),
        compile: await compileService.resolveProviderId(),
        grokKeySet: await compileService.isGrokConfigured()
    }));

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
        openWebUi
    });

    webApp.setSendHandler(async (source, briefVersion) => {
        const result = await panel.sendToAgent(source, briefVersion);
        if (!result) {
            return { ok: false, message: 'Session is empty — speak first.' };
        }
        if (result.submitted) {
            return { ok: true, message: 'Sent to Cursor agent.' };
        }
        if (result.pasted) {
            return { ok: true, message: 'Pasted into Composer — press Enter if needed.' };
        }
        return { ok: true, message: 'Brief copied to clipboard.' };
    });

    bridge.onUpdated = () => {
        void panel.refreshFromBridge();
    };

    void bridge.init().then(() => startWebApp()).then(async (port) => {
        output.appendLine(`[web] Teacher UI ready at http://127.0.0.1:${port}/`);
        output.appendLine('[web] Open in Chrome/Edge — speak, scaffold brief, copy into Cursor.');
        const grokOk = await compileService.isGrokConfigured();
        if (grokOk) {
            output.appendLine('[grok] API key found — compile and STT polish use Grok.');
        } else {
            output.appendLine('[grok] No API key — run Teacher: Set Grok API Key, or add XAI_API_KEY to workspace .env');
        }
    }).catch((err) => {
        output.appendLine(`[web] Server failed to start: ${err}`);
        void vscode.window.showErrorMessage(`Teacher web server failed: ${err}`);
    });

    const scheduleRebuild = debounce(() => {
        void contextIndex.rebuild().then((ctx) => {
            output.appendLine(
                `[context] ${ctx.dictionary_context.length} terms, ${ctx.targetFiles.length} targets`
            );
        });
    }, REBUILD_DEBOUNCE_MS);

    void contextIndex.rebuild();

    context.subscriptions.push(
        output,
        { dispose: () => webApp.stop() },
        vscode.workspace.onDidChangeTextDocument(() => scheduleRebuild()),
        vscode.workspace.onDidOpenTextDocument(() => scheduleRebuild()),
        vscode.window.onDidChangeActiveTextEditor(() => scheduleRebuild()),

        vscode.commands.registerCommand('teacher.startSession', async () => {
            await contextIndex.rebuild();
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

        vscode.commands.registerCommand('teacher.setGrokApiKey', async () => {
            await promptGrokApiKey(context.secrets);
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
        })
    );
}

export function deactivate(): void { }

function debounce(fn: () => void, ms: number): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(fn, ms);
    };
}
