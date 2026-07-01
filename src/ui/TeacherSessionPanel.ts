import * as vscode from 'vscode';
import { SendResult } from '../insert/InsertRouter';
import { CompileService } from '../providers/compile/CompileService';
import { SttService } from '../providers/stt/SttService';
import { BrowserSessionBridge } from '../web/BrowserSessionBridge';

export interface SessionPanelDeps {
    bridge: BrowserSessionBridge;
    sendBrief: (text: string) => Promise<SendResult>;
    sttService: SttService;
    compileService: CompileService;
    openWebUi: () => Promise<void>;
}

export class TeacherSessionPanel {
    private static readonly viewType = 'teacher.sessionPanel';

    private panel: vscode.WebviewPanel | undefined;
    private htmlInitialized = false;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly deps: SessionPanelDeps
    ) { }

    public async startSession(): Promise<void> {
        await this.deps.bridge.refreshProviderLabel();

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

        await this.refreshFromBridge();
    }

    public async appendSegment(text: string): Promise<void> {
        await this.deps.bridge.appendSegment(text);
        await this.startSession();
        await this.refreshFromBridge('Segment added.');
    }

    public async forceCompile(): Promise<void> {
        await this.deps.bridge.forceCompile();
        await this.refreshFromBridge('Re-scaffolded.');
    }

    public sendCompiledBrief(): string {
        if (this.deps.bridge.isEmpty()) {
            return '';
        }
        return this.deps.bridge.getCompiledMarkdown();
    }

    public async sendToAgent(source: 'brief' | 'words' = 'brief', briefVersion?: number): Promise<SendResult | undefined> {
        const brief =
            source === 'words'
                ? this.deps.bridge.getTranscriptPlainText().trim()
                : this.deps.bridge.getCompiledMarkdown(briefVersion);
        if (!brief) {
            return undefined;
        }
        return this.deps.sendBrief(brief);
    }

    public endSession(): void {
        this.deps.bridge.reset();
        this.panel?.dispose();
        this.panel = undefined;
        this.htmlInitialized = false;
    }

    public async refreshFromBridge(status?: string): Promise<void> {
        await this.pushContentUpdate(status);
    }

    public async notifyWebUiOpened(url: string): Promise<void> {
        await this.pushContentUpdate(`Web UI open at ${url} — speak there, copy brief into Cursor.`);
    }

    private async handleMessage(message: {
        command: string;
        text?: string;
    }): Promise<void> {
        switch (message.command) {
            case 'openWebUi':
                await this.deps.openWebUi();
                break;
            case 'typeSegment':
                await vscode.commands.executeCommand('teacher.appendSegment');
                break;
            case 'compiledEdit':
                break;
            case 'send':
                await vscode.commands.executeCommand('teacher.send');
                break;
            default:
                break;
        }
    }

    private async pushContentUpdate(status?: string): Promise<void> {
        if (!this.panel) {
            return;
        }

        const snapshot = this.deps.bridge.getSnapshot(status);

        this.panel.webview.postMessage({
            command: 'update',
            transcriptHtml: snapshot.transcriptHtml,
            compiled: snapshot.compiled,
            sttLabel: snapshot.sttLabel,
            status: snapshot.status
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
      --muted: #8b93a7; --accent: #6b8aff; --ok: #43d6a4; --line: #3a4052;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); min-height: 100vh; display: grid; grid-template-rows: auto 1fr; place-items: center; padding: 24px; }
    .card { max-width: 420px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 24px; text-align: center; }
    h1 { margin: 0 0 8px; font-size: 18px; }
    p { margin: 0 0 16px; color: var(--muted); font-size: 13px; line-height: 1.5; }
    button { border: none; border-radius: 10px; padding: 10px 16px; font-weight: 700; cursor: pointer; width: 100%; margin-bottom: 8px; background: linear-gradient(120deg, var(--accent), #5d55f0); color: #fff; }
    .hint { font-size: 11px; color: var(--muted); margin-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Teacher runs in your browser</h1>
    <p>Mic and session UI live at <b>http://127.0.0.1:3721</b> (starts when the extension activates). Use the web UI to speak, scaffold your brief, and copy into Cursor.</p>
    <button id="open">Open Teacher Web UI</button>
    <p class="hint">This panel mirrors session state from the browser. Send to Agent still works from the command palette.</p>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('open').addEventListener('click', () => vscode.postMessage({ command: 'openWebUi' }));
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'update' && msg.status) {
        document.querySelector('.hint').textContent = msg.status;
      }
    });
  </script>
</body>
</html>`;
    }
}
