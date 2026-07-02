# Teacher — product plan (canonical)

**Author:** Muhib Beekun  
**Repo:** [Muhib-Beekun/Teacher](https://github.com/Muhib-Beekun/Teacher)  
**Status:** Full v1 stack — mic session, whisper/Deepgram STT, homonym pass, Ollama/rules compile, Composer Send.

This document consolidates founder intent, Cursor pain points, dual-pane UX, inference/training posture, and the implementation roadmap. When other docs disagree, **this plan wins** until explicitly revised.

---

## One sentence

**Teacher is a VS Code extension (Cursor-first) that keeps a voice session open, biases STT with workspace vocabulary, and re-scaffolds a structured agent brief from everything I said in the session — without dumping raw transcript into chat until Send.**

---

## Problem (why Cursor native STT falls short for my workflow)

How I dictate to Cursor today:

| Pain | Cursor behavior | Teacher target |
|------|-----------------|----------------|
| **Latency + unstable text** | Partial STT wipes/replaces words in the chat box while catching up | Segments append to session audit pane; debounced compile to right pane; chat untouched |
| **Stop kills the session** | After Stop, text is in the box; no more TTS for the same prompt | Stop = end of *chunk*, not session; review, append, clarify, Send when ready |
| **No codebase vocabulary** | Generic STT; symbols, paths, project terms misheard | Vectorless workspace index → STT keyword/prompt biasing + Target in brief |
| **Raw transcript to agent** | Long, contradictory monologue lands in chat | Scaffolded brief (Goal / Target / Constraints / Verification) + superseded block |

---

## Product shape — two layers

### Layer 1 — Context-aware STT

Before and during transcription, build **`VoiceSessionContext`** locally:

- Open files, workspace symbols (`executeDocumentSymbolProvider`)
- `package.json` dependencies (and shallow monorepo packages)
- Path basenames (capped scan, exclude globs)
- User glossary: `.teacher/codewords.txt`

Output: `dictionary_context[]`, `targetFiles[]`, `stt_prompt` — passed to STT provider as keywords/prompt. **No vector RAG in v0.**

**Implemented:** `src/context/WorkspaceContextIndex.ts`, `teacher.rebuildIndex`, debounced refresh on save/tab change.

### Layer 2 — Teacher compiler

Multi-segment dictation with voice corrections:

- Retractions: *ignore that*, *scratch that*, *don't do the … part*
- Corrections: *I meant …*, *actually …*, *what I really want is …*
- Scope narrows: *only …*, *not the list view*

After each segment (debounced while streaming): **re-scaffold** the agent brief from full session + workspace context. User previews, then **Send** — never auto-insert into Cursor chat.

**Not yet implemented:** `RetractionDetector`, rules compiler, optional LLM compile adapter.

---

## UX contract (non-negotiable)

1. **Continuous session** — speak → stop → review → speak again → … → Send.
2. **Dual pane default** — left: your words (audit); right: agent prompt (scaffold).
3. **Hold chat box** — Cursor chat stays empty until explicit Send (`teacher.session.holdChatBox`, default on).
4. **Live re-scaffold on mic pause** — right pane updates after each spoken segment (`teacher.compile.live`, default on).
5. **Manual edit hint** — editing words in **Your Words** (or reverting an STT fix) marks the brief stale; refresh button glows until recompile succeeds.
6. **Explicit Send gate** — compiled brief only, not raw transcript (unless verbatim mode).

---

## Dual pane — literal behavior

**Two-layer contract** (audit transcript + scaffolded brief; side-by-side on desktop):

| Layer | Role | Teacher pane |
|-------|------|----------------|
| **Audit** | Full spoken transcript | **Left** — segmented transcript, STT fix highlights |
| **Inspect fix** | Tap yellow word → heard vs corrected | Click term → heard / wrote |
| **Scaffold** | Structured agent task | **Right** — Goal, Target, Constraints, Verification |
| **Superseded** | Retracted ideas | Reference-only block — do not implement |
| **Send** | Deliver to agent | Send → clipboard / paste into chat |
| **Clarify loop** | Add speech without restart | Append segment in same session |

**Default:** scaffolding **on** in Teacher mode. Opt out via `teacher.compile.mode: verbatim` for joined text with retractions only.

---

## Compile modes

| Mode | Default | Behavior |
|------|---------|----------|
| `teacher` | **Yes** | Structured brief + workspace Target + superseded block |
| `verbatim` | No | Join current-intent segments; retractions only; no restructuring |
| `polish` | No | Deferred — light prose cleanup for non-agent surfaces |

Setting: `teacher.compile.mode` (to be added to `package.json`; documented here first).

---

## Inference strategy

**Principle:** local-first, cloud-optional, always BYOK-capable. **No shared Teacher API key in v0.** No telemetry SDK in v0.

Two separate jobs:

| Job | v0 approach | Local option | BYOK fallback |
|-----|-------------|--------------|---------------|
| **STT** | Text input stub | whisper.cpp / faster-whisper | Deepgram, OpenAI Whisper, HF |
| **Compile** | Rules + template | Ollama (Qwen 7B instruct) | OpenAI mini, Haiku, HF Inference API |

**Fallback order when local unavailable:**

1. BYOK cloud STT (with workspace keywords)
2. BYOK cloud compile (structure only)
3. **Rules-only Teacher** — still works: template + retraction regex + Target from index

**Not required for v0:** custom fine-tuned model or hosted Teacher endpoint. Cloud and local Ollama paths are documented in [SETUP.md](./SETUP.md).

---

## Remote dependencies

**Local-first by default.** Index builds locally. Cloud STT/compile only if the user configures an API key or runs Ollama locally.

**Paid hosted inference (later):** optional Tier E — explicit opt-in only.

---

## Distribution and privacy

| Choice | Decision |
|--------|----------|
| GitHub | [Muhib-Beekun/Teacher](https://github.com/Muhib-Beekun/Teacher) (public, MIT) |
| Marketplace | [Open VSX](https://open-vsx.org/extension/muhib-beekun/teacher) primary; VS Code Marketplace optional |
| Editor targets | Cursor-first; standard VS Code extension APIs only |
| Secrets | VS Code `SecretStorage` only |
| Cursor private APIs | **None** |
| Workspace index | Local only; derived term lists leave machine only with cloud STT/compile |

---

## Implementation state

### Done

- [x] Design docs
- [x] Extension shell + dual-pane session panel (mic toggle, Type fallback)
- [x] Rules compiler + retraction detector
- [x] Homonym pass + fix markers (tap yellow word → heard)
- [x] STT: Web Speech, whisper.cpp, Deepgram BYOK (`teacher.stt.provider`)
- [x] Compile: rules + Ollama auto (`teacher.compile.provider`)
- [x] Composer handoff (Option A: autoPaste + autoSubmit)
- [x] Workspace context index

### Later

- VS Code Marketplace listing (optional; Open VSX is primary)

### Done (distribution)

- [x] `CHANGELOG.md` — Keep a Changelog, versions 0.0.1–0.0.45
- [x] MIT license + public GitHub repo
- [x] Open VSX listing (after ECA + `publish:ovsx`)

### Deferred

- Vector RAG plugin
- Hosted Teacher inference tier
- Bundled whisper binaries per platform (document user install first)

---

## Commands (reference)

| Command | Purpose |
|---------|---------|
| `teacher.startSession` | Open dual-pane panel; mic ready |
| `teacher.appendSegment` | Add STT chunk; live re-scaffold |
| `teacher.compile` | Force re-scaffold |
| `teacher.send` | Copy/send **compiled** brief (not raw transcript) |
| `teacher.dictateHere` | One-shot verbatim to cursor (bypass session) |
| `teacher.endSession` | Close panel without send |
| `teacher.rebuildIndex` | Force context index refresh |

---

## Settings (reference)

| Setting | Default | Notes |
|---------|---------|-------|
| `teacher.preview.layout` | `dual` | `single` = compiled only, transcript collapsible |
| `teacher.compile.live` | `true` | Re-scaffold after each mic pause |
| `teacher.compile.debounceMs` | `800` | While streaming partial STT |
| `teacher.session.holdChatBox` | `true` | Don't insert into chat until Send |
| `teacher.context.maxTerms` | `200` | Cap on `dictionary_context` |
| `teacher.context.excludeGlobs` | node_modules, .git, dist, out, .env* | Basename scan exclusions |
| `teacher.compile.mode` | `teacher` | Planned — `teacher` \| `verbatim` \| `polish` |
| `teacher.stt.provider` | `local` | Planned — local \| deepgram \| openai \| huggingface |
| `teacher.compile.provider` | `local` | Planned — local \| ollama \| huggingface \| openai |

---

## How to run (developer)

```powershell
cd C:\Users\Public\Projects\Teacher
npm install
npm run build
```

Cursor → **Run and Debug** → **Run Teacher Extension** → in Extension Development Host:

1. **Teacher: Rebuild Context Index**
2. **Teacher: Start Session**
3. **Teacher: Append Segment** (text stub until STT wired)
4. **Teacher: Send**

Lexical spike (no VS Code): use workspace index via **Teacher: Rebuild Context Index**.

---

## Related prior work

Dual-pane voice UX patterns (audit + scaffold + superseded) informed early Teacher design. This repo is a standalone extension with its own roadmap.

---

## Success criteria for v0 dogfood

- [ ] Stop after speaking does **not** end session; can append to same prompt
- [ ] Left pane shows full audit trail; right pane shows scaffolded brief
- [ ] *Ignore that* / *I meant* update brief, not raw concatenation
- [ ] Workspace terms appear in STT biasing and Target section
- [ ] Send copies compiled brief; Cursor chat was not mutated during session
- [ ] Works with **zero** outbound API calls (rules-only + text/whisper local)

---

## Doc index

| Doc | Role |
|-----|------|
| **PLAN.md** (this file) | Canonical product + roadmap |
| [CONTEXT.md](./CONTEXT.md) | Origin, wedge, naming |
| [TEACHER-COMPILER.md](./TEACHER-COMPILER.md) | Session model, retraction rules, output templates |
| [CONTEXT-INDEX.md](./CONTEXT-INDEX.md) | Vectorless indexing spec |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Extension layout, commands, package structure |
| [SETUP.md](./SETUP.md) | First-time setup |
| [RELEASES.md](./RELEASES.md) | VSIX build and GitHub Releases |
| [CONFIGURATION.md](./CONFIGURATION.md) | Settings reference |
| [CONTINUE-PROMPT.md](./CONTINUE-PROMPT.md) | Agent session handoff prompt |
