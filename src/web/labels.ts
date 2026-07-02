export function formatSttLabel(providerId: string): string {
    switch (providerId) {
        case 'webspeech':
            return 'Browser speech (Chrome/Edge)';
        case 'whisper':
            return 'Local whisper.cpp';
        case 'deepgram':
            return 'Cloud speech API';
        default:
            return providerId;
    }
}

export function formatCompileLabel(providerId: string, model = ''): string {
    switch (providerId) {
        case 'none':
            return 'Compiler key needed';
        case 'cloud':
        case 'grok':
            return model ? `Inference API (${model})` : 'Inference API compile';
        case 'ollama':
            return model ? `Local Ollama (${model})` : 'Local Ollama compile';
        case 'vscode-lm':
            return model ? `VS Code LM (${model})` : 'VS Code LM (Copilot)';
        default:
            return 'Brief compiler';
    }
}

export function formatContextHint(termCount: number, targetCount = 0): string {
    if (termCount === 0) {
        return 'Vectorless index empty. Open repo files.';
    }
    const files = targetCount > 0 ? ` · ${targetCount} open files for Target` : '';
    return `${termCount} workspace terms → STT + Target${files}`;
}
