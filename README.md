<p align="center">
  <img src="media/banner.jpg" alt="Teacher: Lecture your AI. Voice sessions for Cursor and VS Code." width="100%" />
</p>

# Teacher

*Lecture your AI.*

**Author:** [Muhib Beekun](https://github.com/Muhib-Beekun/Teacher)

I said *feature*. Autocorrect wrote **Teacher**. I kept the name anyway because it fits how I work: I **lecture** my AI, talk through what I want, correct myself mid-stream, retract half-baked ideas, and keep going until the model understands. Teacher holds the session open, biases STT with workspace vocabulary, and **teaches the agent what I meant** before anything hits Composer.

Context-aware voice input and **intent compilation** for VS Code, Cursor, and other VS Code–compatible editors.

**Teacher** (the mode) keeps a **continuous** dictation session. I keep speaking after the first pass and fix mistakes with my voice. The extension **re-scaffolds** an agent-ready brief from everything I said (including *ignore that* / *I meant…*).

**Status:** Full v1 stack implemented. See [docs/SETUP.md](./docs/SETUP.md).

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

## Known issues

**Remote SSH, WSL, and dev containers:** GitHub Copilot via `vscode.lm` often returns **empty compile output** on the remote extension host, even when Copilot works on your local machine. Teacher cannot rely on vscode-lm alone there.

**You need inference on the remote side** for **Agent Prompt** compile (and STT polish):

- **Cloud API** — set `INFERENCE_API_KEY` (Teacher Settings UI, SecretStorage, or workspace `.env` on the remote workspace), or
- **Ollama** — run Ollama where the extension host runs and set `teacher.inference.ollama.url` if needed.

With **Compile provider: Auto** (default), Teacher skips vscode-lm on remote hosts unless you set `teacher.compile.vscodeLm.allowOnRemote` to `true`. See [docs/SETUP.md](./docs/SETUP.md) and [docs/CONFIGURATION.md](./docs/CONFIGURATION.md).

## vs Cursor voice

| Cursor | Teacher |
|--------|---------|
| One shot → text dumped in box | **Session stays open** — append more speech anytime |
| Stop ends the prompt | **Stop = chunk done** — review, append, clarify, Send when ready |
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
| [docs/SETUP.md](./docs/SETUP.md) | **First-time setup** |
| [docs/INSTALL-CURSOR.md](./docs/INSTALL-CURSOR.md) | VSIX install + mic browser |
| [docs/CONFIGURATION.md](./docs/CONFIGURATION.md) | Settings reference |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Extension shape and pipeline |
| [docs/TEACHER-COMPILER.md](./docs/TEACHER-COMPILER.md) | Session model and compile contract |
| [docs/CONTEXT-INDEX.md](./docs/CONTEXT-INDEX.md) | Workspace indexing |
| [docs/RELEASES.md](./docs/RELEASES.md) | VSIX, GitHub Releases, Open VSX |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |

## Related work

Teacher is **by Muhib Beekun**. Dual-pane voice UX patterns were inspired by earlier evidence-intake mockups; this extension is a standalone product.

## License

MIT — see [LICENSE](./LICENSE).
