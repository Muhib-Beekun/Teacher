import * as vscode from 'vscode';
import {
    buildActiveCompileLabel,
    buildCloudInferenceLabel,
    formatInferenceConfigSource,
    LlmKeySource
} from '../config/inferenceDisplay';
import { INFERENCE_MODEL_OPTIONS } from '../config/inferenceModels';
import { INFERENCE_PROVIDER_PRESETS } from '../config/inferencePresets';
import { loadWorkspaceEnv } from '../config/loadWorkspaceEnv';
import { resolveInferenceConfig, InferenceConfigSource } from '../config/resolveInferenceConfig';
import {
    getWhisperStatus,
    WHISPER_MODELS_URL,
    WHISPER_RELEASES_URL
} from '../stt/WhisperSetup';

import type { AppSettingsView, ExtensionDiagnosticsView } from '../shared/types';

export type { AppSettingsView };

const UI_SETTING_KEYS = [
    'teacher.compile.live',
    'teacher.compile.polishStt',
    'teacher.compile.provider',
    'teacher.stt.homonymPass',
    'teacher.send.autoPaste',
    'teacher.send.autoSubmit',
    'teacher.compile.mode',
    'teacher.stt.provider',
    'teacher.context.rebuildMode',
    'teacher.capture.sidecarPort',
    'teacher.inference.llm.baseUrl',
    'teacher.inference.llm.model',
    'teacher.stt.whisper.binaryPath',
    'teacher.stt.whisper.modelPath',
    'teacher.stt.browserRecovery.maxRetries',
    'teacher.stt.browserRecovery.enableAutoFallback',
    'teacher.stt.browserRecovery.resetWindowSec'
] as const;

function formatConfigSource(baseUrlSource: InferenceConfigSource, modelSource: InferenceConfigSource): string {
    return formatInferenceConfigSource(baseUrlSource, modelSource);
}

export async function readAppSettings(deps: {
    sttLabel: string;
    compileLabel: string;
    contextHint: string;
    compilerKeySet: boolean;
    compilerReady: boolean;
    serverUrl: string;
    llmKeySet: boolean;
    llmKeySource: LlmKeySource;
    activeCompileProvider: string;
    diagnostics: ExtensionDiagnosticsView;
}): Promise<AppSettingsView> {
    loadWorkspaceEnv();
    const config = vscode.workspace.getConfiguration('teacher');
    const effective = resolveInferenceConfig();
    const rawProvider = config.get<string>('compile.provider', 'auto');
    const compileProvider = rawProvider === 'grok' ? 'cloud' : rawProvider;
    return {
        compileLive: config.get<boolean>('compile.live', true),
        polishStt: config.get<boolean>('compile.polishStt', true),
        homonymPass: config.get<boolean>('stt.homonymPass', true),
        sendAutoPaste: config.get<boolean>('send.autoPaste', true),
        sendAutoSubmit: config.get<boolean>('send.autoSubmit', true),
        compileMode: config.get<string>('compile.mode', 'teacher'),
        compileProvider,
        sttProvider: config.get<string>('stt.provider', 'auto'),
        compilerKeySet: deps.compilerKeySet,
        compilerReady: deps.compilerReady,
        sttLabel: deps.sttLabel,
        compileLabel: deps.compileLabel,
        contextHint: deps.contextHint,
        contextRebuildMode: config.get<string>('context.rebuildMode', 'clearSession'),
        sidecarPort: config.get<number>('capture.sidecarPort', 3721),
        serverUrl: deps.serverUrl,
        llmKeySet: deps.llmKeySet,
        llmBaseUrl: effective.baseUrl,
        llmModel: effective.model,
        llmConfigSource: formatConfigSource(effective.baseUrlSource, effective.modelSource),
        llmBaseUrlSource: effective.baseUrlSource,
        llmModelSource: effective.modelSource,
        llmKeySource: deps.llmKeySource,
        cloudInferenceLabel: buildCloudInferenceLabel(effective, deps.llmKeySource),
        activeCompileProvider: deps.activeCompileProvider,
        compileProviderSetting: compileProvider,
        activeCompileLabel: buildActiveCompileLabel(
            deps.compileLabel,
            compileProvider,
            deps.activeCompileProvider
        ),
        inferenceModels: INFERENCE_MODEL_OPTIONS.map((m) => ({ id: m.id, label: m.label, provider: m.provider })),
        inferencePresets: INFERENCE_PROVIDER_PRESETS.map((p) => ({
            id: p.id,
            label: p.label,
            baseUrl: p.baseUrl,
            model: p.model,
            keyHint: p.keyHint
        })),
        inferencePresetId: effective.presetId,
        extensionVersion: vscode.extensions.getExtension('muhib-beekun.teacher')?.packageJSON?.version ?? '?',
        diagnostics: deps.diagnostics,
        vscodeSettingsFilter: '@ext:muhib-beekun.teacher',
        whisper: await getWhisperStatus(),
        whisperReleasesUrl: WHISPER_RELEASES_URL,
        whisperModelsUrl: WHISPER_MODELS_URL,
        browserRecoveryMaxRetries: config.get<number>('stt.browserRecovery.maxRetries', 4),
        browserRecoveryEnableAutoFallback: config.get<boolean>('stt.browserRecovery.enableAutoFallback', true),
        browserRecoveryResetWindowSec: config.get<number>('stt.browserRecovery.resetWindowSec', 75)
    };
}

export async function updateAppSetting(key: string, value: boolean | string | number): Promise<void> {
    if (!UI_SETTING_KEYS.includes(key as (typeof UI_SETTING_KEYS)[number])) {
        throw new Error(`Setting not exposed in UI: ${key}`);
    }
    if (key.startsWith('teacher.inference.llm.')) {
        const field = key.replace('teacher.inference.llm.', '');
        await vscode.workspace.getConfiguration('teacher.inference.llm').update(field, value, vscode.ConfigurationTarget.Global);
        return;
    }
    if (key.startsWith('teacher.capture.')) {
        const field = key.replace('teacher.capture.', '');
        await vscode.workspace.getConfiguration('teacher.capture').update(field, value, vscode.ConfigurationTarget.Global);
        return;
    }
    if (key.startsWith('teacher.stt.whisper.')) {
        const field = key.replace('teacher.stt.whisper.', '');
        await vscode.workspace.getConfiguration('teacher.stt.whisper').update(field, value, vscode.ConfigurationTarget.Global);
        return;
    }
    const field = key.replace(/^teacher\./, '');
    await vscode.workspace.getConfiguration('teacher').update(field, value, vscode.ConfigurationTarget.Global);
}

export function listToggleKeys(): readonly string[] {
    return [
        'teacher.compile.live',
        'teacher.compile.polishStt',
        'teacher.stt.homonymPass',
        'teacher.send.autoPaste',
        'teacher.send.autoSubmit'
    ];
}
