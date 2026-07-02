import * as vscode from 'vscode';
import { INFERENCE_MODEL_OPTIONS } from '../config/inferenceModels';
import { INFERENCE_PROVIDER_PRESETS } from '../config/inferencePresets';
import { resolveInferenceConfig } from '../config/resolveInferenceConfig';

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
    inferenceModels: { id: string; label: string }[];
    inferencePresets: { id: string; label: string; baseUrl: string; model: string; keyHint: string }[];
    inferencePresetId: string;
    vscodeSettingsFilter: string;
}

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
    'teacher.inference.llm.model'
] as const;

function formatConfigSource(baseUrlSource: string, modelSource: string): string {
    if (baseUrlSource === 'env' || modelSource === 'env') {
        return 'from .env';
    }
    if (baseUrlSource === 'settings' || modelSource === 'settings') {
        return 'from settings';
    }
    return 'defaults';
}

export async function readAppSettings(deps: {
    sttLabel: string;
    compileLabel: string;
    contextHint: string;
    compilerKeySet: boolean;
    compilerReady: boolean;
    serverUrl: string;
    llmKeySet: boolean;
}): Promise<AppSettingsView> {
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
        inferenceModels: INFERENCE_MODEL_OPTIONS.map((m) => ({ id: m.id, label: m.label })),
        inferencePresets: INFERENCE_PROVIDER_PRESETS.map((p) => ({
            id: p.id,
            label: p.label,
            baseUrl: p.baseUrl,
            model: p.model,
            keyHint: p.keyHint
        })),
        inferencePresetId: effective.presetId,
        vscodeSettingsFilter: '@ext:muhib-beekun.teacher'
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
