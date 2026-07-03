import * as vscode from 'vscode';
import { VoiceSessionContext } from '../../context/VoiceSessionContext';
import { applyHomonymPass } from '../../stt/HomonymPass';
import { SttFix } from '../../session/types';
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

        return this.withOptionalHomonymPass(textRaw, ctx);
    }

    processWebSpeechText(text: string, ctx: VoiceSessionContext): TranscriptResult {
        return this.withOptionalHomonymPass(text.trim(), ctx);
    }

    /** Vectorless dictionary corrections — runs even when homonymPass setting is off if force=true. */
    applyDictionaryCorrections(textRaw: string, ctx: VoiceSessionContext, force = true): TranscriptResult {
        if (!textRaw) {
            return { text: '', textRaw: '', fixes: [] };
        }
        if (!force && !this.isHomonymPassEnabled()) {
            return { text: textRaw, textRaw, fixes: [] };
        }
        const { text, fixes } = applyHomonymPass(textRaw, ctx.dictionary_context);
        return { text, textRaw, fixes };
    }

    private withOptionalHomonymPass(textRaw: string, ctx: VoiceSessionContext): TranscriptResult {
        if (!textRaw) {
            return { text: '', textRaw: '', fixes: [] };
        }
        if (!this.isHomonymPassEnabled()) {
            return { text: textRaw, textRaw, fixes: [] };
        }
        const { text, fixes } = applyHomonymPass(textRaw, ctx.dictionary_context);
        return { text, textRaw, fixes };
    }

    private isHomonymPassEnabled(): boolean {
        return vscode.workspace.getConfiguration('teacher.stt').get<boolean>('homonymPass', true);
    }
}
