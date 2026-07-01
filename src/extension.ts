import * as vscode from 'vscode';
import { WorkspaceContextIndex } from './context/WorkspaceContextIndex';
import { sendBrief } from './insert/InsertRouter';
import { TeacherSessionPanel } from './ui/TeacherSessionPanel';

const REBUILD_DEBOUNCE_MS = 2500;

export function activate(context: vscode.ExtensionContext): void {
    const contextIndex = new WorkspaceContextIndex();
    const output = vscode.window.createOutputChannel('Teacher');

    const panel = new TeacherSessionPanel(context, {
        getVoiceContext: () => contextIndex.getContext(),
        rebuildContext: async (recentUtterance) => {
            await contextIndex.rebuild(recentUtterance ? { recentUtterance } : {});
        },
        sendBrief
    });

    const scheduleRebuild = debounce(() => {
        void contextIndex.rebuild().then((ctx) => {
            output.appendLine(
                `[context] Rebuilt index: ${ctx.dictionary_context.length} terms, ${ctx.targetFiles.length} target paths`
            );
        });
    }, REBUILD_DEBOUNCE_MS);

    void contextIndex.rebuild();

    context.subscriptions.push(
        output,
        vscode.workspace.onDidChangeTextDocument(() => scheduleRebuild()),
        vscode.workspace.onDidOpenTextDocument(() => scheduleRebuild()),
        vscode.window.onDidChangeActiveTextEditor(() => scheduleRebuild()),

        vscode.commands.registerCommand('teacher.startSession', async () => {
            await contextIndex.rebuild();
            panel.startSession();
        }),

        vscode.commands.registerCommand('teacher.appendSegment', async () => {
            panel.startSession();

            const segmentText = await vscode.window.showInputBox({
                title: 'Teacher: Append Segment',
                placeHolder: 'Type a segment (or use mic in the Teacher panel).',
                prompt: 'Adds to the current session without ending it.'
            });

            if (segmentText === undefined || !segmentText.trim()) {
                return;
            }

            await panel.appendSegment(segmentText.trim());
        }),

        vscode.commands.registerCommand('teacher.compile', async () => {
            panel.startSession();
            panel.forceCompile();
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
                vscode.window.showInformationMessage(
                    'Teacher pasted your brief into Composer. Press Enter if the agent did not start automatically.'
                );
            } else {
                vscode.window.showInformationMessage(
                    'Teacher copied your brief to the clipboard (Composer handoff unavailable).'
                );
            }
        }),

        vscode.commands.registerCommand('teacher.dictateHere', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found for Teacher: Dictate Here.');
                return;
            }

            const placeholder = '[Teacher verbatim placeholder]';
            await editor.edit((editBuilder) => {
                editBuilder.insert(editor.selection.active, placeholder);
            });
        }),

        vscode.commands.registerCommand('teacher.endSession', async () => {
            panel.endSession();
        }),

        vscode.commands.registerCommand('teacher.rebuildIndex', async () => {
            const ctx = await contextIndex.rebuild();
            output.clear();
            output.show(true);
            output.appendLine('Teacher context index rebuilt.');
            output.appendLine(`Terms (${ctx.dictionary_context.length}): ${ctx.dictionary_context.slice(0, 40).join(', ')}${ctx.dictionary_context.length > 40 ? '…' : ''}`);
            output.appendLine(`Target files (${ctx.targetFiles.length}):`);
            for (const file of ctx.targetFiles.slice(0, 15)) {
                output.appendLine(`  - ${file}`);
            }
            if (ctx.stt_prompt) {
                output.appendLine('');
                output.appendLine(`STT prompt: ${ctx.stt_prompt.slice(0, 240)}${ctx.stt_prompt.length > 240 ? '…' : ''}`);
            }
            panel.forceCompile();
            vscode.window.showInformationMessage(
                `Teacher context index rebuilt (${ctx.dictionary_context.length} terms). See Teacher output channel.`
            );
        })
    );
}

export function deactivate(): void {
    // Cleanup via disposables.
}

function debounce(fn: () => void, ms: number): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return () => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(fn, ms);
    };
}
