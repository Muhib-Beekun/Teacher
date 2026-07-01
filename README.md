# Teacher

Context-aware voice input and **intent compilation** for VS Code, Cursor, and other VS Code–compatible editors.

**Teacher** (the mode) takes a **continuous** dictation session — keep speaking after the first pass, fix mistakes with your voice not the keyboard — then **re-scaffolds** an agent-ready brief from everything you've said (including *ignore that* / *I meant…*).

**Status:** Full v1 stack implemented. See [docs/PLAN.md](./docs/PLAN.md).

## Use it

```powershell
npm install && npm run build
```

**Run and Debug** → **Run Teacher Extension** → **Teacher: Start Session**

| Step | Action |
|------|--------|
| Speak | Click mic (toggle). Pause mic between chunks — session stays open. |
| STT | Auto: whisper.cpp if paths set → else Deepgram if key set → else Web Speech |
| Review | Left = your words (yellow = workspace fix). Right = scaffolded brief |
| Send | **Send to Agent** → Composer paste + submit |

### Optional setup

**Whisper (local):** Settings → `teacher.stt.whisper.binaryPath` + `modelPath`

**Deepgram (BYOK):** Command **Teacher: Set Deepgram API Key**

**Ollama (compile):** Run Ollama with `qwen2.5:7b-instruct` — auto-detected

## vs Cursor voice

| Cursor | Teacher |
|--------|---------|
| One shot → text dumped in box | **Session stays open** — append more speech anytime |
| Stop ends the prompt — can't add more by voice | **Stop = chunk done** — review, append, clarify, Send when ready |
| Partial STT wipes/replaces text in box | **Audit pane** keeps your words; scaffold updates separately |
| Imperfect → type corrections by hand | **Speak corrections**; compiler re-drives the brief |
| What you see is raw transcript | **Dual pane**: your words ↔ compiled agent prompt |
| Generic STT | **Workspace vocabulary** from symbols, deps, codewords |

## Quick start (developer)

```powershell
npm install
npm run build
```

Open **Run and Debug** → **Run Teacher Extension** in Cursor. Commands under **Teacher:** in the command palette.

## Docs

| Doc | Contents |
|-----|----------|
| [docs/PLAN.md](./docs/PLAN.md) | **Canonical product plan and roadmap** |
| [docs/CONTEXT.md](./docs/CONTEXT.md) | Origin story, product wedge |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Extension shape, pipeline, Open VSX / Cursor |
| [docs/TEACHER-COMPILER.md](./docs/TEACHER-COMPILER.md) | Session model, re-drive, output templates |
| [docs/CONTEXT-INDEX.md](./docs/CONTEXT-INDEX.md) | Codebase indexing without vector RAG |
| [docs/INFERENCE.md](./docs/INFERENCE.md) | Self-hosted, BYOK, Hugging Face options |
| [docs/TRAINING-DATA.md](./docs/TRAINING-DATA.md) | Cursor conversation exports as supervision (later) |
| [docs/CONTINUE-PROMPT.md](./docs/CONTINUE-PROMPT.md) | Agent session handoff prompt |

## Related AmpliJob work

Voice STT context seeding in product backlog: `environment/docs/product/backlog.md` items **39–42**. Dual-pane UX reference: `environment/docs/product/mockups/evidence-intake-journey-mockup.html` (Shared tail · Facts frames 2 & 2b).

## License

TBD (private repo until scope is settled).
