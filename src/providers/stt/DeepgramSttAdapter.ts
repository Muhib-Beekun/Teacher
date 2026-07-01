import * as vscode from 'vscode';
import { VoiceSessionContext } from '../../context/VoiceSessionContext';
import { getDeepgramApiKey } from '../../secrets/SecretStorage';
import { SttProvider } from './types';

export class DeepgramSttAdapter implements SttProvider {
    readonly id = 'deepgram';

    constructor(
        private readonly secrets: vscode.SecretStorage,
        private readonly output: vscode.OutputChannel
    ) { }

    async isAvailable(): Promise<boolean> {
        const key = await getDeepgramApiKey(this.secrets);
        return Boolean(key?.trim());
    }

    async transcribe(audio: Buffer, mimeType: string, ctx: VoiceSessionContext): Promise<string> {
        const apiKey = await getDeepgramApiKey(this.secrets);
        if (!apiKey) {
            throw new Error('Deepgram API key not set. Run Teacher: Set Deepgram API Key.');
        }

        const model = vscode.workspace.getConfiguration('teacher.stt.deepgram').get<string>('model', 'nova-2');
        const keywords = ctx.dictionary_context.slice(0, 100).map((k) => encodeURIComponent(k)).join('&keywords=');
        const keywordQuery = keywords ? `&keywords=${keywords}` : '';
        const url = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}&smart_format=true&punctuate=true${keywordQuery}`;

        const contentType = mimeType.includes('webm') ? 'audio/webm' : mimeType.includes('wav') ? 'audio/wav' : 'application/octet-stream';

        this.output.appendLine(`[stt:deepgram] transcribing ${audio.length} bytes`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Token ${apiKey}`,
                'Content-Type': contentType
            },
            body: new Uint8Array(audio)
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Deepgram STT failed (${response.status}): ${body.slice(0, 200)}`);
        }

        const json = (await response.json()) as {
            results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
        };
        const text = json.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? '';
        if (!text) {
            throw new Error('Deepgram returned empty transcript.');
        }
        return text;
    }
}
