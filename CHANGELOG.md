# Changelog

All notable changes to **Teacher** are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Version numbers match `package.json` and `teacher-<version>.vsix` builds.

## [0.1.2] - 2026-07-07

### Added

- **Update awareness** — `Teacher: Check for Updates` and `Teacher: Update from Open VSX` query Open VSX, compare semver, and assist VSIX install with reload prompt.
- **Host & updates** settings section — extension host (local/remote), install channel hint, workspace `.env` override status, remote vscode.lm guidance, and in-UI check/update actions.

### Changed

- Settings status block shows update state and extension host alongside version and compile info.
- Docs (`README`, `SETUP`, `AGENTS`) explain Open VSX/VSIX manual updates, remote-host install, and troubleshooting stale behavior after upgrade.

### Added (pending next release)

- **CONFIGURATION.md** — update commands, remote-host scope, pin-state best effort, reload requirement, and troubleshooting.
- **Pin-state detection** — reads profile `extensions.json` when available; tries to clear pin before Open VSX install; shows pin hint in Host & updates.
- **Update integration tests** — mocked Open VSX fetch, VSIX download, and install command flow.
- **Open VSX 404 retry** — one automatic retry when `/latest` 404s shortly after publish.
- Status block shows separate **Installed** and **Latest** version lines when known.

## [0.1.1] - 2026-07-06

### Changed

- **Clear session is instant** — session panes reset immediately; workspace index refresh runs in the background without blocking the UI.
- **Tiered workspace index** — pin (open files), warm (recently closed symbols, LRU cap), cold (basename-only, lazy), and eviction under hard caps. Tab switches re-rank from cache instead of full workspace rescans. File saves and create/delete/rename events patch the cache incrementally when index rebuild mode is `onFileChange`.

## [0.1.0] - 2026-07-04

The first minor release — a ground-up rewrite of the web UI, new local inference support, comprehensive testing, and dozens of bug fixes.

### Highlights

- **Full Preact rewrite** of the web UI — the 1,776-line monolithic HTML/CSS/JS file is now 21 focused TypeScript components with reactive state management.
- **Local inference first** — Ollama, llama.cpp, LM Studio, and vLLM are first-class citizens, listed before cloud providers.
- **53 unit tests + 17 E2E tests** — Vitest for components/state/API, Playwright for layout and accessibility.
- **Compact waveform ring** around the mic button replaces the full-width waveform bar.
- **Responsive layout** scales proportionally on tall viewports instead of capping the capture area.

### Added

- **Preact component architecture** — 21 components: TopBar, SettingsPanel (7 collapsible sections), CapturePanel, TranscriptPane, BriefPane, FixPopover, MicButton, Waveform, InferenceSection, SpeechSection, GlossarySection, WhisperSection, CompileSection, SendSection, AdvancedSection.
- **Reactive state** via `@preact/signals` — no manual DOM manipulation; centralized signal store (`state.ts`).
- **Centralized API layer** (`api.ts`) for all frontend-to-backend communication.
- **Shared types** (`src/shared/types.ts`) between backend and frontend — `AppSettingsView`, `SessionSnapshot`, `RuntimeInfo`, `HealthInfo`.
- **esbuild frontend pipeline** — bundles to `media/teacher-app.js` + `media/teacher-app.css` (~57 KB + ~16 KB).
- **Test connection button** in Inference settings — lightweight single-word ping to the configured provider, reports OK/fail with latency inline.
- **Local inference presets** — llama.cpp server, LM Studio, vLLM added alongside Ollama. All local providers skip API key prompts.
- **Provider/model ordering** — local/open-source options listed first (alphabetical), then cloud/subscription (alphabetical).
- **Compact waveform ring** — circular frequency visualizer pulses around the mic icon, replacing the full-width waveform bar.
- **Vitest unit tests** (53 tests) covering state management, API layer, and all major components including MicButton reactivity.
- **Playwright E2E tests** (17 tests) covering settings visibility, layout, keyboard navigation, and ARIA accessibility.
- **Accessibility** — `role="dialog"` + `aria-modal` on settings, focus trapping with Tab/Shift+Tab, `aria-live="polite"` on status, `aria-label` on all icon buttons, `role="region"` on panes.
- **Local Whisper setup** in Teacher Settings — step-by-step instructions, browse binary/model, find-on-disk, test CLI, status badge. [WHISPER-SETUP.md](./docs/WHISPER-SETUP.md) with links to whisper.cpp releases and Hugging Face models.
- **AGENTS.md** — AI agent configuration guide for Cursor, Copilot, and other AI agents to configure Teacher via VS Code settings without `.env` lock issues.
- **Trace log** (`.teacher/trace.jsonl`) — every LLM call logged with provider, model, latency, tokens, and status. Auto-rotates at 500 lines.
- **Your glossary editor** in Settings — add/remove codewords (`.teacher/codewords.txt`) with +/−; index rebuilds on save.
- `tsconfig.web.json`, `esbuild.web.mjs`, `vitest.config.ts` build/test configuration.
- `npm run test:unit`, `npm run build:web`, `npm run build:web:dev` scripts.

### Changed

- **`.env` is no longer the primary config path.** VS Code settings and the Teacher Settings UI are preferred. `.env` vars now warn that they lock the Settings UI fields.
- **Settings UI redesigned** — split by concern (collapsible sections), unified type scale and control sizing, cloud provider combobox with presets (OpenAI, xAI, Groq, DeepSeek, OpenRouter, Together, Fireworks, Mistral, Cerebras, Gemini), masked API key save.
- **Settings status** shows effective inference configuration from workspace `.env` (overrides VS Code settings) separately from the active compile provider.
- **Responsive layout** — proportional grid rows on viewports taller than 1100px (capture ≈ 23%, each pane ≈ 38%). Below that threshold, capture auto-sizes to content. Horizontal layout uses proportional grid columns instead of fixed pixel widths.
- **"Clear session"** acts immediately without a confirmation dialog.
- Speech settings clarify hear-time biasing (Whisper/Deepgram only) vs post-hoc correction (all providers).
- Renamed jargon labels: "Dictionary homonym pass" → "Fix misheard words", "Polish STT via LLM" → "AI-powered cleanup".
- Merged "Connection" + "Advanced" settings into a single Advanced section.
- Trimmed status block from 8 lines to 6 — dropped Server URL and STT auto-corrections count.

### Fixed

- **Mic button spinner stuck after processing** — `micProcessing` state centralized in signals module; direct signal writes replace closure-captured wrappers. Spinner reliably clears when compile finishes.
- **Cancel button stays enabled after recording** — `recordingArmed` signal was not reset after a successful recording cycle, leaving the cancel button active with no session in progress.
- **Corrections not reflected in compiled Goal** — when the user edits a segment or speaks a correction, the compiler now runs fresh (no anchoring to the prior brief that contained errors). Edited segments are flagged `(edited)` in the compile prompt. New system prompt rule explicitly instructs the model to replace original wording with corrections.
- **Stale `.env` ghost lock** — emptying or removing `.env` lines now clears those values from the extension. Previously, keys set from `.env` persisted in `process.env` for the entire session. A file watcher now re-parses `.env` on disk changes immediately.
- **Browser caching** — Web UI responses send `no-cache` headers so the browser loads the latest version after extension updates.
- **Settings field visibility** — Provider selection controls which fields are visible: local providers hide API key; cloud providers hide URL; Custom shows everything. Model dropdown always visible.
- **CSS specificity issues** eliminated — Preact controls rendering via conditional JSX instead of `hidden` attributes.
- **Runtime crash** from duplicate `const baseUrlEl` declaration removed.
- **Waveform canvas** internal resolution matches display size × device pixel ratio for crisp rendering on high-DPI screens.

## [0.0.59] - 2026-07-03

### Fixed
- **STT lexicon:** common mishearings `TV code` / `TVs coded` → VS Code.
- **Dictionary homonym pass** default matches settings (`true`).

### Changed
- **Compile prompt** includes meta/UI correction segments in Goal synthesis.
- **Whisper** initial prompt uses up to 800 chars of workspace `stt_prompt`.
- **Send to chat** tries VS Code Copilot focus commands when Cursor composer is unavailable.
- **Compile log** reports `segments`, `sessionLog`, and `goalChars` after each brief.
- **CONFIGURATION.md** documents STT biasing layers (Web Speech vs Whisper vs Deepgram).

## [0.0.58] - 2026-07-03

### Fixed
- **Session log in compiled brief** backfills from all voice segments when the LLM returns a truncated `## Session` block.

### Changed
- README includes an in-app screenshot (Your Words + Agent Prompt dual pane).
- Optional [GitHub Sponsors](https://github.com/sponsors/Muhib-Beekun) link via `package.json` `sponsor` field (Open VSX / VS Code extension pages).

## [0.0.57] - 2026-07-03

### Added
- **Host-aware compile routing** for remote SSH/WSL/container extension hosts: `auto` prefers Ollama/cloud and skips unreliable `vscode.lm` unless `teacher.compile.vscodeLm.allowOnRemote` is true. Empty `vscode.lm` responses trigger a single fallback to cloud or Ollama with explicit output-channel logs.

### Fixed
- **Web UI typing area** on tall narrow viewports: capture column no longer clips the live-text box; flex layout keeps speak/type input inside the panel with internal scroll.

### Known issues
- **Remote workspaces (SSH, WSL, dev containers):** `vscode.lm` (GitHub Copilot) often returns empty compile output on the remote extension host. **Compile and STT polish require cloud inference (`INFERENCE_API_KEY`) or Ollama on the remote side** — local Copilot alone is not sufficient for SSH-remote sessions. Documented in README and `docs/SETUP.md`.

## [0.0.56] - 2026-07-02

### Fixed
- **Compile validation** parses LLM output before rejecting it, so near-valid briefs (heading case, preamble, fences, `Goal:` labels) no longer fail with "Compile output missing ## Goal section". One bounded reformat retry and clearer validation logs in the Teacher output channel.

## [0.0.55] - 2026-07-02

### Added
- **VS Code LM** compile provider (`teacher.compile.provider: vscode-lm`) uses GitHub Copilot models via `vscode.lm` (no separate API key). Auto falls back to VS Code LM when Ollama and cloud are unavailable.

## [0.0.54] - 2026-07-02

### Changed
- Maintainer-only docs (`PLAN.md`, `CONTEXT.md`, `CONTINUE-PROMPT.md`, `ship-changes.mdc`) kept local via `.gitignore`; README docs table is user-facing only.
- `.cursor/` and `.vscode/` gitignored; no longer bundled in VSIX.

## [0.0.53] - 2026-06-30

### Changed
- **Finish speaking** auto-recompiles the agent prompt again (`teacher.compile.live`, default on).
- **Blue glow** on the refresh button only when **Your Words** are edited manually (segment text or STT revert), not after each mic pause.
- Glow clears after a successful refresh compile (new agent prompt version).
- README origin story and handoff docs updated in founder voice.

## [0.0.52] - 2026-07-02

### Changed
- Agent prompt **only recompiles on Refresh** — adding/editing segments marks the brief stale (blue glow on refresh button).
- Refresh re-scaffolds from **all segments in Your Words** (full session history).
- Default `teacher.compile.live` is **false** (legacy auto-compile opt-in only).

## [0.0.51] - 2026-07-02

### Fixed
- Restore collapsible agent prompt stack: **current** (open) + **prior** versions in `<details>` rows, matching pre-0.0.49 UX.

## [0.0.50] - 2026-07-02

### Fixed
- Restore prior-brief context in compile (live compile and segment updates). Manual **Refresh** still uses a fresh compile without the prior brief anchor. Version numbers unchanged.

### Changed
- Reverts the 0.0.49 compile behavior that dropped prior brief from the LLM prompt.

## [0.0.49] - 2026-07-02

### Added
- **Speech: network** (and related errors) show unsupported-browser banner — including Cursor's built-in browser.
- Agent prompt **version numbers** increment on each compile (`Agent Prompt · vN`, handoff `## Agent prompt (vN)`).

### Changed
- Compile no longer merges the previous agent brief into the LLM prompt (each version is synthesized from session segments only).

*(Superseded in 0.0.50 — prior brief restored for live compile; versioning kept.)*

## [0.0.48] - 2026-07-02

### Changed
- Mic button and Cancel control centered in the capture column.
- Removed green "Microphone ready" banner when Chrome/Edge is detected.

## [0.0.47] - 2026-06-30

### Added
- Chrome/Edge browser detection — mic UI hidden in unsupported browsers.
- Refresh spinner and brief-pane loading state during recompile.

### Fixed
- Manual **Refresh** runs a fresh compile (no prior-brief anchor).
- **Revert** on STT yellow highlights triggers recompile when a compile provider is configured.
- Segment edits show recompile progress in the UI.

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

## Version index

Each row is one packaged VSIX build. Grouped entries above summarize the era.

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
| 0.0.47 | Mic browser gate, fresh refresh compile, revert → recompile |
| 0.0.48 | Mic/cancel centering; remove green ready banner |
| 0.0.49 | Speech network → browser warning; agent prompt versioning |
| 0.0.50 | Restore prior-brief in compile; keep prompt versioning |
| 0.0.51 | Collapsible current + prior agent prompt versions |
| 0.0.52 | Manual refresh-only compile; blue glow when stale |
| 0.0.53 | Auto-recompile on pause; refined blue glow |
| 0.0.54 | Gitignore housekeeping; maintainer docs local-only |
| 0.0.55 | VS Code LM (Copilot) compile provider |
| 0.0.56 | Compile validation resilience |
| 0.0.57 | Remote host compile routing; tall viewport clip fix |
| 0.0.58 | Session log backfill; README screenshot |
| 0.0.59 | STT lexicon; compile prompt corrections; Whisper tuning |
| **0.1.0** | **Preact rewrite, local inference, testing, responsive layout** |
