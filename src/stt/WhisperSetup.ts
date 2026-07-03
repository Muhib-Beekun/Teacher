import { execFile, execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

export const WHISPER_RELEASES_URL = 'https://github.com/ggml-org/whisper.cpp/releases';
export const WHISPER_MODELS_URL = 'https://huggingface.co/ggerganov/whisper.cpp/tree/main';

export interface WhisperStatus {
    binaryPath: string;
    modelPath: string;
    binaryExists: boolean;
    modelExists: boolean;
    ready: boolean;
    statusLabel: string;
}

export interface WhisperDiscovery {
    binaryPath?: string;
    modelPath?: string;
    message: string;
}

function whisperConfig() {
    return vscode.workspace.getConfiguration('teacher.stt.whisper');
}

export function readWhisperPaths(): { binaryPath: string; modelPath: string } {
    const config = whisperConfig();
    return {
        binaryPath: config.get<string>('binaryPath', '').trim(),
        modelPath: config.get<string>('modelPath', '').trim()
    };
}

export async function setWhisperPath(field: 'binaryPath' | 'modelPath', value: string): Promise<void> {
    await whisperConfig().update(field, value.trim(), vscode.ConfigurationTarget.Global);
}

export async function getWhisperStatus(): Promise<WhisperStatus> {
    const { binaryPath, modelPath } = readWhisperPaths();
    const binaryExists = binaryPath ? await pathExists(binaryPath) : false;
    const modelExists = modelPath ? await pathExists(modelPath) : false;
    const ready = binaryExists && modelExists;

    let statusLabel = 'Not configured';
    if (ready) {
        statusLabel = 'Ready';
    } else if (binaryPath && !binaryExists) {
        statusLabel = 'Binary not found';
    } else if (modelPath && !modelExists) {
        statusLabel = 'Model not found';
    } else if (binaryExists && !modelPath) {
        statusLabel = 'Model path missing';
    } else if (modelExists && !binaryPath) {
        statusLabel = 'Binary path missing';
    }

    return { binaryPath, modelPath, binaryExists, modelExists, ready, statusLabel };
}

export async function discoverWhisperPaths(): Promise<WhisperDiscovery> {
    const current = readWhisperPaths();
    if (current.binaryPath && current.modelPath) {
        const status = await getWhisperStatus();
        if (status.ready) {
            return { ...current, message: 'Whisper already configured and paths exist.' };
        }
    }

    const binaryPath = current.binaryPath || findBinaryOnPath() || findBinaryInCommonDirs();
    const modelPath =
        current.modelPath
        || (binaryPath ? findModelNear(binaryPath) : undefined)
        || findModelInCommonDirs();

    if (!binaryPath && !modelPath) {
        return {
            message: 'No whisper.cpp binary or model found. Download from releases and pick paths below.'
        };
    }

    const parts: string[] = [];
    if (binaryPath && !current.binaryPath) {
        parts.push('binary');
    }
    if (modelPath && !current.modelPath) {
        parts.push('model');
    }

    return {
        binaryPath: binaryPath || undefined,
        modelPath: modelPath || undefined,
        message: parts.length
            ? `Found ${parts.join(' and ')} on disk — review and save.`
            : 'Configured paths exist but files were not found. Check paths or download whisper.cpp.'
    };
}

export async function testWhisperSetup(): Promise<{ ok: boolean; message: string }> {
    const status = await getWhisperStatus();
    if (!status.binaryPath) {
        return { ok: false, message: 'Set the whisper.cpp CLI path first (whisper-cli or main.exe).' };
    }
    if (!status.binaryExists) {
        return { ok: false, message: `Binary not found: ${status.binaryPath}` };
    }
    if (!status.modelPath) {
        return { ok: false, message: 'Set a GGML/GGUF model path (e.g. ggml-small.en.bin).' };
    }
    if (!status.modelExists) {
        return { ok: false, message: `Model not found: ${status.modelPath}` };
    }

    try {
        await execFileAsync(status.binaryPath, ['--help'], { timeout: 15_000, windowsHide: true });
        return { ok: true, message: 'Whisper CLI responds. Local STT is ready when provider is Auto or Local whisper.' };
    } catch {
        try {
            await execFileAsync(status.binaryPath, ['-h'], { timeout: 15_000, windowsHide: true });
            return { ok: true, message: 'Whisper CLI responds. Local STT is ready when provider is Auto or Local whisper.' };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { ok: false, message: `Binary exists but test failed: ${msg}` };
        }
    }
}

async function pathExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function findBinaryOnPath(): string | undefined {
    const names =
        process.platform === 'win32'
            ? ['whisper-cli.exe', 'main.exe', 'whisper.exe']
            : ['whisper-cli', 'main', 'whisper'];
    const cmd = process.platform === 'win32' ? 'where' : 'which';

    for (const name of names) {
        try {
            const out = execSync(`${cmd} ${name}`, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
                windowsHide: true
            }).trim();
            const first = out.split(/\r?\n/).find((line) => line.trim());
            if (first && fs.existsSync(first)) {
                return first;
            }
        } catch {
            /* try next name */
        }
    }
    return undefined;
}

function findBinaryInCommonDirs(): string | undefined {
    const candidates: string[] = [];
    const home = os.homedir();
    const localApp = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');

    candidates.push(
        path.join(localApp, 'whisper.cpp'),
        path.join(home, 'whisper.cpp'),
        path.join(home, 'whisper.cpp', 'build', 'bin'),
        path.join(home, 'tools', 'whisper.cpp')
    );

    const binaryNames =
        process.platform === 'win32'
            ? ['whisper-cli.exe', 'main.exe', 'Release', 'whisper-cli.exe']
            : ['whisper-cli', 'main'];

    for (const dir of candidates) {
        for (const name of binaryNames) {
            const full = path.join(dir, name);
            if (name === 'Release' && process.platform === 'win32') {
                for (const exe of ['whisper-cli.exe', 'main.exe']) {
                    const releasePath = path.join(full, exe);
                    if (fs.existsSync(releasePath)) {
                        return releasePath;
                    }
                }
            } else if (fs.existsSync(full)) {
                return full;
            }
        }
    }
    return undefined;
}

function findModelNear(binaryPath: string): string | undefined {
    const dirs = new Set<string>([
        path.dirname(binaryPath),
        path.join(path.dirname(binaryPath), '..', 'models'),
        path.join(path.dirname(binaryPath), 'models')
    ]);

    for (const dir of dirs) {
        const model = pickModelInDir(dir);
        if (model) {
            return model;
        }
    }
    return undefined;
}

function findModelInCommonDirs(): string | undefined {
    const home = os.homedir();
    const dirs = [
        path.join(home, 'whisper.cpp', 'models'),
        path.join(home, 'Downloads'),
        path.join(process.env.LOCALAPPDATA ?? '', 'whisper.cpp', 'models')
    ].filter(Boolean);

    for (const dir of dirs) {
        const model = pickModelInDir(dir);
        if (model) {
            return model;
        }
    }
    return undefined;
}

function pickModelInDir(dir: string): string | undefined {
    try {
        const files = fs.readdirSync(dir);
        const models = files.filter((f) => /\.(bin|gguf)$/i.test(f));
        const preferred = models.find((f) => /small\.en/i.test(f)) ?? models.find((f) => /small/i.test(f));
        if (preferred) {
            return path.join(dir, preferred);
        }
        if (models[0]) {
            return path.join(dir, models[0]);
        }
    } catch {
        /* missing dir */
    }
    return undefined;
}
