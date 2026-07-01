import * as vscode from 'vscode';

export type SendTarget = 'composer' | 'editor' | 'clipboard';

export interface SendResult {
    target: SendTarget;
    pasted: boolean;
    submitted: boolean;
}

const SUBMIT_COMMANDS = [
    'composer.startGeneration',
    'workbench.action.chat.submit',
    'aichat.submitChat'
];

export async function sendBrief(text: string): Promise<SendResult> {
    const config = vscode.workspace.getConfiguration('teacher.send');
    const target = config.get<SendTarget>('target', 'composer');
    const autoPaste = config.get<boolean>('autoPaste', true);
    const autoSubmit = config.get<boolean>('autoSubmit', true);

    switch (target) {
        case 'editor':
            return sendToEditor(text);
        case 'clipboard':
            await vscode.env.clipboard.writeText(text);
            return { target: 'clipboard', pasted: false, submitted: false };
        case 'composer':
        default:
            return sendToComposer(text, autoPaste, autoSubmit);
    }
}

async function sendToEditor(text: string): Promise<SendResult> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        await vscode.env.clipboard.writeText(text);
        vscode.window.showWarningMessage('No active editor — compiled brief copied to clipboard.');
        return { target: 'clipboard', pasted: false, submitted: false };
    }

    await editor.edit((builder) => {
        builder.insert(editor.selection.active, text);
    });
    return { target: 'editor', pasted: true, submitted: false };
}

async function sendToComposer(
    text: string,
    autoPaste: boolean,
    autoSubmit: boolean
): Promise<SendResult> {
    await vscode.env.clipboard.writeText(text);

    if (!autoPaste) {
        return { target: 'composer', pasted: false, submitted: false };
    }

    const opened =
        (await tryCommand('composer.focusComposer'))
        || (await tryCommand('aichat.focus'))
        || (await tryCommand('composer.newAgentChat'))
        || (await tryCommand('aichat.newchataction'));

    if (!opened) {
        vscode.window.showWarningMessage(
            'Could not open Composer — compiled brief is on your clipboard. Paste manually.'
        );
        return { target: 'composer', pasted: false, submitted: false };
    }

    await delay(180);
    await tryCommand('editor.action.clipboardPasteAction');

    let submitted = false;
    if (autoSubmit) {
        await delay(120);
        submitted = await trySubmit();
    }

    return { target: 'composer', pasted: true, submitted };
}

async function trySubmit(): Promise<boolean> {
    for (const cmd of SUBMIT_COMMANDS) {
        if (await tryCommand(cmd)) {
            return true;
        }
    }
    return false;
}

async function tryCommand(command: string): Promise<boolean> {
    try {
        await vscode.commands.executeCommand(command);
        return true;
    } catch {
        return false;
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
