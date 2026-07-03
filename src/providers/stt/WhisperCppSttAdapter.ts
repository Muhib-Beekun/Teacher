import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { VoiceSessionContext } from '../../context/VoiceSessionContext';
import { SttProvider } from './types';

const execFileAsync = promisify(execFile);

export class WhisperCppSttAdapter implements SttProvider {
    readonly id = 'whisper';

    constructor(private readonly output: vscode.OutputChannel) { }

    async isAvailable(): Promise<boolean> {
        const binary = this.getBinaryPath();
        const model = this.getModelPath();
        if (!binary || !model) {
            return false;
        }
        try {
            await fs.access(binary);
            await fs.access(model);
            return true;
        } catch {
            return false;
        }
    }

    async transcribe(audio: Buffer, mimeType: string, ctx: VoiceSessionContext): Promise<string> {
        const binary = this.getBinaryPath();
        const model = this.getModelPath();
        if (!binary || !model) {
            throw new Error('Whisper.cpp binary or model path not configured.');
        }

        const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('wav') ? 'wav' : 'bin';
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-stt-'));
        const audioPath = path.join(tmpDir, `chunk.${ext}`);
        const outBase = path.join(tmpDir, 'out');

        try {
            await fs.writeFile(audioPath, audio);
            const promptFlag = ctx.stt_prompt ? ['--prompt', ctx.stt_prompt.slice(0, 800)] : [];
            const args = ['-m', model, '-f', audioPath, '-otxt', '-of', outBase, ...promptFlag];

            this.output.appendLine(`[stt:whisper] transcribing ${audio.length} bytes`);
            await execFileAsync(binary, args, { timeout: 120_000, windowsHide: true });

            const txtPath = `${outBase}.txt`;
            const text = (await fs.readFile(txtPath, 'utf8')).trim();
            if (!text) {
                throw new Error('Whisper returned empty transcript.');
            }
            return text;
        } finally {
            await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
        }
    }

    private getBinaryPath(): string | undefined {
        const configured = vscode.workspace.getConfiguration('teacher.stt.whisper').get<string>('binaryPath', '');
        return configured.trim() || undefined;
    }

    private getModelPath(): string | undefined {
        const model = vscode.workspace.getConfiguration('teacher.stt.whisper').get<string>('modelPath', '');
        return model.trim() || undefined;
    }
}
