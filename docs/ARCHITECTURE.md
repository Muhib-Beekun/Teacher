# Architecture

High-level system design for the Teacher VS Code extension.

---

## Components

```text
┌─────────────────────────────────────────────────────────────────┐
│ Extension host (Node)                                            │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ Workspace    │   │ Session      │   │ Provider registry    │ │
│  │ ContextIndex │   │ Manager      │   │ (STT + Compiler)     │ │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘ │
│         │                  │                       │             │
│         └──────── VoiceSessionContext ────────────┘             │
│                            │                                     │
│  ┌─────────────────────────▼─────────────────────────────────┐  │
│  │ Webview / sidecar: mic capture + preview UI               │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                            │                                     │
│  ┌─────────────────────────▼─────────────────────────────────┐  │
│  │ Insert router → editor | clipboard→chat | command palette   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   Local inference              Cloud BYOK (optional)
   (Ollama, HF, faster-whisper) (Deepgram, OpenAI, HF API)
```

---

## VS Code extension constraints

Extensions run in an **isolated Node process** — no direct Electron mic API.

| Capture strategy | v1 priority | Notes |
|------------------|-------------|-------|
| Webview + `getUserMedia` | **Primary** | Streaming-friendly; well-tested pattern |
| Bundled ffmpeg | Fallback | Batch record → transcribe (Cursor 3.1 style) |
| Sidecar Electron | Defer | Heavy; use if webview insufficient |

Chat/Composer injection: **no official Cursor API**. v1 = copy compiled brief + paste into focused input, or insert at active editor cursor.

---

## Package layout (planned)

```text
teacher/
  package.json              # engines.vscode, contributes.commands
  src/
    extension.ts            # activate, register commands
    context/
      WorkspaceContextIndex.ts
      VoiceSessionContext.ts
    session/
      SegmentStore.ts
      RetractionDetector.ts
    compiler/
      TeacherCompiler.ts    # rules + optional LLM adapter
    providers/
      stt/                  # Deepgram, Whisper, local whisper.cpp
      compile/              # Ollama, HF, OpenAI
    ui/
      PreviewPanel.ts       # webview
    insert/
      InsertRouter.ts
  media/                    # webview assets
  docs/                     # this folder
```

---

## Commands (planned)

| Command | Action |
|---------|--------|
| `teacher.startSession` | Begin session; open dual-pane panel; mic ready |
| `teacher.appendSegment` | Push-to-talk chunk (or auto in continuous mode) |
| `teacher.compile` | Force re-scaffold preview (usually automatic) |
| `teacher.send` | Insert **compiled** prompt → Chat / editor |
| `teacher.dictateHere` | Single-shot verbatim to cursor (bypass session) |
| `teacher.endSession` | Close panel without send |
| `teacher.rebuildIndex` | Force context index refresh |

---

## Configuration surface

```json
{
  "teacher.stt.provider": "local | deepgram | openai | huggingface",
  "teacher.compile.provider": "local | ollama | huggingface | openai",
  "teacher.compile.mode": "teacher | verbatim | polish",
  "teacher.context.maxTerms": 200,
  "teacher.context.excludeGlobs": ["**/node_modules/**", "**/.env*"],
  "teacher.inference.ollama.model": "qwen2.5:7b-instruct",
  "teacher.inference.huggingface.model": "…",
  "teacher.preview.layout": "dual | single",
  "teacher.compile.live": true,
  "teacher.compile.debounceMs": 800,
  "teacher.session.holdChatBox": true,
}
```

Secrets via VS Code `SecretStorage` (API keys), not `settings.json`.

---

## Open VSX and Cursor

- Publish to [Open VSX](https://open-vsx.org) for broad VS Code fork compatibility.
- Test matrix: **Cursor** (primary), VS Code stable, optionally VSCodium.
- Pin tested Cursor versions in README when voice UI changes.

---

## Observability

Local-only by default:

- Output channel: STT raw, compiled brief, superseded block.
- Optional JSONL session log in workspace `.teacher/sessions/` (gitignored) for debugging and **opt-in** training export.

No telemetry SDK in v0.

---

## Relationship to AmpliJob

Shared concepts, separate repos:

| Concept | AmpliJob (`environment`) | Teacher (this repo) |
|---------|--------------------------|---------------------|
| `VoiceSessionContext` | Mobile evidence / Tell story | Cursor agent prompts |
| Layered STT pipeline | evidence-and-atoms §9 | Extension STT adapter |
| Supersession | Evidence versions | Teacher compile reference block |
| Langfuse traces | Production AI | Optional later for compile quality |

Contract shapes should stay compatible so a future shared npm package (`@amplijob/voice-context`) is possible.
