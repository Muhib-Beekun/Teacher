# Teacher setup guide

Single source of truth for **humans and AI agents** configuring Teacher after install.

## 1. Install

```powershell
cd C:\Users\Public\Projects\Teacher   # or your clone path
npm install
npm run package
```

In Cursor: **Extensions: Install from VSIX...** → latest `teacher-*.vsix` in the repo root → **Reload Window**.

See [INSTALL-CURSOR.md](./INSTALL-CURSOR.md) for troubleshooting.

## 2. Open your browser (required for microphone)

**Cursor cannot access the microphone** in its embedded webviews. Teacher runs a small local web server and you **must use Chrome or Microsoft Edge** for voice capture.

### Step by step

1. Open any project workspace in Cursor.
2. Press **`Ctrl+Shift+P`** and run **`Teacher: Open Web UI`** (or **`Teacher: Start Session`** then click **Open** in the panel).
3. Your **default browser** opens to a URL like **`http://127.0.0.1:3721/`** (port from `teacher.capture.sidecarPort`).
4. If the browser does not open automatically:
   - Open **Chrome** or **Edge** manually.
   - Paste the URL from the **Teacher** output channel (`View` → `Output` → **Teacher**), or copy it from the yellow box above the mic button in the web UI.
5. When the page asks for **microphone** permission, click **Allow**.
6. Tap the **mic** button, speak, tap again to pause — words land in **Your Words**; **Agent Prompt** re-scaffolds on the right after each pause. Edit a segment by hand and the refresh button glows until recompile.

**Bookmark the URL** in Chrome/Edge so you can return after reload. The extension must be running in Cursor (same workspace) for the page to work.

| Problem | Fix |
|---------|-----|
| Page won't load | Reload Cursor window; run **Teacher: Open Web UI** again |
| No mic prompt | Use Chrome or Edge (not Firefox/Safari for Web Speech) |
| Wrong port | Settings → Web UI port; reload extension |
| "Compiler not ready" | See § First run checklist — API key or Ollama |
| Remote SSH / WSL / dev container | vscode.lm (Copilot) often empty on remote — **configure cloud API key or Ollama on the remote host** (see § Known issues) |

## 3. First run checklist

| Step | Action |
|------|--------|
| 1 | Open any project workspace in Cursor |
| 2 | Command Palette → **Teacher: Start Session** (or **Teacher: Open Web UI**) |
| 3 | Click **Settings** in the web UI |
| 4 | Pick **Inference provider** preset (OpenAI default) or run **Ollama** locally |
| 5 | Save **Inference API key** (or copy `.env.example` → `.env`) |
| 6 | Set **Compile provider**: Auto / Cloud API / Local Ollama |
| 7 | Confirm **Compiler:** line shows ready (not "not configured") |
| 8 | Speak in Chrome/Edge at `http://127.0.0.1:<port>/` (see § Open your browser); review **Your Words** and **Agent Prompt** |

## 4. Two concepts (do not confuse)

### Inference provider (Connection)

**Which cloud API** to call when using cloud compile: base URL + model + API key.

Presets in Settings:

| Preset | Base URL | Default model |
|--------|----------|---------------|
| OpenAI (shipped default) | `https://api.openai.com/v1` | `gpt-4o-mini` |
| xAI Grok | `https://api.x.ai/v1` | `grok-4-fast-reasoning` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Custom | any OpenAI-compatible host | any model id |

**Grok ≠ Groq:** Grok is xAI. Groq is groq.com. STT may mishear "grock" — add terms to `.teacher/codewords.txt` if needed.

### Compile provider (Compile and send)

**What actually runs** compile and STT polish:

| Setting | Behavior |
|---------|----------|
| **Auto** (default) | Local Ollama if running → else cloud API if key set → else VS Code LM (Copilot in VS Code). **On remote hosts, Auto skips vscode-lm** unless `teacher.compile.vscodeLm.allowOnRemote` is true. |
| **Cloud API only** | Always cloud (uses Connection preset above) |
| **Local Ollama only** | Always Ollama (`teacher.inference.ollama.model`, default `qwen2.5-coder:14b`) |
| **VS Code LM** | Host models via `vscode.lm` (GitHub Copilot; VS Code only, not Cursor today). On remote SSH/WSL, Teacher may fall back to cloud/Ollama instead. |

The **Compiler:** status line shows the active backend, not just the preset.

### Known issue: remote workspaces need inference

When the extension host runs **remotely** (SSH, WSL, dev containers, Codespaces-style setups), `vscode.lm` can list Copilot models but return **empty text** for compile. Speech still lands in **Your Words**, but **Agent Prompt** will not compile until a real backend is available on the **remote** side:

1. **Cloud API** — `INFERENCE_API_KEY` (Settings UI, **Teacher: Set Inference API Key**, or workspace `.env`), with `teacher.compile.provider` set to **Auto** or **Cloud API**, or
2. **Ollama** — Ollama running on the remote machine (or reachable from it), with **Auto** or **Local Ollama**.

Optional: `teacher.compile.vscodeLm.allowOnRemote: true` only if you deliberately want Copilot on remote despite the empty-response risk. Check the **Teacher** output channel for `[compile:route]` and `[compile:fallback]` lines.

## 5. Configuration

**Preferred:** use the Teacher Settings UI or VS Code settings (`settings.json`). No `.env` file needed.

API key → **Teacher: Set Inference API Key** (SecretStorage, encrypted).
Base URL + model → **Teacher Settings UI** or `teacher.inference.llm.baseUrl` / `teacher.inference.llm.model` in `settings.json`.

**AI agents:** see [AGENTS.md](../AGENTS.md) for how to configure Teacher programmatically via VS Code settings without creating `.env` lock issues.

### Environment variables (optional, advanced)

Copy [`.env.example`](../.env.example) → `.env` in the workspace root (gitignored).

**Warning:** `INFERENCE_BASE_URL` and `INFERENCE_MODEL` in `.env` override VS Code settings and **lock** those fields in the Teacher Settings UI. Prefer VS Code settings unless you need `.env` for team config or remote SSH workspaces.

| Variable | Purpose |
|----------|---------|
| `INFERENCE_API_KEY` | Cloud API key (SecretStorage preferred) |
| `INFERENCE_BASE_URL` | OpenAI-compatible base — **locks Settings UI** |
| `INFERENCE_MODEL` | Model id — **locks Settings UI** |
| `OPENAI_API_KEY` | Alias → `INFERENCE_API_KEY` |
| `XAI_API_KEY` / `GROK_API_KEY` | xAI Grok aliases |
| `DEEPGRAM_API_KEY` | Optional cloud STT |
| `OLLAMA_HOST` | Optional Ollama URL |

## 6. Workspace glossary (STT)

Create or edit `.teacher/codewords.txt` (one term per line, gitignored):

```
Grok
Groq
Ollama
INFERENCE_API_KEY
```

Run **Teacher: Rebuild Context Index** after edits.

## 7. Updates and troubleshooting

Open VSX and VSIX installs **do not auto-update**. Use **Teacher: Check for Updates** or **Settings → Host & updates** in the web UI. To install: **Teacher: Update from Open VSX**, then **Reload Window**.

| Symptom | What to do |
|---------|------------|
| Updated but old behavior | Confirm **Settings → Status** shows the new `Teacher vX.Y.Z`, then **Developer: Reload Window** |
| Update check fails | Install from [GitHub Releases](https://github.com/Muhib-Beekun/Teacher/releases) or retry when Open VSX is reachable |
| Remote SSH/WSL/container | Install/update Teacher **on the remote extension host**, not only your local machine |

## 8. Verify

```powershell
npm run test:compiler
npm run test:web-app
```

With a cloud key: `npm run test:grok` (xAI smoke test).

## 9. AI agent configuration

**AI agents** (Cursor, Copilot, etc.) should read [AGENTS.md](../AGENTS.md) in the repo root. It explains how to configure Teacher via VS Code settings without creating `.env` lock issues.

When asking an agent to configure Teacher, include:

```
Workspace: <path>
Goal: Configure Teacher extension for <OpenAI | xAI Grok | Groq | Ollama>.
Read AGENTS.md for the preferred configuration path.
Steps: set teacher.inference.llm.baseUrl and model in settings.json,
run Teacher: Set Inference API Key, set teacher.compile.provider to cloud,
confirm Compiler status in web UI Settings.
Do not write INFERENCE_BASE_URL or INFERENCE_MODEL to .env (locks UI).
```

## Related docs

| Doc | Contents |
|-----|----------|
| [CONFIGURATION.md](./CONFIGURATION.md) | Settings reference |
| [INSTALL-CURSOR.md](./INSTALL-CURSOR.md) | VSIX install |
| [RELEASES.md](./RELEASES.md) | Build VSIX, GitHub Releases, Open VSX |
| [CHANGELOG.md](../CHANGELOG.md) | Version history |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Extension shape |
