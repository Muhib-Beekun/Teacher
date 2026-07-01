import * as vscode from 'vscode';
import { VoiceSessionContext } from '../context/VoiceSessionContext';

export class TeacherSessionPanel {
    private static readonly viewType = 'teacher.sessionPanel';

    private panel: vscode.WebviewPanel | undefined;
    private readonly segments: string[] = [];
    private compiledBrief = '';

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly getVoiceContext: () => VoiceSessionContext
    ) { }

    public startSession(): void {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                TeacherSessionPanel.viewType,
                'Teacher Session',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null, this.context.subscriptions);

            this.panel.webview.onDidReceiveMessage(async (message: { command: string }) => {
                switch (message.command) {
                    case 'appendSegment':
                        await vscode.commands.executeCommand('teacher.appendSegment');
                        break;
                    case 'send':
                        await vscode.commands.executeCommand('teacher.send');
                        break;
                    default:
                        break;
                }
            }, null, this.context.subscriptions);
        }

        this.panel.title = 'Teacher Session';
        this.panel.reveal(vscode.ViewColumn.Beside, true);
        this.refreshWebview();
    }

    public appendSegment(segment: string): void {
        this.segments.push(segment);

        const liveCompile = vscode.workspace.getConfiguration().get<boolean>('teacher.compile.live', true);
        if (liveCompile) {
            this.forceCompile();
        }

        this.refreshWebview();
    }

    public forceCompile(): void {
        this.compiledBrief = this.compileTemplate();
        this.refreshWebview();
    }

    public sendCompiledBrief(): string {
        if (this.segments.length === 0) {
            return '';
        }

        if (!this.compiledBrief) {
            this.compiledBrief = this.compileTemplate();
        }

        return this.compiledBrief;
    }

    public endSession(): void {
        this.panel?.dispose();
        this.panel = undefined;
    }

    private compileTemplate(): string {
        const latest = this.segments[this.segments.length - 1] ?? 'No segment yet.';
        const voiceContext = this.getVoiceContext();
        const targetLines = this.formatTargetSection(voiceContext);
        const contextHint = this.formatContextHint(voiceContext);

        return [
            '## Goal',
            latest,
            '',
            '## Target',
            ...targetLines,
            '',
            '## Constraints',
            '- [placeholder] Derived from spoken corrections and retractions',
            ...(contextHint ? [contextHint] : []),
            '',
            '## Verification',
            '- [placeholder] Define how done is verified',
            '',
            '---',
            '**Reference only (superseded - do not implement unless asked again)**',
            '- [placeholder] No superseded items detected yet'
        ].join('\n');
    }

    private formatTargetSection(ctx: VoiceSessionContext): string[] {
        if (!ctx.targetFiles.length) {
            return ['- (no workspace targets indexed yet — run Teacher: Rebuild Context Index)'];
        }
        return ctx.targetFiles.slice(0, 8).map((file) => `- \`${file}\``);
    }

    private formatContextHint(ctx: VoiceSessionContext): string {
        if (!ctx.dictionary_context.length) {
            return '';
        }
        const sample = ctx.dictionary_context.slice(0, 12).join(', ');
        return `- Workspace vocabulary (${ctx.dictionary_context.length} terms): ${sample}${ctx.dictionary_context.length > 12 ? '…' : ''}`;
    }

    private refreshWebview(): void {
        if (!this.panel) {
            return;
        }

        const transcript = this.segments.length
            ? this.segments.map((segment, index) => `${index + 1}. ${segment}`).join('\n')
            : 'Teacher session ready. Append a segment to begin.';

        const compiled = this.compiledBrief || this.compileTemplate();
        this.panel.webview.html = this.renderHtml(transcript, compiled);
    }

    private renderHtml(transcript: string, compiled: string): string {
        const transcriptEscaped = this.escapeHtml(transcript);
        const compiledEscaped = this.escapeHtml(compiled);

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Teacher Session</title>
  <style>
    :root {
      --bg: #f4f1e8;
      --panel: #fffaf0;
      --ink: #211d18;
      --muted: #6b6258;
      --accent: #0f766e;
      --accent-2: #b45309;
      --line: #dfd5c4;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: "Segoe UI", "Trebuchet MS", sans-serif;
      color: var(--ink);
      background: radial-gradient(circle at top right, #fdf4d7 0, var(--bg) 45%), var(--bg);
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
    }

    .toolbar {
      padding: 12px;
      border-bottom: 1px solid var(--line);
      display: flex;
      gap: 8px;
      align-items: center;
      background: color-mix(in srgb, var(--panel) 92%, white 8%);
    }

    .toolbar button {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--ink);
      padding: 7px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: transform 120ms ease, border-color 120ms ease;
      font-weight: 600;
    }

    .toolbar button.primary {
      background: var(--accent);
      color: #f8fff9;
      border-color: var(--accent);
    }

    .toolbar button:hover {
      transform: translateY(-1px);
      border-color: var(--accent-2);
    }

    .status {
      margin-left: auto;
      font-size: 12px;
      color: var(--muted);
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 12px;
      min-height: 0;
    }

    .pane {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 12px;
      min-height: 0;
      display: grid;
      grid-template-rows: auto 1fr;
      overflow: hidden;
    }

    .pane h2 {
      margin: 0;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      font-size: 13px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--muted);
    }

    pre {
      margin: 0;
      padding: 12px;
      overflow: auto;
      white-space: pre-wrap;
      line-height: 1.45;
      font-family: "Consolas", "Courier New", monospace;
      font-size: 12px;
      animation: reveal 180ms ease;
    }

    @keyframes reveal {
      from {
        opacity: 0;
        transform: translateY(2px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="append">Append Segment</button>
    <button id="send" class="primary">Send</button>
    <div class="status">Teacher session active. Chat box held until Send.</div>
  </div>

  <div class="grid">
    <section class="pane">
      <h2>Your Words</h2>
      <pre>${transcriptEscaped}</pre>
    </section>
    <section class="pane">
      <h2>Agent Prompt</h2>
      <pre>${compiledEscaped}</pre>
    </section>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('append').addEventListener('click', () => {
      vscode.postMessage({ command: 'appendSegment' });
    });
    document.getElementById('send').addEventListener('click', () => {
      vscode.postMessage({ command: 'send' });
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
