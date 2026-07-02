import { DEFAULT_INFERENCE_BASE_URL, DEFAULT_INFERENCE_MODEL } from './inferenceModels';
import { readInferenceBaseUrlFromEnv, readInferenceModelFromEnv } from './inferenceEnv';
import { matchInferencePreset } from './inferencePresets';
import * as vscode from 'vscode';

export type InferenceConfigSource = 'env' | 'settings' | 'default';

export interface ResolvedInferenceConfig {
    baseUrl: string;
    model: string;
    presetId: string;
    baseUrlSource: InferenceConfigSource;
    modelSource: InferenceConfigSource;
}

function pickBaseUrl(): { value: string; source: InferenceConfigSource } {
    const fromEnv = readInferenceBaseUrlFromEnv();
    if (fromEnv) {
        return { value: fromEnv, source: 'env' };
    }
    const fromSettings = vscode.workspace
        .getConfiguration('teacher.inference.llm')
        .get<string>('baseUrl', '')
        .trim();
    if (fromSettings) {
        return { value: fromSettings.replace(/\/$/, ''), source: 'settings' };
    }
    return { value: DEFAULT_INFERENCE_BASE_URL, source: 'default' };
}

function pickModel(): { value: string; source: InferenceConfigSource } {
    const fromEnv = readInferenceModelFromEnv();
    if (fromEnv) {
        return { value: fromEnv, source: 'env' };
    }
    const fromSettings = vscode.workspace
        .getConfiguration('teacher.inference.llm')
        .get<string>('model', '')
        .trim();
    if (fromSettings) {
        return { value: fromSettings, source: 'settings' };
    }
    return { value: DEFAULT_INFERENCE_MODEL, source: 'default' };
}

/** Effective inference endpoint (env overrides VS Code settings). */
export function resolveInferenceConfig(): ResolvedInferenceConfig {
    const base = pickBaseUrl();
    const model = pickModel();
    return {
        baseUrl: base.value,
        model: model.value,
        presetId: matchInferencePreset(base.value, model.value),
        baseUrlSource: base.source,
        modelSource: model.source
    };
}
