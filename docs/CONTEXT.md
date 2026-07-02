# Context — origin and product intent

This document captures the design conversation that spawned the **Teacher** project (June 2026). It is the canonical handoff for anyone (human or agent) picking up the repo cold.

---

## Problem statement

**Cursor’s built-in voice input** (≈3.1 Agents window, batch STT) is adequate for short agent prompts but weak for how power users actually work:

- **No workspace vocabulary** — mishears symbols, file names, stack terms (*Kafka* → *Cavka*, *That’s a feature* → *Teacher*).
- **Chat-only / inconsistent surfaces** — Agents window vs main Chat behave differently; terminal and editor are second-class.
- **Raw transcript to agent** — long, contradictory monologues; early wrong ideas weigh heavily; corrections (*I meant bottom right*, *ignore the regenerate part*) buried in the middle.
- **One-shot dictation** — speak once, imperfect text lands in the chat box, session ends; you **type by hand** to fix what voice got wrong instead of **speaking again**.
- **No structured brief** — agents parse better with Goal / Target / Constraints / Verification; voice users rarely speak in that shape on the first pass.

**Teacher the project** ships as an **Open VSX–compatible VS Code extension** (works in **Cursor**, VS Code, VSCodium). It is **not** a Cursor-only fork.

---

## Two-layer product

### Layer 1 — Context-aware STT

Before transcription, build a **`VoiceSessionContext`** from the active workspace:

- Open files, workspace symbols, `package.json` dependencies, path basenames, user glossary (`.codewords`).
- Pass to STT provider as `dictionary_context` / keywords / prompt (provider-specific).

Reduces homonym and proper-noun errors **upstream** via workspace symbols, dependencies, and `.teacher/codewords.txt`.

### Layer 2 — Teacher (intent compiler)

After a **multi-segment** dictation session, compile:

1. **Current intent** — what the agent should do now.
2. **Superseded (reference only)** — retracted or corrected earlier material; explicitly **do not act**.
3. **Structured brief** — Goal, Target, Constraints, Verification (optional auto-fill from workspace).
4. **Voice preservation** — reorder and label; do not ghostwrite into corporate prose.

User **previews and confirms** before text is inserted into Chat, Composer, Cmd+K, or the editor.

**Continuous session (core UX):** The input surface does **not** close after the first utterance. You keep talking — add detail, correct STT errors by voice (*"I meant frame seven not frame four"*), or retract (*"ignore the button part"*) — and Teacher **re-scaffolds** the compiled prompt from the **full session** each time. You should rarely need the keyboard until final send.

---

## Naming

**Teacher** emerged from a dictation mishear: *"That’s a feature I want"* → *"Teacher, that I want."* The mode name sticks: it **teaches the agent what you meant** after you talk your way to clarity.

Optional finalize cue: say *"Teacher"* or run command **Teacher: Compile Session**.

---

## Distribution and privacy defaults

| Choice | Decision |
|--------|----------|
| Marketplace | **Open VSX** primary; Microsoft Marketplace optional |
| Editor targets | Cursor-first docs; API is standard VS Code extension host |
| Inference default | **Local-first where possible**; BYOK cloud as fallback |
| Codebase index | **Local only**; derived term lists leave the machine only if user opts into cloud STT/compile |
| Repo visibility | **Private** until extension MVP and inference story are settled |

---

## Gap vs existing tools

| Tool | Workspace index | Intent compile | Open extension |
|------|-----------------|----------------|----------------|
| Cursor native STT | No | No | N/A |
| Wispr / Willow / Voibe | Limited / manual | Polish prose | No |
| VS Code Whisper extensions | Static prompt | No | Yes |
| vscode-voice-scribe | Manual keyterms | Live rewrite | Yes |
| **Teacher (this project)** | Auto symbol/deps index | Supersession + brief | Yes |

---

## Conversation fork lineage

This repo was forked from a chat thread that covered:

1. Layered STT pipeline ideas (`VoiceSessionContext`, homonym pass, codewords).
2. VS Code extension outline (mic capture constraints, Open VSX, provider abstraction).
3. **Teacher mode** — re-drive dictation after *ignore that* / *I meant this*; structured agent prompt; preview UX.
4. **Inference strategy** — self-hosted, Hugging Face, BYOK; vectorless codebase context.
5. **Inference strategy** — self-hosted Ollama, BYOK cloud APIs; see [SETUP.md](./SETUP.md).

Prior art in founder transcripts (correction patterns observed):

- *"I meant 5173 btw"*
- *"when I said bottom right, I meant that"*
- *"ignore the regenerate part, keep the top section"*
- *"Most of it's fine… I'm open to… tell me what you think before we make any edits"*
- Rambling multi-topic prompts later refined into actionable mockup edits

---

## Non-goals (v0)

- Replacing Cursor’s agent runtime or private APIs.
- Cloud-hosted founder transcript storage without explicit export/consent workflow.
- Fine-tuning a public model on private chats without redaction pipeline.
- Vector database requirement for codebase context (see [CONTEXT-INDEX.md](./CONTEXT-INDEX.md)).

---

## Next implementation milestones

1. **Spike:** workspace symbol extractor → Deepgram/Whisper prompt A/B on homonym clip.
2. **Extension shell:** Open VSX manifest, webview mic, insert-at-cursor.
3. **Teacher v1:** rule-based supersession + brief template + preview panel.
4. **Inference adapter:** local Ollama + HF Inference API + BYOK OpenAI/Deepgram.
5. **Dogfood:** export anonymized (session, brief) pairs only with explicit opt-in (local, gitignored).
