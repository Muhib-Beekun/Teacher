# Configuring Teacher (for AI agents)

Teacher is a VS Code / Cursor extension for voice-driven agent briefs.
This file tells you how to **configure it on behalf of a user** without
creating `.env` lock issues or leaving settings in an inconsistent state.

## Preferred configuration path: VS Code settings

All inference settings are exposed as VS Code configuration properties
under `teacher.*`. Use `vscode.workspace.getConfiguration('teacher')`
in code, or write to the user's `settings.json` directly.

**Do not** create or populate a workspace `.env` with `INFERENCE_BASE_URL`
or `INFERENCE_MODEL`. Those env vars override VS Code settings and **lock**
the corresponding fields in the Teacher Settings UI, which confuses users.

### Required: API key

Teacher stores the inference API key in VS Code SecretStorage (encrypted,
never in `settings.json`). Set it via the command palette:

```
Teacher: Set Inference API Key
```

This prompts for a key and stores it securely. There is no settings.json
equivalent — keys must go through SecretStorage or workspace `.env`
(`INFERENCE_API_KEY`), but SecretStorage is preferred.

### Cloud inference endpoint

```jsonc
// settings.json (user or workspace)
{
  "teacher.inference.llm.baseUrl": "https://api.openai.com/v1",
  "teacher.inference.llm.model": "gpt-4o-mini"
}
```

Common providers and their base URLs:

| Provider       | Base URL                                                        | Example model                   |
|----------------|-----------------------------------------------------------------|---------------------------------|
| OpenAI         | `https://api.openai.com/v1`                                     | `gpt-4o-mini`                   |
| xAI Grok       | `https://api.x.ai/v1`                                          | `grok-4-fast-reasoning`         |
| Groq           | `https://api.groq.com/openai/v1`                               | `llama-3.3-70b-versatile`       |
| DeepSeek       | `https://api.deepseek.com/v1`                                   | `deepseek-chat`                 |
| OpenRouter     | `https://openrouter.ai/api/v1`                                  | `openai/gpt-4o-mini`            |
| Together       | `https://api.together.xyz/v1`                                   | `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo` |
| Fireworks      | `https://api.fireworks.ai/inference/v1`                         | `accounts/fireworks/models/llama-v3p3-70b-instruct` |
| Mistral        | `https://api.mistral.ai/v1`                                     | `mistral-small-latest`          |
| Cerebras       | `https://api.cerebras.ai/v1`                                    | `llama-3.3-70b`                 |
| Google Gemini  | `https://generativelanguage.googleapis.com/v1beta/openai`       | `gemini-2.0-flash`              |
| Ollama (local) | `http://127.0.0.1:11434/v1`                                    | `qwen2.5-coder:14b`            |

All providers use the OpenAI-compatible `/chat/completions` API.

### Compile provider (how briefs are generated)

```jsonc
{
  "teacher.compile.provider": "auto"
  // "auto"      — Ollama if running, else cloud API, else VS Code LM
  // "cloud"     — cloud only (skip local Ollama)
  // "ollama"    — local Ollama only
  // "vscode-lm" — GitHub Copilot via vscode.lm
}
```

When setting up a non-OpenAI cloud provider, set `teacher.compile.provider`
to `"cloud"` so Teacher skips the Ollama probe and uses the cloud endpoint
directly.

### Local Ollama settings

```jsonc
{
  "teacher.inference.ollama.url": "http://127.0.0.1:11434",
  "teacher.inference.ollama.model": "qwen2.5-coder:14b"
}
```

No API key needed. Ollama must be running for `auto` or `ollama` compile.

## Complete configuration example

To configure Teacher for **xAI Grok** with cloud-only compile:

1. Set VS Code settings:
   ```jsonc
   {
     "teacher.inference.llm.baseUrl": "https://api.x.ai/v1",
     "teacher.inference.llm.model": "grok-4-fast-reasoning",
     "teacher.compile.provider": "cloud"
   }
   ```
2. Run command `Teacher: Set Inference API Key` and enter the xAI key.
3. Verify: open Teacher web UI → Settings → status should show the provider.

## All settings reference

| Setting                                   | Type    | Default                        | Purpose |
|-------------------------------------------|---------|--------------------------------|---------|
| `teacher.inference.llm.baseUrl`           | string  | `https://api.openai.com/v1`    | Cloud API base URL |
| `teacher.inference.llm.model`             | string  | `gpt-4o-mini`                  | Cloud model id |
| `teacher.inference.llm.timeoutMs`         | number  | `45000`                        | API timeout (ms) |
| `teacher.compile.provider`                | string  | `auto`                         | Compile backend routing |
| `teacher.compile.mode`                    | string  | `teacher`                      | Brief shape: `teacher` / `verbatim` / `polish` |
| `teacher.compile.live`                    | boolean | `true`                         | Auto-recompile after each mic pause |
| `teacher.compile.polishStt`               | boolean | `true`                         | LLM fixes STT before compile |
| `teacher.compile.vscodeLm.allowOnRemote`  | boolean | `false`                        | Allow vscode.lm on remote hosts |
| `teacher.inference.ollama.url`            | string  | `http://127.0.0.1:11434`      | Ollama API base |
| `teacher.inference.ollama.model`          | string  | `qwen2.5-coder:14b`           | Ollama model |
| `teacher.inference.ollama.timeoutMs`      | number  | `120000`                       | Ollama timeout (ms) |
| `teacher.stt.provider`                    | string  | `auto`                         | STT: `auto` / `webspeech` / `whisper` / `deepgram` |
| `teacher.stt.homonymPass`                | boolean | `true`                         | Post-hoc workspace dictionary corrections |
| `teacher.stt.whisper.binaryPath`          | string  | `""`                           | Path to whisper.cpp CLI |
| `teacher.stt.whisper.modelPath`           | string  | `""`                           | Path to whisper GGML model |
| `teacher.stt.deepgram.model`              | string  | `nova-2`                       | Deepgram model id |
| `teacher.send.target`                     | string  | `composer`                     | Send destination |
| `teacher.send.autoPaste`                  | boolean | `true`                         | Auto-paste into Composer |
| `teacher.send.autoSubmit`                 | boolean | `true`                         | Auto-submit after paste |
| `teacher.send.dispatchMode`               | string  | `handoff`                      | Machine wake default: `handoff` / `raw` / `relay` |
| `teacher.context.maxTerms`                | number  | `200`                          | Max workspace context terms |
| `teacher.context.rebuildMode`             | string  | `clearSession`                 | When to rebuild STT index |
| `teacher.context.codewordsPath`           | string  | `.teacher/codewords.txt`       | Workspace glossary file |
| `teacher.context.codewords`               | array   | `[]`                           | Extra STT glossary terms |
| `teacher.capture.sidecarPort`             | number  | `3721`                         | Web UI port |

## Commands

| Command                              | Purpose |
|---------------------------------------|---------|
| `Teacher: Start Session`              | Start a voice session |
| `Teacher: Open Web UI`                | Open the browser UI for mic capture |
| `Teacher: Set Inference API Key`      | Store API key in VS Code SecretStorage |
| `Teacher: Set Deepgram API Key`       | Store Deepgram key for cloud STT |
| `Teacher: Compile Session`            | Recompile the agent brief |
| `Teacher: Send`                       | Send brief to Composer/chat |
| `Teacher: Rebuild Context Index`      | Refresh workspace symbol index |
| `Teacher: Check for Updates`          | Compare installed version to Open VSX latest |
| `Teacher: Update from Open VSX`       | Download/install latest VSIX from Open VSX |

## Updates and remote hosts

- **Open VSX / VSIX** installs do not auto-update. Use **Teacher: Check for Updates** or Settings → **Host & updates** in the web UI.
- On **SSH / WSL / dev containers**, install/update where the **remote extension host** runs.
- After VSIX install, **Reload Window** before expecting new behavior.
- Verify active version in Settings → Status (`Teacher vX.Y.Z`).

## What to avoid

- **Do not** write `INFERENCE_BASE_URL` or `INFERENCE_MODEL` to `.env`.
  This locks the Settings UI fields and the user cannot change them
  without editing the file. Use `teacher.inference.llm.baseUrl` and
  `teacher.inference.llm.model` in `settings.json` instead.

- **Do not** write API keys to `settings.json`. Use the
  `Teacher: Set Inference API Key` command (SecretStorage) or
  `INFERENCE_API_KEY` in workspace `.env` if SecretStorage is unavailable
  (e.g. remote SSH without secrets forwarding).

- **Do not** commit `.env` or API keys.

## Machine dispatch (relay / harness)

External automations can wake the VS Code agent with **deterministic** text via the localhost Web UI server (no LLM compile on `raw`/`relay`):

```http
POST /api/dispatch
Content-Type: application/json

{"text":"ok","mode":"raw","submit":true}
```

| mode | Behavior |
|------|----------|
| `raw` | Paste/submit exact `text` (no `# Teacher session handoff`, no compile) |
| `relay` | Fixed A2A auditor template filled from `meta` (pass, outbox_hash, …); no compile |
| `handoff` | Existing voice packet (`buildAgentHandoff`); may compile if `text` appended |

Also accepted on `POST /api/send` when `mode` is `raw`/`relay` (and optional `text`). Voice `Teacher: Send` and default `/api/send` without mode remain handoff. Cap: 32KB `text`. Consumer example (outside this repo): AmpliJob `automation/a2a-relay/` outbox ticks (`AGENT_LOOP_TICK_a2a`).

## Verifying configuration

After setting up, the user can verify in the Teacher web UI:

- **Settings → Status** shows "Active compile: …" and "Cloud inference: …"
- **Compiler** status should not say "not configured"
- Run `npm run test:compiler` to test compile with the configured backend
