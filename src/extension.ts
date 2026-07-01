import * as vscode from 'vscode';
import { WorkspaceContextIndex } from './context/WorkspaceContextIndex';
import { TeacherSessionPanel } from './ui/TeacherSessionPanel';

const REBUILD_DEBOUNCE_MS = 2500;

export function activate(context: vscode.ExtensionContext): void {
    const contextIndex = new WorkspaceContextIndex();
    const output = vscode.window.createOutputChannel('Teacher');
    const panel = new TeacherSessionPanel(context, () => contextIndex.getContext());

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
                placeHolder: 'Say or type a segment (placeholder while STT is not wired yet).',
                prompt: 'This command currently uses text input as a stand-in for STT output.'
            });

            if (segmentText === undefined) {
                return;
            }

            const segment = segmentText.trim() || 'Placeholder segment from Teacher append command.';
            await contextIndex.rebuild({ recentUtterance: segment });
            panel.appendSegment(segment);
        }),

        vscode.commands.registerCommand('teacher.compile', async () => {
            panel.startSession();
            panel.forceCompile();
            vscode.window.showInformationMessage('Teacher compiled the current session preview.');
        }),

        vscode.commands.registerCommand('teacher.send', async () => {
            const compiledBrief = panel.sendCompiledBrief();

            if (!compiledBrief) {
                vscode.window.showWarningMessage('Teacher session is empty. Append a segment before sending.');
                return;
            }

            await vscode.env.clipboard.writeText(compiledBrief);
            vscode.window.showInformationMessage(
                'Teacher copied the compiled brief to your clipboard. Paste into Cursor chat or an editor target.'
            );
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
            vscode.window.showInformationMessage(
                `Teacher context index rebuilt (${ctx.dictionary_context.length} terms). See Teacher output channel.`
            );
        })
    );
}

export function deactivate(): void {
    // No background process yet; cleanup happens through disposables.
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
