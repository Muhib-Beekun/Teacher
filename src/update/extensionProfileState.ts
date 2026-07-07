import * as fs from 'fs';
import * as path from 'path';

export const TEACHER_EXTENSION_ID = 'muhib-beekun.teacher';

export type ExtensionPinState = 'pinned' | 'unpinned' | 'unknown';

export interface StoredProfileExtension {
    identifier?: { id?: string; uuid?: string };
    version?: string;
    metadata?: { pinned?: boolean; source?: string; [key: string]: unknown };
}

/** Profile `extensions.json` sits beside extension install folders. */
export function findExtensionsJsonPath(extensionFsPath: string): string | undefined {
    const candidate = path.join(path.dirname(extensionFsPath), 'extensions.json');
    return fs.existsSync(candidate) ? candidate : undefined;
}

export function parsePinStateFromExtensionsJson(
    extensionsJsonContent: unknown,
    extensionId: string
): ExtensionPinState {
    if (!Array.isArray(extensionsJsonContent)) {
        return 'unknown';
    }
    const entry = extensionsJsonContent.find(
        (item): item is StoredProfileExtension =>
            Boolean(item && typeof item === 'object' && (item as StoredProfileExtension).identifier?.id === extensionId)
    );
    if (!entry) {
        return 'unknown';
    }
    if (entry.metadata?.pinned === true) {
        return 'pinned';
    }
    if (entry.metadata?.pinned === false) {
        return 'unpinned';
    }
    return 'unknown';
}

export function readExtensionPinState(extensionFsPath: string, extensionId: string): ExtensionPinState {
    const jsonPath = findExtensionsJsonPath(extensionFsPath);
    if (!jsonPath) {
        return 'unknown';
    }
    try {
        const raw: unknown = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        return parsePinStateFromExtensionsJson(raw, extensionId);
    } catch {
        return 'unknown';
    }
}

/** Best-effort: clear `metadata.pinned` in profile extensions.json (no public VS Code API). */
export function tryClearExtensionPin(extensionFsPath: string, extensionId: string): boolean {
    const jsonPath = findExtensionsJsonPath(extensionFsPath);
    if (!jsonPath) {
        return false;
    }
    try {
        const raw: unknown = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (!Array.isArray(raw)) {
            return false;
        }
        let changed = false;
        for (const item of raw) {
            const entry = item as StoredProfileExtension;
            if (entry?.identifier?.id === extensionId && entry.metadata?.pinned === true) {
                entry.metadata.pinned = false;
                changed = true;
            }
        }
        if (changed) {
            fs.writeFileSync(jsonPath, JSON.stringify(raw, null, '\t'), 'utf8');
        }
        return changed;
    } catch {
        return false;
    }
}

export function pinStateHint(state: ExtensionPinState): string {
    switch (state) {
        case 'pinned':
            return 'pinned (may block updates until unpinned or reinstalled)';
        case 'unpinned':
            return 'not pinned';
        default:
            return 'unknown (profile metadata not readable)';
    }
}
