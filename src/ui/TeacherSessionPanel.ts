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
}

export class TeacherSessionPanel {
    private static readonly viewType = 'teacher.sessionPanel';

    private panel: vscode.WebviewPanel | undefined;
    private readonly session = new SessionManager();
    private liveInterim = '';
    private micActive = false;
    private sttMode: 'webspeech' | 'recorder' = 'webspeech';
    private sttProviderLabel = 'webspeech';

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly deps: SessionPanelDeps
    ) { }

    public async startSession(): Promise<void> {
        this.sttMode = await this.deps.sttService.resolveRecorderMode();
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
                this.micActive = false;
            }, null, this.context.subscriptions);

            this.panel.webview.onDidReceiveMessage(
                (message) => this.handleMessage(message),
                null,
                this.context.subscriptions
            );
        }

        this.panel.title = 'Teacher Session';
        this.panel.reveal(vscode.ViewColumn.Beside, true);
        await this.refreshWebview();
    }

    public async appendSegment(text: string): Promise<void> {
        const result = this.deps.sttService.processWebSpeechText(text, this.deps.getVoiceContext());
        await this.appendTranscript(result);
    }

    public async forceCompile(): Promise<void> {
        await this.session.compile(this.deps.getVoiceContext, this.getCompileMode(), this.deps.compileService);
        await this.refreshWebview();
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
        this.liveInterim = '';
        this.panel?.dispose();
        this.panel = undefined;
    }

    private async appendTranscript(result: TranscriptResult): Promise<void> {
        await this.startSession();
        await this.deps.rebuildContext(result.text);
        this.session.appendSegment(result.text, result.textRaw, result.fixes);
        await this.maybeCompile();
        await this.refreshWebview();
    }

    private async handleMessage(message: {
        command: string;
        text?: string;
        audioBase64?: string;
        mimeType?: string;
    }): Promise<void> {
        switch (message.command) {
            case 'micStart':
                this.micActive = true;
                this.liveInterim = 'Listening…';
                this.postState();
                break;
            case 'micStop':
                this.micActive = false;
                this.liveInterim = '';
                this.postState();
                break;
            case 'micInterim':
                this.liveInterim = message.text ?? '';
                this.postState();
                break;
            case 'segmentFinal':
                if (message.text?.trim()) {
                    const result = this.deps.sttService.processWebSpeechText(
                        message.text.trim(),
                        this.deps.getVoiceContext()
                    );
                    await this.appendTranscript(result);
                }
                this.liveInterim = '';
                break;
            case 'audioChunk':
                if (message.audioBase64) {
                    await this.handleAudioChunk(message.audioBase64, message.mimeType ?? 'audio/webm');
                }
                this.liveInterim = '';
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
            default:
                break;
        }
    }

    private async handleAudioChunk(base64: string, mimeType: string): Promise<void> {
        try {
            this.liveInterim = 'Transcribing…';
            this.postState();
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

    private postState(): void {
        this.panel?.webview.postMessage({
            command: 'state',
            micActive: this.micActive,
            interim: this.liveInterim
        });
    }

    private async refreshWebview(): Promise<void> {
        if (!this.panel) {
            return;
        }

        const mode = this.getCompileMode();
        if (!this.session.isEmpty()) {
            await this.session.compile(this.deps.getVoiceContext, mode, this.deps.compileService);
        }

        const transcriptHtml = this.session.formatTranscriptHtml();
        const compiled = this.session.isEmpty()
            ? 'Speak or type to scaffold your agent prompt.'
            : this.session.getCompiledMarkdown();

        this.panel.webview.html = this.renderHtml(
            transcriptHtml,
            compiled,
            this.liveInterim,
            this.micActive,
            this.sttMode,
            this.sttProviderLabel
        );
    }

    private renderHtml(
        transcriptHtml: string,
        compiled: string,
        interim: string,
        micActive: boolean,
        sttMode: string,
        sttProvider: string
    ): string {
        const compiledEscaped = this.escapeHtml(compiled);
        const interimEscaped = this.escapeHtml(interim);
        const micClass = micActive ? 'mic-btn active' : 'mic-btn';

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
    body { margin: 0; font-family: "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); min-height: 100vh; display: grid; grid-template-rows: auto auto 1fr; }
    .toolbar { padding: 10px 12px; border-bottom: 1px solid var(--line); display: flex; gap: 8px; align-items: center; background: var(--panel); flex-wrap: wrap; }
    .toolbar button { border: 1px solid var(--line); background: var(--surface); color: var(--ink); padding: 7px 12px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12px; }
    .toolbar button.primary { background: linear-gradient(120deg, var(--accent), #5d55f0); border-color: transparent; color: #fff; }
    .mic-btn { width: 40px; height: 40px; padding: 0; border-radius: 12px; font-size: 18px; display: flex; align-items: center; justify-content: center; }
    .mic-btn.active { background: rgba(107,138,255,.2); border-color: var(--accent); box-shadow: 0 0 0 2px rgba(107,138,255,.25); }
    .status { margin-left: auto; font-size: 11px; color: var(--muted); max-width: 50%; text-align: right; line-height: 1.35; }
    .provider { font-size: 10px; color: var(--accent); padding: 0 12px 6px; }
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
    .seg-body { padding: 0 10px 10px; font-size: 12px; line-height: 1.55; color: var(--ink); white-space: pre-wrap; }
    .fix-banner { font-size: 10px; color: var(--warn); background: rgba(239,193,78,.1); border: 1px solid rgba(239,193,78,.25); border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; }
    .fix-word { background: rgba(239,193,78,.2); border-bottom: 2px solid var(--warn); cursor: pointer; padding: 0 2px; border-radius: 2px; }
    .fix-word.open { background: rgba(239,193,78,.35); }
    .fix-pop { display: block; font-size: 10px; color: var(--warn); margin-top: 2px; }
    .compiled { width: 100%; height: 100%; min-height: 280px; border: none; background: transparent; color: var(--ink); font-family: Consolas, monospace; font-size: 12px; line-height: 1.45; resize: none; padding: 0; }
    .interim { font-size: 11px; color: var(--accent); padding: 0 12px 8px; font-style: italic; min-height: 16px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="mic" class="${micClass}" title="Toggle mic">🎤</button>
    <button id="type">Type</button>
    <button id="send" class="primary">Send to Agent</button>
    <div class="status" id="status">${micActive ? 'Listening…' : 'Session open · chat untouched until Send'}</div>
  </div>
  <div class="provider">STT: ${this.escapeHtml(sttProvider)} · Compile: auto (Ollama if running, else rules)</div>
  <div class="interim" id="interim">${interimEscaped}</div>
  <div class="grid">
    <section class="pane"><h2>Your Words</h2><div class="pane-body" id="transcript">${transcriptHtml}</div></section>
    <section class="pane"><h2>Agent Prompt</h2><div class="pane-body"><textarea class="compiled" id="compiled">${compiledEscaped}</textarea></div></section>
  </div>
  <script>
    const STT_MODE = ${JSON.stringify(sttMode)};
    const vscode = acquireVsCodeApi();
    const micBtn = document.getElementById('mic');
    const statusEl = document.getElementById('status');
    const interimEl = document.getElementById('interim');
    const compiledEl = document.getElementById('compiled');
    let recognition = null;
    let micActive = false;
    let mediaRecorder = null;
    let mediaStream = null;
    let audioChunks = [];

    compiledEl.addEventListener('input', () => vscode.postMessage({ command: 'compiledEdit', text: compiledEl.value }));
    document.getElementById('type').addEventListener('click', () => vscode.postMessage({ command: 'typeSegment' }));
    document.getElementById('send').addEventListener('click', () => vscode.postMessage({ command: 'send' }));

    document.getElementById('transcript').addEventListener('click', (e) => {
      const el = e.target.closest('.fix-word');
      if (!el) return;
      document.querySelectorAll('.fix-word.open').forEach(n => { n.classList.remove('open'); n.querySelector('.fix-pop')?.remove(); });
      el.classList.add('open');
      const pop = document.createElement('span');
      pop.className = 'fix-pop';
      pop.textContent = '↓ heard "' + (el.dataset.heard || '?') + '" · tap again to dismiss';
      el.after(pop);
      el.addEventListener('click', (ev) => { ev.stopPropagation(); el.classList.toggle('open'); pop.remove(); }, { once: true });
    });

    function getRecognition() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return null;
      const r = new SR();
      r.continuous = true; r.interimResults = true; r.lang = 'en-US';
      r.onstart = () => vscode.postMessage({ command: 'micStart' });
      r.onend = () => { if (micActive) { try { r.start(); } catch (_) {} } else vscode.postMessage({ command: 'micStop' }); };
      r.onresult = (event) => {
        let interim = '', finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) finalText += res[0].transcript; else interim += res[0].transcript;
        }
        if (interim) { interimEl.textContent = interim; vscode.postMessage({ command: 'micInterim', text: interim }); }
        if (finalText.trim()) { interimEl.textContent = ''; vscode.postMessage({ command: 'segmentFinal', text: finalText.trim() }); }
      };
      r.onerror = (e) => { statusEl.textContent = 'Mic error: ' + (e.error || 'unknown'); stopMic(); };
      return r;
    }

    async function startRecorder() {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(mediaStream);
      mediaRecorder.ondataavailable = (e) => { if (e.data.size) audioChunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        vscode.postMessage({ command: 'audioChunk', audioBase64: btoa(binary), mimeType: blob.type });
        audioChunks = [];
      };
      mediaRecorder.start();
      vscode.postMessage({ command: 'micStart' });
    }

    function stopRecorder() {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      mediaStream?.getTracks().forEach(t => t.stop());
      mediaStream = null;
      vscode.postMessage({ command: 'micStop' });
    }

    async function startMic() {
      micActive = true;
      micBtn.classList.add('active');
      statusEl.textContent = 'Listening… click mic to pause (session stays open).';
      if (STT_MODE === 'recorder') {
        try { await startRecorder(); } catch (e) { statusEl.textContent = 'Mic permission denied.'; micActive = false; micBtn.classList.remove('active'); }
      } else {
        if (!recognition) recognition = getRecognition();
        if (!recognition) { statusEl.textContent = 'Web Speech unavailable — configure whisper or Deepgram.'; micActive = false; micBtn.classList.remove('active'); return; }
        try { recognition.start(); } catch (_) {}
      }
    }

    function stopMic() {
      micActive = false;
      micBtn.classList.remove('active');
      statusEl.textContent = 'Paused — click mic to add more.';
      interimEl.textContent = '';
      if (STT_MODE === 'recorder') stopRecorder();
      else if (recognition) try { recognition.stop(); } catch (_) {}
    }

    function toggleMic() { micActive ? stopMic() : startMic(); }
    micBtn.addEventListener('click', toggleMic);

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'state') {
        if (msg.interim) interimEl.textContent = msg.interim;
        if (msg.micActive) micBtn.classList.add('active'); else micBtn.classList.remove('active');
      }
    });
  </script>
</body>
</html>`;
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
