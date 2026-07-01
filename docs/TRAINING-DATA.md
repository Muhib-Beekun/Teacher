# Training data — Cursor conversations as supervision

How founder/agent transcripts become useful signal for Teacher — without careless privacy exposure.

---

## Thesis

You dictate and correct constantly in Cursor agent chats. Those threads contain:

- **Rambling → refined** intent patterns
- **Explicit corrections** (*I meant*, *ignore that*, *bottom right not bottom left*)
- **Domain vocabulary** in natural speech
- **Structured tasks** that agents later decompose into files and commits

That is high-quality **supervision data** for:

1. Retraction detector tuning (rules + classifier).
2. Teacher compile model fine-tune (small instruct LM).
3. STT `dictionary_context` defaults per project type.
4. Eval sets: “given this session, brief should match founder-approved output.”

**You are the human in the loop providing labels every time you confirm a preview or edit a brief.**

---

## Where transcripts live (local)

Cursor agent transcripts on this machine:

```text
C:\Users\Public.DESKTOP-6ORC2C9\.cursor\projects\<workspace-slug>\agent-transcripts\
  <uuid>.jsonl
```

Each line is JSON: `role`, `message.content[]` with `type: text` user queries and assistant replies.

**Important:** Transcripts may contain secrets, paths, business strategy, and third-party content. Treat as **PII / confidential** until redacted.

---

## What to extract (not raw dump)

Do **not** fine-tune on full JSONL blobs. Extract paired examples:

| Export type | Input | Label |
|-------------|-------|-------|
| **Correction pair** | User message containing retraction phrase | Subsequent user message or final accepted instruction |
| **Session → brief** | Multi-message user arc in one task | Final “execute” message or git commit summary |
| **STT homonym** | Suspected mishear in user text | Corrected term in same or next message |
| **Target inference** | User mention of “frame 4”, “mockup” | File paths from assistant `Write` tool in same thread |

---

## Export pipeline (planned tool)

`teacher-export` CLI or extension command:

```text
agent-transcripts/*.jsonl
    → filter user role only
    → detect correction patterns (regex + optional LLM)
    → redact (emails, API keys, absolute paths → placeholders)
    → emit data/exports/sessions.jsonl
```

Example export row:

```json
{
  "source": "agent-transcript",
  "source_id": "21b535c6-…",
  "segments": ["…frame four regenerate…", "ignore regenerate keep top…"],
  "compiled_brief": "## Goal\n…",
  "labels": { "retractions": 1, "confirmed_by_user": true },
  "redaction_version": 1
}
```

**Default:** export tool lives in this repo; **never runs automatically**; output gitignored.

---

## Redaction rules (before any train or upload)

- Strip `gho_*`, `sk-*`, JWT-like strings, `.env` values.
- Replace home path prefix with `$HOME` or `<workspace>`.
- Optional: drop messages mentioning specific employer JD URLs.
- Manual review gate before HF upload or fine-tune job.

---

## Using Hugging Face for training (later)

| Stage | Approach |
|-------|----------|
| **Dataset** | Private HF dataset repo `AmpliJob/teacher-sessions-redacted` |
| **Fine-tune** | LoRA on 3B instruct (Qwen/Llama) — compile task only |
| **Eval** | Held-out transcripts; metric: brief section overlap + retract recall |
| **Ship** | GGUF in repo releases OR `ollama create` Modelfile |

Custom model is **optional acceleration**, not required for v1.

---

## Continuous learning (product loop)

After ship:

1. User compiles session → edits preview → sends.
2. If `teacher.telemetry.exportOptIn` (local only): append `(segments, final_text)` to `.teacher/sessions/`.
3. Periodic local export script builds training JSONL.
4. User explicitly runs `teacher train` or uploads to HF when ready.

No cloud collection without opt-in.

---

## Ethical / legal notes

- Transcripts are **your** data; do not train shared models on other users’ sessions without consent.
- If Teacher becomes a public extension, default **no** transcript upload; on-device learning only.
- Open-sourcing the **tooling** (export + redact) is fine; open-sourcing **datasets** is a separate decision.

---

## Observed founder patterns (from environment transcripts)

Useful for rule authoring and eval scripts:

- Mid-stream **scope refinement** after seeing assistant output (*"Most of it's fine… when I said X I meant Y"*)
- **Port / number corrections** (*I meant 5173*)
- **Layout disambiguation** (*tile view vs list view*, *bottom right*)
- **Process gates** (*tell me what you think before we make any edits*)
- Long mockup feedback messages that are really **10 tickets in one utterance** → Teacher should split or structure

Scripts in `tools/analyze-transcripts/` (future) can count pattern frequency across all `agent-transcripts/` trees under `.cursor/projects/`.

---

## Related docs

- [TEACHER-COMPILER.md](./TEACHER-COMPILER.md) — what labels should look like
- [INFERENCE.md](./INFERENCE.md) — where fine-tuned weights run
- AmpliJob `evidence-and-atoms.md` §9.3 — atom correction as signal (parallel idea for evidence lane)
