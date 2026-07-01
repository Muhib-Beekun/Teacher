/** Ranked workspace terms and targets passed to STT and compile. */
export interface VoiceSessionContext {
    dictionary_context: string[];
    targetFiles: string[];
    stt_prompt: string;
    builtAt: number;
}

export function emptyVoiceSessionContext(): VoiceSessionContext {
    return {
        dictionary_context: [],
        targetFiles: [],
        stt_prompt: '',
        builtAt: 0
    };
}
