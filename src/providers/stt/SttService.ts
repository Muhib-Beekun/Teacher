import * as vscode from 'vscode';
import { VoiceSessionContext } from '../../context/VoiceSessionContext';
import { applyHomonymPass } from '../../stt/HomonymPass';
import { TranscriptResult, SttProviderId } from './types';
import { DeepgramSttAdapter } from './DeepgramSttAdapter';
import { WhisperCppSttAdapter } from './WhisperCppSttAdapter';

export class SttService {
    private readonly whisper: WhisperCppSttAdapter;
    private readonly deepgram: DeepgramSttAdapter;

    constructor(
        secrets: vscode.SecretStorage,
        private readonly output: vscode.OutputChannel
    ) {
        this.whisper = new WhisperCppSttAdapter(output);
        this.deepgram = new DeepgramSttAdapter(secrets, output);
    }

    /** webspeech = browser-only; returns recorder for whisper/deepgram */
    async resolveRecorderMode(): Promise<'webspeech' | 'recorder'> {
        const id = await this.resolveProviderId();
        return id === 'webspeech' ? 'webspeech' : 'recorder';
    }

    async resolveProviderId(): Promise<Exclude<SttProviderId, 'auto'>> {
        const setting = vscode.workspace.getConfiguration('teacher.stt').get<SttProviderId>('provider', 'auto');
        if (setting !== 'auto') {
            return setting;
        }
        if (await this.whisper.isAvailable()) {
            return 'whisper';
        }
        if (await this.deepgram.isAvailable()) {
            return 'deepgram';
        }
        return 'webspeech';
    }

    async transcribeAudio(audio: Buffer, mimeType: string, ctx: VoiceSessionContext): Promise<TranscriptResult> {
        const providerId = await this.resolveProviderId();
        if (providerId === 'webspeech') {
            throw new Error('Audio transcription requires whisper or deepgram provider.');
        }

        let textRaw: string;
        if (providerId === 'whisper') {
            textRaw = await this.whisper.transcribe(audio, mimeType, ctx);
        } else {
            textRaw = await this.deepgram.transcribe(audio, mimeType, ctx);
        }

        const { text, fixes } = applyHomonymPass(textRaw, ctx.dictionary_context);
        return { text, textRaw, fixes };
    }

    processWebSpeechText(text: string, ctx: VoiceSessionContext): TranscriptResult {
        const { text: corrected, fixes } = applyHomonymPass(text, ctx.dictionary_context);
        return { text: corrected, textRaw: text, fixes };
    }
}
