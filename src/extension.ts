import * as vscode from 'vscode';
import { MicSidecarServer } from './capture/MicSidecarServer';
import { WorkspaceContextIndex } from './context/WorkspaceContextIndex';
import { sendBrief } from './insert/InsertRouter';
import { CompileService } from './providers/compile/CompileService';
import { SttService } from './providers/stt/SttService';
import { promptDeepgramApiKey } from './secrets/SecretStorage';
import { TeacherSessionPanel } from './ui/TeacherSessionPanel';

const REBUILD_DEBOUNCE_MS = 2500;

export function activate(context: vscode.ExtensionContext): void {
    const contextIndex = new WorkspaceContextIndex();
    const output = vscode.window.createOutputChannel('Teacher');
    const sttService = new SttService(context.secrets, output);
    const compileService = new CompileService(output);
    const sidecar = new MicSidecarServer(context.extensionPath);

    const panel = new TeacherSessionPanel(context, {
        getVoiceContext: () => contextIndex.getContext(),
        rebuildContext: async (recentUtterance) => {
            await contextIndex.rebuild(recentUtterance ? { recentUtterance } : {});
        },
        sendBrief,
        sttService,
        compileService,
        openSidecarMic: async () => {
            await panel.startSession();
            await sidecar.start((buffer, mimeType) => {
                void panel.handleSidecarAudio(buffer, mimeType);
            });
            await sidecar.openInBrowser();
            await panel.notifySidecarOpened();
            output.appendLine(`[mic] Sidecar opened at ${sidecar.getCaptureUrl()}`);
        }
    });

    void sidecar.start((buffer, mimeType) => {
        void panel.handleSidecarAudio(buffer, mimeType);
    }).catch((err) => {
        output.appendLine(`[mic] Sidecar server failed to start: ${err}`);
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
        { dispose: () => sidecar.stop() },
        vscode.workspace.onDidChangeTextDocument(() => scheduleRebuild()),
        vscode.workspace.onDidOpenTextDocument(() => scheduleRebuild()),
        vscode.window.onDidChangeActiveTextEditor(() => scheduleRebuild()),

        vscode.commands.registerCommand('teacher.startSession', async () => {
            await contextIndex.rebuild();
            await panel.startSession();
        }),

        vscode.commands.registerCommand('teacher.openMicSidecar', async () => {
            await vscode.commands.executeCommand('teacher.startSession');
            await sidecar.start((buffer, mimeType) => {
                void panel.handleSidecarAudio(buffer, mimeType);
            });
            await sidecar.openInBrowser();
            await panel.notifySidecarOpened();
        }),

        vscode.commands.registerCommand('teacher.appendSegment', async () => {
            await panel.startSession();
            const segmentText = await vscode.window.showInputBox({
                title: 'Teacher: Append Segment',
                placeHolder: 'Type a segment (or use mic in the Teacher panel).',
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
