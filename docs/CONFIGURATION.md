# Teacher configuration

Quick reference. For first-time setup (humans or AI agents), start with **[SETUP.md](./SETUP.md)**.

Reload the window after editing `settings.json`. Env vars in workspace `.env` override inference URL/model.

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
| `teacher.compile.provider` | `auto` | `auto` \| `cloud` \| `ollama` |
| `teacher.inference.ollama.model` | `qwen2.5-coder:14b` | Used when Ollama is the active compiler |
| `teacher.inference.ollama.url` | `http://127.0.0.1:11434` | Ollama API base |

**Auto:** Ollama if running locally, else cloud API when key is set.

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
