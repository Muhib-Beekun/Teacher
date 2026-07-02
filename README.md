# Teacher

*Lecture your AI.*

**Author:** [Muhib Beekun](https://github.com/Muhib-Beekun/Teacher)

The name **Teacher** stuck because this is how I work: I don't drop one-liners into the agent — I **lecture**. I talk through what I want, correct myself mid-stream, retract half-baked ideas, and keep going until the model understands. Teacher holds the session open, hears you with workspace vocabulary, and **teaches the agent what you meant** before anything hits Composer.

Context-aware voice input and **intent compilation** for VS Code, Cursor, and other VS Code–compatible editors.

**Teacher** (the mode) takes a **continuous** dictation session — keep speaking after the first pass, fix mistakes with your voice not the keyboard — then **re-scaffolds** an agent-ready brief from everything you've said (including *ignore that* / *I meant…*).

**Status:** Full v1 stack implemented. See [docs/PLAN.md](./docs/PLAN.md).

## Use it

Install **Teacher** in Cursor or other VS Code–compatible editors:

| Method | Best for |
|--------|----------|
| **[Open VSX](https://open-vsx.org/extension/muhib-beekun/teacher)** | VSCodium, Gitpod, etc. — search **Teacher** by **muhib-beekun** |
| **VSIX (dogfood / latest)** | Cursor — build locally or download from [GitHub Releases](https://github.com/Muhib-Beekun/Teacher/releases) |

- **[docs/SETUP.md](./docs/SETUP.md)** — first-time setup (humans and AI agents)
- **[docs/INSTALL-CURSOR.md](./docs/INSTALL-CURSOR.md)** — VSIX install + **open Chrome/Edge for mic**
- **[CHANGELOG.md](./CHANGELOG.md)** — version history
- **[docs/CONFIGURATION.md](./docs/CONFIGURATION.md)** — settings reference
- **[docs/RELEASES.md](./docs/RELEASES.md)** — build VSIX and publish GitHub Releases

Quick version:

```powershell
cd C:\Users\Public\Projects\Teacher
npm install
npm run package
```

Then in Cursor: **`Ctrl+Shift+P`** → **`Extensions: Install from VSIX...`** → pick the latest **`teacher-*.vsix`** in the repo root → Reload.

Then in any project: **`Teacher: Open Web UI`** → allow mic in **Chrome or Edge** at `http://127.0.0.1:3721/` (see [SETUP.md](./docs/SETUP.md)).

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
| [docs/SETUP.md](./docs/SETUP.md) | **First-time setup** (humans and AI agents) |
| [docs/RELEASES.md](./docs/RELEASES.md) | **VSIX, GitHub Releases, Open VSX** |
| [CHANGELOG.md](./CHANGELOG.md) | **Version history** |
| [docs/PLAN.md](./docs/PLAN.md) | **Canonical product plan and roadmap** |
| [docs/CONTEXT.md](./docs/CONTEXT.md) | Origin story, product wedge |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Extension shape, pipeline, Open VSX / Cursor |
| [docs/TEACHER-COMPILER.md](./docs/TEACHER-COMPILER.md) | Session model, re-drive, output templates |
| [docs/CONTEXT-INDEX.md](./docs/CONTEXT-INDEX.md) | Codebase indexing without vector RAG |
| [docs/CONTINUE-PROMPT.md](./docs/CONTINUE-PROMPT.md) | Agent session handoff prompt |

## Related work

Teacher is **by Muhib Beekun**. Dual-pane voice UX patterns were inspired by earlier evidence-intake mockups; this extension is a standalone product.

## License

MIT — see [LICENSE](./LICENSE).
