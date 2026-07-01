# Teacher — product plan (canonical)

**Last updated:** June 2026  
**Repo:** [AmpliJob/Teacher](https://github.com/AmpliJob/Teacher) (private)  
**Status:** Full v1 stack — mic session, whisper/Deepgram STT, homonym pass, Ollama/rules compile, Composer Send.

This document consolidates founder intent, Cursor pain points, AmpliJob UI reference, inference/training posture, and the implementation roadmap. When other docs disagree, **this plan wins** until explicitly revised.

---

## One sentence

**Teacher is a VS Code extension (Cursor-first) that keeps a voice session open, biases STT with workspace vocabulary, and re-scaffolds a structured agent brief from everything you said — without dumping raw transcript into chat until you Send.**

---

## Problem (why Cursor native STT is not enough)

Founder experience dictating to Cursor today:

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
4. **Live re-scaffold** — right pane updates after each segment (`teacher.compile.live`, default on).
5. **Explicit Send gate** — like AmpliJob “Continue to Card”; compiled brief only, not raw transcript (unless verbatim mode).

---

## Dual pane — literal behavior (AmpliJob reference)

Reference mockup: `environment/docs/product/mockups/evidence-intake-journey-mockup.html`

**Shared tail · Facts frames 2 & 2b** (mobile stacks vertically; Teacher uses side-by-side on desktop):

| Layer | AmpliJob (Facts frame 2) | Teacher (left / right pane) |
|-------|----------------------------|-----------------------------|
| **Audit** | Collapsible “What you said · full transcript” | **Left** — segmented transcript, STT fix highlights |
| **Inspect fix** | Frame 2b — tap yellow word → heard vs corrected | Click term → heard / wrote / override |
| **Scaffold** | Included / Off-topic fact rows, toggles, coach hints | **Right** — Goal, Target, Constraints, Verification |
| **Superseded** | Off-topic saved to evidence, not this card | Reference-only block — do not implement |
| **Send** | Continue to Card | Send → clipboard / paste into chat |
| **Clarify loop** | Fact drill-in → voice or type clarification | Append segment without restarting session |

**Default:** scaffolding **on** in Teacher mode (matches AmpliJob Facts pattern). Opt out via `teacher.compile.mode: verbatim` for users who only want joined text with retractions.

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

**Not required for v0:** custom fine-tuned model, hosted Teacher endpoint, Hugging Face training jobs.

See [INFERENCE.md](./INFERENCE.md) for tier matrix and adapter interfaces.

---

## Training and remote dependencies

**Training is not a launch blocker.**

| Use case | When | Approach |
|----------|------|----------|
| Retraction detection | v0 | Regex rules (*ignore that*, *I meant*) |
| Brief structure | v0 | Template + optional Ollama |
| Pattern tuning | Post-ship | `tools/analyze-transcripts.ts` on Cursor `agent-transcripts/*.jsonl` |
| Fine-tune compile model | Later | LoRA on 3B instruct; private HF dataset; manual redaction gate |

Transcript export: **never automatic**; output gitignored; opt-in only. See [TRAINING-DATA.md](./TRAINING-DATA.md).

**What phones home in local-first mode:** nothing. Index builds locally. Cloud STT/compile only if user configures BYOK.

**Paid path through AmpliJob:** future Tier E — explicit opt-in hosted inference; adapter interface designed now, built when needed.

---

## Distribution and privacy

| Choice | Decision |
|--------|----------|
| GitHub | **Private** (AmpliJob/Teacher) |
| Marketplace | Open VSX primary; VS Code Marketplace optional |
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
- [x] Homonym pass + AmpliJob-style fix markers (tap yellow word → heard)
- [x] STT: Web Speech, whisper.cpp, Deepgram BYOK (`teacher.stt.provider`)
- [x] Compile: rules + Ollama auto (`teacher.compile.provider`)
- [x] Composer handoff (Option A: autoPaste + autoSubmit)
- [x] Workspace context index
- [x] `tools/analyze-transcripts.mjs`

### Later

- Open VSX publish
- OpenAI Whisper STT adapter
- Hosted Teacher inference tier
- Fine-tune pipeline

### Deferred

- Vector RAG plugin
- Hosted Teacher inference tier
- Fine-tune pipeline and HF dataset
- Open VSX publish (after dogfoodable v0)
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
| `teacher.compile.live` | `true` | Re-scaffold after each segment |
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

Lexical spike (no VS Code):

```powershell
npm run dump-context
```

---

## Related AmpliJob work

Shared concepts with `environment` repo:

- Voice STT context seeding — backlog items **39–42**
- Evidence-and-atoms §9 — layered STT pipeline
- Tell story / Facts UI — `evidence-intake-journey-mockup.html` Shared tail frames 2–2b

Future: possible shared npm package `@amplijob/voice-context` for compatible `VoiceSessionContext` shapes.

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
| [INFERENCE.md](./INFERENCE.md) | Local / BYOK / HF tiers |
| [TRAINING-DATA.md](./TRAINING-DATA.md) | Transcript export (later) |
| [CONTINUE-PROMPT.md](./CONTINUE-PROMPT.md) | Agent session handoff prompt |
