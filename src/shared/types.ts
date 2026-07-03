export type InferenceConfigSource = 'env' | 'settings' | 'default';
export type LlmKeySource = 'env' | 'secrets' | 'none';

export interface WhisperStatusView {
    binaryPath: string;
    modelPath: string;
    binaryExists: boolean;
    modelExists: boolean;
    ready: boolean;
    statusLabel: string;
}

export interface AppSettingsView {
    compileLive: boolean;
    polishStt: boolean;
    homonymPass: boolean;
    sendAutoPaste: boolean;
    sendAutoSubmit: boolean;
    compileMode: string;
    compileProvider: string;
    sttProvider: string;
    compilerKeySet: boolean;
    compilerReady: boolean;
    sttLabel: string;
    compileLabel: string;
    contextHint: string;
    contextRebuildMode: string;
    sidecarPort: number;
    serverUrl: string;
    llmKeySet: boolean;
    llmBaseUrl: string;
    llmModel: string;
    llmConfigSource: string;
    llmBaseUrlSource: InferenceConfigSource;
    llmModelSource: InferenceConfigSource;
    llmKeySource: LlmKeySource;
    cloudInferenceLabel: string;
    activeCompileLabel: string;
    activeCompileProvider: string;
    compileProviderSetting: string;
    inferenceModels: { id: string; label: string; provider: string }[];
    inferencePresets: { id: string; label: string; baseUrl: string; model: string; keyHint: string }[];
    inferencePresetId: string;
    vscodeSettingsFilter: string;
    extensionVersion: string;
    whisper: WhisperStatusView;
    whisperReleasesUrl: string;
    whisperModelsUrl: string;
}

export interface SessionSnapshot {
    transcriptHtml: string;
    briefHtml: string;
    compiled: string;
    compileError?: string;
    needsRegenerate?: boolean;
    briefVersion?: number;
    briefMarkdownByVersion: Record<number, string>;
    segmentCount: number;
    sttLabel: string;
    compileLabel: string;
    contextHint: string;
    status?: string;
}

export interface RuntimeInfo {
    url: string;
    segmentCount: number;
    needsRegenerate: boolean;
    contextTermCount: number;
    targetFileCount: number;
    totalFixCount: number;
}

export interface HealthInfo {
    ok?: boolean;
    mode?: string;
    url?: string;
    compileReady?: boolean;
    stt?: string;
    [key: string]: unknown;
}
