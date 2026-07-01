export function formatSttLabel(providerId: string): string {
    switch (providerId) {
        case 'webspeech':
            return 'Chrome/Edge live preview (browser)';
        case 'whisper':
            return 'Local whisper.cpp';
        case 'deepgram':
            return 'Deepgram cloud API';
        default:
            return providerId;
    }
}

export function formatCompileLabel(providerId: string, model = ''): string {
    if (providerId === 'grok' && model) {
        return `Grok · ${model}`;
    }
    switch (providerId) {
        case 'none':
            return 'Grok required — no API key';
        case 'grok':
            return 'Grok (xAI remote)';
        default:
            return providerId;
    }
}

export function formatContextHint(termCount: number): string {
    if (termCount === 0) {
        return 'Workspace index empty';
    }
    return `${termCount} workspace terms (STT hints when homonym pass enabled)`;
}
