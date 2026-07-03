import * as vscode from 'vscode';

/** True when this extension host runs on a remote workspace (SSH, WSL, container, etc.). */
export function isRemoteExtensionHost(): boolean {
    const name = vscode.env.remoteName;
    return typeof name === 'string' && name.length > 0;
}

export function extensionHostLabel(): 'local' | 'remote' {
    return isRemoteExtensionHost() ? 'remote' : 'local';
}
