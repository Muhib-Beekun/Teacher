import { VoiceSessionContext } from '../../context/VoiceSessionContext';
import { SttFix } from '../../session/types';

export interface TranscriptResult {
    text: string;
    textRaw: string;
    fixes: SttFix[];
}

export interface SttProvider {
    readonly id: string;
    isAvailable(): Promise<boolean>;
    transcribe(audio: Buffer, mimeType: string, ctx: VoiceSessionContext): Promise<string>;
}

export type SttProviderId = 'auto' | 'webspeech' | 'whisper' | 'deepgram';
