# Continue prompt (agent handoff)

Copy everything in the block below into a **new Cursor chat** with workspace root `C:\Users\Public\Projects\Teacher`.

---

```
You are implementing **Teacher** — a VS Code / Open VSX extension by **Muhib Beekun**. Works in **Cursor**.

Repo: https://github.com/Muhib-Beekun/Teacher
Local path: C:\Users\Public\Projects\Teacher

## What Teacher is

Continuous voice session for Cursor: dual pane (transcript | scaffolded agent brief), workspace STT index, LLM/rules compile, explicit Send gate. Scaffold + dual pane on by default.

## Canonical docs (read first)

- docs/PLAN.md — product scope
- docs/SETUP.md — configuration for humans and AI agents
- docs/ARCHITECTURE.md — extension shape
- docs/TEACHER-COMPILER.md — session + compile contract

## Constraints

- No user-editable compile prompts in UI (inspect only)
- No Langfuse / telemetry SDK in extension
- No notification on Clear session
- Inference config: workspace `.env`, Settings UI, SecretStorage — not external monorepos
- Publisher: muhib-beekun

## Build

npm install
npm run build
npm run test:compiler
npm run package   # → teacher-*.vsix

Install VSIX in Cursor → Reload → Teacher: Start Session
```

---

Update this file when the handoff contract changes.
