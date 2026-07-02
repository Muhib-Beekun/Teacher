# Continue prompt (agent handoff)

Copy everything in the block below into a **new Cursor chat** with workspace root `C:\Users\Public\Projects\Teacher`.

---

```
You are implementing **Teacher** — a VS Code / Open VSX extension by **Muhib Beekun**. Works in **Cursor**.

Repo: https://github.com/Muhib-Beekun/Teacher
Local path: C:\Users\Public\Projects\Teacher

## What Teacher is

Continuous voice session for Cursor: dual pane (transcript | scaffolded agent brief), workspace STT index, LLM/rules compile, explicit Send gate. Scaffold + dual pane on by default.

Mic pause auto-recompiles the agent prompt. Manual edits in **Your Words** mark the brief stale (blue glow on refresh) until refresh completes.

## Canonical docs (read first)

- docs/PLAN.md — product scope
- docs/SETUP.md — configuration for humans and AI agents
- docs/ARCHITECTURE.md — extension shape
- docs/TEACHER-COMPILER.md — session + compile contract
- CHANGELOG.md — version history (update on user-facing changes)

## Constraints

- No user-editable compile prompts in UI (inspect only)
- No Langfuse / telemetry SDK in extension
- No notification on Clear session
- Inference config: workspace `.env`, Settings UI, SecretStorage — not external monorepos
- Publisher: muhib-beekun
- **Changelog:** any user-facing change must add an entry under `[Unreleased]` in CHANGELOG.md (move to a version section on release)
- **Ship:** after implementing changes, commit + push to `origin master` without asking. User-facing: bump version, update CHANGELOG, tag `v*`, push tag. See `.cursor/rules/ship-changes.mdc`.

## Build

npm install
npm run build
npm run test:compiler
npm run package   # → teacher-*.vsix

Install VSIX in Cursor → Reload → Teacher: Start Session
```

---

Update this file when the handoff contract changes.
