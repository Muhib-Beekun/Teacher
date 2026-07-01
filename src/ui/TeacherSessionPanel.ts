import * as vscode from 'vscode';
import { CompileMode } from '../compiler/TeacherCompiler';
import { VoiceSessionContext } from '../context/VoiceSessionContext';
import { SendResult } from '../insert/InsertRouter';
import { CompileService } from '../providers/compile/CompileService';
import { SttService } from '../providers/stt/SttService';
import { TranscriptResult } from '../providers/stt/types';
import { SessionManager } from '../session/SessionManager';

export interface SessionPanelDeps {
    getVoiceContext: () => VoiceSessionContext;
    rebuildContext: (recentUtterance?: string) => Promise<void>;
    sendBrief: (text: string) => Promise<SendResult>;
    sttService: SttService;
    compileService: CompileService;
    openSidecarMic: () => Promise<void>;
}

export class TeacherSessionPanel {
    private static readonly viewType = 'teacher.sessionPanel';

    private panel: vscode.WebviewPanel | undefined;
    private readonly session = new SessionManager();
    private htmlInitialized = false;
    private sttProviderLabel = 'auto';

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly deps: SessionPanelDeps
    ) { }

    public async startSession(): Promise<void> {
        this.sttProviderLabel = await this.deps.sttService.resolveProviderId();

        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                TeacherSessionPanel.viewType,
                'Teacher Session',
                vscode.ViewColumn.Beside,
                { enableScripts: true, retainContextWhenHidden: true }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.htmlInitialized = false;
            }, null, this.context.subscriptions);

            this.panel.webview.onDidReceiveMessage(
                (message) => this.handleMessage(message),
                null,
                this.context.subscriptions
            );
        }

        this.panel.title = 'Teacher Session';
        this.panel.reveal(vscode.ViewColumn.Beside, true);

        if (!this.htmlInitialized) {
            this.panel.webview.html = this.renderShellHtml();
            this.htmlInitialized = true;
        }

        await this.pushContentUpdate();
    }

    public async appendSegment(text: string): Promise<void> {
        const result = this.deps.sttService.processWebSpeechText(text, this.deps.getVoiceContext());
        await this.appendTranscript(result);
    }

    public async forceCompile(): Promise<void> {
        await this.session.compile(this.deps.getVoiceContext, this.getCompileMode(), this.deps.compileService);
        await this.pushContentUpdate();
    }

    public sendCompiledBrief(): string {
        if (this.session.isEmpty()) {
            return '';
        }
        return this.session.getCompiledMarkdown();
    }

    public async sendToAgent(): Promise<SendResult | undefined> {
        const brief = this.sendCompiledBrief();
        if (!brief) {
            return undefined;
        }
        return this.deps.sendBrief(brief);
    }

    public endSession(): void {
        this.session.reset();
        this.panel?.dispose();
        this.panel = undefined;
        this.htmlInitialized = false;
    }

    private async appendTranscript(result: TranscriptResult): Promise<void> {
        await this.startSession();
        await this.deps.rebuildContext(result.text);
        this.session.appendSegment(result.text, result.textRaw, result.fixes);
        await this.maybeCompile();
        await this.pushContentUpdate('Ready — open mic in browser to add more.');
    }

    private async handleMessage(message: {
        command: string;
        text?: string;
        audioBase64?: string;
        mimeType?: string;
        status?: string;
    }): Promise<void> {
        switch (message.command) {
            case 'segmentFinal':
                if (message.text?.trim()) {
                    const result = this.deps.sttService.processWebSpeechText(
                        message.text.trim(),
                        this.deps.getVoiceContext()
                    );
                    await this.appendTranscript(result);
                }
                break;
            case 'openSidecarMic':
                await this.deps.openSidecarMic();
                break;
            case 'audioChunk':
                if (message.audioBase64) {
                    await this.handleAudioChunk(message.audioBase64, message.mimeType ?? 'audio/webm');
                }
                break;
            case 'typeSegment':
                await vscode.commands.executeCommand('teacher.appendSegment');
                break;
            case 'compiledEdit':
                if (message.text !== undefined) {
                    this.session.setCompiledOverride(message.text);
                }
                break;
            case 'send':
                await vscode.commands.executeCommand('teacher.send');
                break;
            case 'panelStatus':
                break;
            default:
                break;
        }
    }

    public async handleSidecarAudio(buffer: Buffer, mimeType: string): Promise<void> {
        await this.handleAudioChunk(buffer.toString('base64'), mimeType);
    }

    public async notifySidecarOpened(): Promise<void> {
        await this.pushContentUpdate('Mic open in browser — speak there, then Send chunk to Teacher.');
    }

    private async handleAudioChunk(base64: string, mimeType: string): Promise<void> {
        try {
            await this.pushContentUpdate('Transcribing…');
            const buffer = Buffer.from(base64, 'base64');
            const result = await this.deps.sttService.transcribeAudio(
                buffer,
                mimeType,
                this.deps.getVoiceContext()
            );
            await this.appendTranscript(result);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Teacher STT failed: ${msg}`);
            await this.pushContentUpdate(`STT error: ${msg}`);
        }
    }

    private async maybeCompile(): Promise<void> {
        const live = vscode.workspace.getConfiguration().get<boolean>('teacher.compile.live', true);
        if (live) {
            await this.session.compile(this.deps.getVoiceContext, this.getCompileMode(), this.deps.compileService);
        }
    }

    private getCompileMode(): CompileMode {
        return vscode.workspace.getConfiguration().get<CompileMode>('teacher.compile.mode', 'teacher');
    }

    private async pushContentUpdate(status?: string): Promise<void> {
        if (!this.panel) {
            return;
        }

        const mode = this.getCompileMode();
        if (!this.session.isEmpty()) {
            await this.session.compile(this.deps.getVoiceContext, mode, this.deps.compileService);
        }

        this.panel.webview.postMessage({
            command: 'update',
            transcriptHtml: this.session.formatTranscriptHtml(),
            compiled: this.session.isEmpty()
                ? 'Speak or type to scaffold your agent prompt.'
                : this.session.getCompiledMarkdown(),
            sttProvider: this.sttProviderLabel,
            status
        });
    }

    private renderShellHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Teacher Session</title>
  <style>
    :root {
      --bg: #14151d; --panel: #1e212b; --surface: #262a37; --ink: #e8eaef;
      --muted: #8b93a7; --accent: #6b8aff; --ok: #43d6a4; --warn: #efc14e; --line: #3a4052;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); min-height: 100vh; display: grid; grid-template-rows: auto auto auto 1fr; }
    .toolbar { padding: 10px 12px; border-bottom: 1px solid var(--line); display: flex; gap: 8px; align-items: center; background: var(--panel); flex-wrap: wrap; }
    .toolbar button { border: 1px solid var(--line); background: var(--surface); color: var(--ink); padding: 7px 12px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; }
    .toolbar button.primary { background: linear-gradient(120deg, var(--accent), #5d55f0); border-color: transparent; color: #fff; }
    .mic-btn { width: 40px; height: 40px; padding: 0; border-radius: 12px; font-size: 18px; display: flex; align-items: center; justify-content: center; }
    .mic-btn.active { background: rgba(107,138,255,.2); border-color: var(--accent); box-shadow: 0 0 0 2px rgba(107,138,255,.25); }
    .status { margin-left: auto; font-size: 11px; color: var(--muted); max-width: 50%; text-align: right; line-height: 1.35; }
    .provider { font-size: 10px; color: var(--accent); padding: 0 12px 4px; }
    .interim { font-size: 11px; color: var(--accent); padding: 0 12px 8px; font-style: italic; min-height: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 10px; min-height: 0; }
    .pane { border: 1px solid var(--line); background: var(--panel); border-radius: 12px; min-height: 0; display: grid; grid-template-rows: auto 1fr; overflow: hidden; }
    .pane h2 { margin: 0; padding: 8px 12px; border-bottom: 1px solid var(--line); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
    .pane-body { overflow: auto; padding: 10px; min-height: 0; }
    .empty { color: var(--muted); font-size: 12px; margin: 0; }
    .seg { margin-bottom: 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
    .seg summary { cursor: pointer; padding: 8px 10px; list-style: none; display: flex; gap: 8px; align-items: baseline; font-size: 12px; }
    .seg summary::-webkit-details-marker { display: none; }
    .seg-num { color: var(--muted); font-weight: 700; flex: none; }
    .seg-label { font-size: 9px; font-weight: 800; text-transform: uppercase; padding: 2px 6px; border-radius: 999px; flex: none; }
    .tag-included { background: rgba(67,214,164,.12); color: var(--ok); }
    .tag-correction { background: rgba(107,138,255,.15); color: var(--accent); }
    .tag-superseded { background: rgba(239,193,78,.12); color: var(--warn); }
    .seg-preview { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .seg-body { padding: 0 10px 10px; font-size: 12px; line-height: 1.55; white-space: pre-wrap; }
    .fix-banner { font-size: 10px; color: var(--warn); background: rgba(239,193,78,.1); border: 1px solid rgba(239,193,78,.25); border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; }
    .fix-word { background: rgba(239,193,78,.2); border-bottom: 2px solid var(--warn); cursor: pointer; padding: 0 2px; }
    .compiled { width: 100%; height: 100%; min-height: 280px; border: none; background: transparent; color: var(--ink); font-family: Consolas, monospace; font-size: 12px; line-height: 1.45; resize: none; padding: 0; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="mic" class="mic-btn" title="Open mic in browser">🎤</button>
    <button id="type">Type</button>
    <button id="send" class="primary">Send to Agent</button>
    <div class="status" id="status">Session open · chat untouched until Send</div>
  </div>
  <div class="provider" id="provider">Mic runs in Chrome/Edge (Cursor blocks in-panel mic) · STT: …</div>
  <div class="interim" id="interim"></div>
  <div class="grid">
    <section class="pane"><h2>Your Words</h2><div class="pane-body" id="transcript"><p class="empty">Session ready.</p></div></section>
    <section class="pane"><h2>Agent Prompt</h2><div class="pane-body"><textarea class="compiled" id="compiled"></textarea></div></section>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const micBtn = document.getElementById('mic');
    const statusEl = document.getElementById('status');
    const interimEl = document.getElementById('interim');
    const providerEl = document.getElementById('provider');
    const compiledEl = document.getElementById('compiled');
    const transcriptEl = document.getElementById('transcript');
    let compiledDirty = false;

    compiledEl.addEventListener('input', () => {
      compiledDirty = true;
      vscode.postMessage({ command: 'compiledEdit', text: compiledEl.value });
    });

    document.getElementById('type').addEventListener('click', () => vscode.postMessage({ command: 'typeSegment' }));
    document.getElementById('send').addEventListener('click', () => vscode.postMessage({ command: 'send' }));
    document.getElementById('mic').addEventListener('click', () => vscode.postMessage({ command: 'openSidecarMic' }));

    transcriptEl.addEventListener('click', (e) => {
      const el = e.target.closest('.fix-word');
      if (!el) return;
      const heard = el.dataset.heard || '?';
      alert('Heard: "' + heard + '"\\nUsing: "' + el.textContent + '"');
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command !== 'update') return;
      if (msg.transcriptHtml) transcriptEl.innerHTML = msg.transcriptHtml;
      if (msg.compiled !== undefined && !compiledDirty) compiledEl.value = msg.compiled;
      if (msg.sttProvider) providerEl.textContent = 'Mic: Chrome/Edge sidecar · STT: ' + msg.sttProvider;
      if (msg.status) statusEl.textContent = msg.status;
    });
  </script>
</body>
</html>`;
    }
}
