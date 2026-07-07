# Teacher configuration

Quick reference. For first-time setup (humans or AI agents), start with **[SETUP.md](./SETUP.md)**.

**AI agents:** see [AGENTS.md](../AGENTS.md) for the preferred configuration path (VS Code settings, not `.env`).

Reload the window after editing `settings.json`. Env vars in workspace `.env` override inference URL/model but **lock** the corresponding fields in the Teacher Settings UI — prefer VS Code settings.

## Cloud compile (API key)

| Method | Notes |
|--------|-------|
| **Teacher Settings UI** | Save Inference API key (SecretStorage) |
| **Command** | **Teacher: Set Inference API Key** |
| **`.env`** | `INFERENCE_API_KEY` or provider aliases (see `.env.example`) |

Without a key and without Ollama, speech still lands in **Your Words**, but **Agent Prompt** will not compile.

## Inference endpoint (cloud)

| Setting | Default | Notes |
|---------|---------|-------|
| `teacher.inference.llm.baseUrl` | `https://api.openai.com/v1` | Overridden by `INFERENCE_BASE_URL` in `.env` |
| `teacher.inference.llm.model` | `gpt-4o-mini` | Overridden by `INFERENCE_MODEL` in `.env` |
| `teacher.inference.llm.timeoutMs` | `45000` | API timeout |

Use **Inference provider** preset in the web UI Settings, or set URL + model manually.

## Compile provider

| Setting | Default | Notes |
|---------|---------|-------|
| `teacher.compile.provider` | `auto` | `auto` \| `cloud` \| `ollama` \| `vscode-lm` |
| `teacher.compile.vscodeLm.allowOnRemote` | `false` | Allow vscode.lm on remote extension hosts (often unreliable over SSH) |
| `teacher.inference.ollama.model` | `qwen2.5-coder:14b` | Used when Ollama is the active compiler |
| `teacher.inference.ollama.url` | `http://127.0.0.1:11434` | Ollama API base |

**Auto (local):** Ollama if running → cloud API when key is set → VS Code LM (Copilot).

**Auto (remote SSH / WSL / container):** Ollama → cloud API. Skips vscode-lm unless `teacher.compile.vscodeLm.allowOnRemote` is `true`.

### Known issue: remote hosts require inference

On remote extension hosts, `vscode.lm` (GitHub Copilot) may appear available but return empty compile output. **Agent Prompt compile and STT polish need cloud or Ollama configured where the extension host runs** — a Copilot subscription on your laptop is not enough if the workspace is SSH-remote.

| Remote setup | What to configure |
|--------------|-------------------|
| SSH / remote VM | `INFERENCE_API_KEY` on the remote workspace, or Ollama on the remote machine |
| WSL remote | Cloud key in WSL workspace `.env`, or Ollama inside WSL |
| Dev container | Key in container env / SecretStorage, or Ollama in the container |

Without cloud or Ollama on remote, **Your Words** still works; **Agent Prompt** stays empty or shows placeholder intent until inference is configured.

## STT provider and workspace biasing

Teacher does **not** use vector RAG. Workspace context is a ranked term list from symbols, open files, `package.json` deps, basenames, and `.teacher/codewords.txt`.

| Stage | When | What it does |
|-------|------|--------------|
| **Index** | Rebuild / each segment (optional) | Builds `dictionary_context` + `stt_prompt` (top terms as a text hint) |
| **Recognition-time bias** | Depends on STT provider | See below |
| **Lexicon** | Every segment | Phrase rules (Ollama, VS Code, INFERENCE_API_KEY, …) |
| **Dictionary homonym pass** | Every segment (`teacher.stt.homonymPass`, default on) | Fuzzy match tokens to workspace terms |
| **LLM polish** | Optional, before compile | Cloud/Ollama fixes remaining STT errors |

### Provider comparison

| Provider | Recognition bias | Post-processing |
|----------|------------------|-----------------|
| **Browser Web Speech** (Chrome default) | **None** — browser STT ignores your codewords | Lexicon + dictionary + polish |
| **Whisper** (`teacher.stt.whisper.*`) | **`--prompt`** with `stt_prompt` (workspace terms, ~800 chars) | Lexicon + dictionary + polish |
| **Deepgram** (BYOK) | **`keywords=`** query param (top 100 terms) | Lexicon + dictionary + polish |

**Auto order:** Whisper if binary+model configured → Deepgram if key set → else Web Speech.

For strongest **recognition-time** biasing (Grok vs Groq, file names, symbol names), configure **Whisper** or **Deepgram**. **Browser Web Speech does not support hear-time bias** — workspace codewords only help via post-hoc lexicon, homonym pass, and LLM polish after text arrives.

**Whisper overhead:** each mic pause sends audio to the extension host for local inference — typically 1–5+ seconds on CPU depending on model size, plus CPU/GPU use while transcribing. Browser speech has no local compute cost and lower latency.

Whisper paths are configured in **Teacher Settings → Speech → Local Whisper** (browse, discover, test). See [WHISPER-SETUP.md](./WHISPER-SETUP.md). Audio is recorded in the browser on mic pause and transcribed on the extension host.

**Glossary:** edit **Your glossary** in Teacher Settings (writes `.teacher/codewords.txt`). Advanced: `teacher.context.codewords` in VS Code settings still merges at index time but is not shown in the Teacher UI.

## Optional secrets

| Secret | Command / setting | Purpose |
|--------|-------------------|---------|
| `DEEPGRAM_API_KEY` | **Teacher: Set Deepgram API Key** | Cloud STT |
| Whisper | `teacher.stt.whisper.binaryPath`, `teacher.stt.whisper.modelPath` | Local STT |

## Session and send

| Setting | Default | Notes |
|---------|---------|-------|
| `teacher.compile.live` | `true` | Re-scaffold after each mic pause; manual Your Words edits show refresh glow until recompile |
| `teacher.compile.mode` | `teacher` | `teacher` = structured brief; `verbatim` = joined text |
| `teacher.compile.polishStt` | `true` | LLM fixes STT before compile (needs compiler) |
| `teacher.stt.provider` | `auto` | `webspeech` \| `whisper` \| `deepgram` \| `auto` |
| `teacher.stt.homonymPass` | `true` | Workspace dictionary corrections |
| `teacher.send.autoPaste` | `true` | Paste brief into Composer |
| `teacher.send.autoSubmit` | `true` | Best-effort submit after paste |
| `teacher.capture.sidecarPort` | `3721` | Browser mic UI port |

## Workspace glossary

| File | Purpose |
|------|---------|
| `.teacher/codewords.txt` | One term per line — STT context (Grok, Groq, Ollama, symbol names) |

Also: `teacher.context.codewords` in settings. Run **Teacher: Rebuild Context Index** after edits.

## UI labels

**Compiler** (Settings status): active backend right now (Ollama model or cloud model).

**Inference provider** (Settings dropdown): cloud endpoint configuration — not necessarily what compiles when **Auto** and Ollama are running.

## Verify

```powershell
npm run test:compiler
npm run test:web-app
npm run test:grok    # xAI smoke test when XAI/GROK key present
```

## Updates (Open VSX / VSIX)

Teacher does **not** auto-update when installed from Open VSX or a manual VSIX. Use the built-in commands or the **Host & updates** section in Teacher Settings.

| Command | Purpose |
|---------|---------|
| **Teacher: Check for Updates** | Query Open VSX for the latest published version and compare with the running extension |
| **Teacher: Update from Open VSX** | Download the VSIX to extension global storage and install via `workbench.extensions.installExtension`, then prompt to reload |

| UI | Purpose |
|----|---------|
| **Host & updates** (Settings) | Extension host (local vs remote), install channel hint, installed vs latest version, pin state (best effort), check/update buttons |

### Remote hosts (SSH / WSL / dev containers)

Install and update **where the extension host runs**, not only on your laptop. After updating, **reload the window** on that host. Settings shows `Extension host: remote (…)` when applicable.

### Pinning and stale versions

VS Code can **pin** an extension to a specific version. Pinned extensions may ignore updates until unpinned. Teacher reads profile `extensions.json` beside the install folder when possible and tries to clear the pin flag before installing. If pin state is **unknown**, unpin manually in the Extensions view if updates fail to apply.

### Troubleshooting

| Symptom | What to try |
|---------|-------------|
| Check returns HTTP 404 shortly after a release | Open VSX propagation lag — retry in a few minutes (Teacher retries once automatically) |
| Installed version unchanged after update | Reload the window; check pin state; reinstall VSIX from [GitHub Releases](https://github.com/Muhib-Beekun/Teacher/releases) |
| Update works locally but not on SSH | Run **Teacher: Update from Open VSX** in the remote workspace; confirm host diagnostics show remote |
