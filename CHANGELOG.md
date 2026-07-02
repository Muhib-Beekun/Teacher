# Changelog

All notable changes to **Teacher** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Version numbers match `package.json` and `teacher-<version>.vsix` builds.

## [Unreleased]

## [0.0.46] - 2026-06-30

### Added
- **MIT License** (`LICENSE`) — open-source distribution for Open VSX and GitHub.
- `homepage` and `bugs` URLs in `package.json`.

### Changed
- GitHub repository is **public**.
- README and install docs: Open VSX + VSIX install paths (VSIX still works for early adopters).
- Removed `"private": true` and `"license": "UNLICENSED"` from `package.json`.

## [0.0.45] - 2026-06-30

### Added
- `CHANGELOG.md` (this file) — canonical history for GitHub Releases and Open VSX.
- GitHub Actions workflow (`.github/workflows/release.yml`) — tag `v*` → build VSIX, GitHub Release, optional Open VSX publish.
- `npm run publish:ovsx` script for manual Open VSX upload.
- Prominent **Chrome/Edge + URL** callout in the web UI mic column.
- **Open your browser** section in [docs/SETUP.md](./docs/SETUP.md) and [docs/INSTALL-CURSOR.md](./docs/INSTALL-CURSOR.md).

### Changed
- Agent handoff ([docs/CONTINUE-PROMPT.md](./docs/CONTINUE-PROMPT.md)) requires a changelog entry for user-facing changes.
- [docs/RELEASES.md](./docs/RELEASES.md) documents Open VSX (open-source extension registry) and automated release path.
- STT yellow highlights: drop spurious polish diffs when both words were spoken (e.g. `like launch` → `like`→`launch`).

### Fixed
- Polish word-diff no longer highlights filler rephrases like `launch` → `the` when the mic already captured `launch`.

## [0.0.44] - 2026-06-30

### Changed
- Standalone product: removed AmpliJob compose env wiring and external monorepo coupling.
- GitHub repo set to [Muhib-Beekun/Teacher](https://github.com/Muhib-Beekun/Teacher).
- Training scaffolding trimmed (LoRA/synthetic overnight tools gitignored); kept eval harness and fixtures.
- Shipped OpenAI-first inference defaults; Grok/Groq only via user `.env` or Settings presets.

### Added
- `docs/RELEASES.md` — manual VSIX + GitHub Release steps.
- First git tag `v0.0.44` with VSIX on GitHub Releases.

## [0.0.38] – [0.0.43]

Inference and publication polish during dogfood.

- Inference **presets** in web Settings (OpenAI, xAI Grok, Groq, DeepSeek, Custom).
- **Compile provider** selector in web UI: Auto / Cloud / Ollama.
- Workspace `.env` loading for `INFERENCE_*` keys; `docs/SETUP.md` as single setup guide.
- `.env.example` expanded with provider examples.
- Publisher `muhib-beekun`; package metadata for Open VSX.
- STT lexicon cleanup (removed AmpliJob terms).
- Version packaging discipline (`teacher-*.vsix` per bump).

## [0.0.30] – [0.0.37]

STT polish, compile provider routing, and settings hardening.

- `teacher.compile.provider` (`auto` | `cloud` | `ollama`).
- `resolveInferenceConfig` + SecretStorage + workspace `.env` priority.
- STT polish Grok/Groq homophone handling in word-diff and codewords.
- `.vscodeignore` fixes (`.env` not packaged in VSIX).
- Web UI settings panel expansion.

## [0.0.15] – [0.0.29]

Browser Teacher UI iteration.

- Full **browser session** (`teacher-app.html`) replacing webview-only mic.
- Live compile, dual pane (Your Words | Agent Prompt), Send to Composer.
- Settings API (`/api/settings`), health endpoint, STT audit copy.
- Fix popover (yellow word → heard vs corrected).
- Compile modes: teacher / verbatim / polish.

## [0.0.8] – [0.0.14]

Mic sidecar and Cursor webview limitations.

- **Chrome/Edge sidecar** — Cursor embedded webviews cannot access microphone.
- `teacher.capture.sidecarPort` (default 3721).
- `Teacher: Open Web UI` opens `http://127.0.0.1:<port>/` in system browser.
- Mic toggle stability and webview lifecycle fixes.

## [0.0.1] – [0.0.7]

Initial extension scaffold through first dogfood stack.

- VS Code extension shell, `Teacher: Start Session`, dual-pane panel.
- Workspace context index (symbols, deps, basenames, codewords).
- STT providers: Web Speech, whisper.cpp, Deepgram BYOK.
- Homonym / dictionary pass with fix markers.
- Rules compiler + retraction detector.
- Ollama compile path; Composer handoff (autoPaste + autoSubmit).
- Product docs: `PLAN.md`, `ARCHITECTURE.md`, `TEACHER-COMPILER.md`, `CONTINUE-PROMPT.md`.

---

## Version index (0.0.1 – 0.0.44)

Each row is one packaged VSIX build during dogfood. Grouped entries above summarize the era.

| Version | Era |
|---------|-----|
| 0.0.1 – 0.0.7 | Extension scaffold, STT + rules compile, dual pane |
| 0.0.8 – 0.0.14 | Browser sidecar, mic in Chrome/Edge |
| 0.0.15 – 0.0.29 | Browser Teacher UI, live compile, settings API |
| 0.0.30 – 0.0.37 | Inference env, compile provider, STT polish fixes |
| 0.0.38 – 0.0.43 | Inference presets UI, SETUP docs, Open VSX metadata |
| 0.0.44 | Standalone publish prep, GitHub Release |
| 0.0.45 | Changelog, release workflow, browser docs, STT highlight fix |
| 0.0.46 | MIT license, public repo, Open VSX install docs |
