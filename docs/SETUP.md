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

## 2. First run checklist

| Step | Action |
|------|--------|
| 1 | Open any project workspace in Cursor |
| 2 | Command Palette → **Teacher: Start Session** (or **Teacher: Open Web UI**) |
| 3 | Click **Settings** in the web UI |
| 4 | Pick **Inference provider** preset (OpenAI default) or run **Ollama** locally |
| 5 | Save **Inference API key** (or copy `.env.example` → `.env`) |
| 6 | Set **Compile provider**: Auto / Cloud API / Local Ollama |
| 7 | Confirm **Compiler:** line shows ready (not "not configured") |
| 8 | Speak in Chrome/Edge sidecar; review **Your Words** and **Agent Prompt** |

## 3. Two concepts (do not confuse)

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
| **Auto** (default) | Local Ollama if running → else cloud API if key set |
| **Cloud API only** | Always cloud (uses Connection preset above) |
| **Local Ollama only** | Always Ollama (`teacher.inference.ollama.model`, default `qwen2.5-coder:14b`) |

The **Compiler:** status line shows the active backend, not just the preset.

## 4. Environment variables

Copy [`.env.example`](../.env.example) → `.env` in the **workspace root** (gitignored).

Priority: workspace **`.env`** overrides VS Code settings for base URL and model. API key resolves:

1. VS Code SecretStorage (saved in Teacher Settings UI)
2. Env vars in workspace `.env` (see below)

| Variable | Purpose |
|----------|---------|
| `INFERENCE_API_KEY` | Primary cloud API key |
| `INFERENCE_BASE_URL` | OpenAI-compatible base (no `/chat/completions` suffix) |
| `INFERENCE_MODEL` | Model id for compile + polish |
| `OPENAI_API_KEY` | Alias → `INFERENCE_API_KEY` |
| `XAI_API_KEY` / `GROK_API_KEY` | xAI Grok aliases |
| `DEEPGRAM_API_KEY` | Optional cloud STT |
| `OLLAMA_HOST` | Optional Ollama URL |

Command Palette: **Teacher: Set Inference API Key** stores key in SecretStorage (not `settings.json`).

## 5. Workspace glossary (STT)

Create or edit `.teacher/codewords.txt` (one term per line, gitignored):

```
Grok
Groq
Ollama
INFERENCE_API_KEY
```

Run **Teacher: Rebuild Context Index** after edits.

## 6. Verify

```powershell
npm run test:compiler
npm run test:web-app
```

With a cloud key: `npm run test:grok` (xAI smoke test).

## 7. AI agent handoff block

When asking an agent to configure Teacher, include:

```
Workspace: <path>
Goal: Configure Teacher extension for <OpenAI | xAI Grok | Groq | Ollama>.
Read docs/SETUP.md and .env.example.
Steps: install VSIX, set compile provider, set inference preset + API key or .env,
confirm Compiler status in web UI Settings, test mic session.
Do not commit .env or API keys.
```

## Related docs

| Doc | Contents |
|-----|----------|
| [CONFIGURATION.md](./CONFIGURATION.md) | Settings reference |
| [INSTALL-CURSOR.md](./INSTALL-CURSOR.md) | VSIX install |
| [RELEASES.md](./RELEASES.md) | Build VSIX, GitHub Releases |
| [PLAN.md](./PLAN.md) | Product scope |
