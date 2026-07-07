import * as vscode from 'vscode';
import { resolveInferenceConfig } from '../config/resolveInferenceConfig';
import { extensionHostLabel, isRemoteExtensionHost } from './isRemoteExtensionHost';
import type { ExtensionDiagnosticsView } from '../shared/types';
import type { UpdateCheckResult } from '../shared/types';
import {
    pinStateHint,
    readExtensionPinState,
    TEACHER_EXTENSION_ID
} from '../update/extensionProfileState';

export function inferInstallChannelHint(): string {
    const ext = vscode.extensions.getExtension('muhib-beekun.teacher');
    const path = ext?.extensionUri.fsPath.replace(/\\/g, '/').toLowerCase() ?? '';
    if (path.includes('/.vscode/extensions/') || path.includes('/.cursor/extensions/')) {
        return 'Open VSX / VSIX (manual updates)';
    }
    if (path.includes('.vscode-server') || path.includes('.cursor-server')) {
        return 'Open VSX / VSIX on remote host (manual updates)';
    }
    return 'Open VSX / VSIX (manual updates; channel hint)';
}

export function gatherExtensionDiagnostics(updateCheck?: UpdateCheckResult | null): ExtensionDiagnosticsView {
    const remote = isRemoteExtensionHost();
    const config = vscode.workspace.getConfiguration('teacher');
    const compileProvider = config.get<string>('compile.provider', 'auto');
    const allowRemoteLm = config.get<boolean>('compile.vscodeLm.allowOnRemote', false);
    const effective = resolveInferenceConfig();
    const envOverrideDetected =
        effective.baseUrlSource === 'env' ||
        effective.modelSource === 'env' ||
        Boolean(process.env.INFERENCE_API_KEY?.trim());

    const envParts: string[] = [];
    if (effective.baseUrlSource === 'env') {
        envParts.push('INFERENCE_BASE_URL');
    }
    if (effective.modelSource === 'env') {
        envParts.push('INFERENCE_MODEL');
    }
    if (process.env.INFERENCE_API_KEY?.trim()) {
        envParts.push('INFERENCE_API_KEY');
    }

    const usesVscodeLm =
        compileProvider === 'vscode-lm' ||
        (compileProvider === 'auto' && !remote) ||
        (compileProvider === 'auto' && remote && allowRemoteLm);

    const ext = vscode.extensions.getExtension(TEACHER_EXTENSION_ID);
    const installedVersion = ext?.packageJSON?.version ?? '?';
    const pinState = ext ? readExtensionPinState(ext.extensionUri.fsPath, TEACHER_EXTENSION_ID) : 'unknown';

    return {
        extensionHost: extensionHostLabel(),
        remoteName: vscode.env.remoteName ?? '',
        installChannelHint: inferInstallChannelHint(),
        envOverrideDetected,
        envOverrideHint: envOverrideDetected ? envParts.join(', ') || 'workspace .env' : '',
        vscodeLmRemoteWarning: remote && usesVscodeLm,
        installedVersion,
        updateStatus: updateCheck?.status ?? 'unknown',
        latestVersion: updateCheck?.latestVersion,
        updateMessage: updateCheck?.message,
        pinState,
        pinStateHint: pinStateHint(pinState)
    };
}
