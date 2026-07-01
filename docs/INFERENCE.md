# Inference strategy — local, BYOK, Hugging Face

How Teacher runs STT and compilation without locking you to one vendor.

---

## Design principle

**Local-first, cloud-optional, always BYOK-capable.**

You should be able to run a useful session with **no outbound API calls** (mic → local Whisper → local small LLM for Teacher compile). When quality or speed needs cloud, you bring your own key — Teacher never ships with a shared paid backend.

---

## Two inference jobs

| Job | Input | Output | Latency target |
|-----|--------|--------|----------------|
| **STT** | Audio PCM | Verbatim segments + word timestamps | Realtime or <3s batch |
| **Teacher compile** | Segments + retractions + context | Structured brief + superseded block | 1–5s |

These can use **different providers** (e.g. local Whisper + cloud compile, or all-local).

---

## Tier matrix

| Tier | STT | Compile | When |
|------|-----|---------|------|
| **A — Full local** | faster-whisper / whisper.cpp | Ollama (Qwen, Llama, Mistral) | Privacy, offline, zero marginal cost |
| **B — HF local** | `openai/whisper-large-v3` via transformers | HF small instruct model | GPU box at home |
| **C — HF Inference API** | HF serverless STT endpoint | HF serverless LLM | BYOK HF token; no self-host |
| **D — Commercial BYOK** | Deepgram, OpenAI Whisper | OpenAI / Anthropic / Groq | Best realtime STT; familiar keys |
| **E — Hosted (later)** | Teacher-managed GPU | Only if self-host fails | Last resort; explicit opt-in |

**v1 target:** Tier **A + D** (local default + BYOK cloud fallback).

---

## Hugging Face — what it’s good for

HF is a **model catalog + runtime**, not one model. Teacher can use it three ways:

### 1. Local pipeline (recommended for “run my own inference”)

```text
transformers / llama.cpp / vLLM / Ollama pulling from HF hub
```

| Role | Example models | Notes |
|------|----------------|-------|
| STT | `openai/whisper-large-v3`, `distil-whisper/distil-large-v3` | GPU helps; CPU ok for batch |
| Compile | `Qwen/Qwen2.5-7B-Instruct`, `meta-llama/Llama-3.2-3B-Instruct` | Small instruct models enough for structuring |
| Homonym pass (optional) | Same small model, constrained JSON output | Cheaper than full compile |

**Pros:** You own weights; no per-minute cloud bill; air-gappable.  
**Cons:** You operate GPU/CPU, drivers, model updates.

### 2. Hugging Face Inference API (BYOK)

- Serverless endpoints for Whisper-class STT and small LLMs.
- User sets `HF_TOKEN` in SecretStorage.
- **Pros:** No infra; swap models from hub quickly.  
**Cons:** Audio leaves machine; cost + rate limits; latency variance.

### 3. Fine-tuned Teacher model (later)

Train a **small specialist** on (raw session → confirmed brief) pairs:

- Base: 3B instruct or smaller.
- Task: supersession detection + brief formatting only — **not** general chat.
- Host: HF private repo + local Ollama import, or HF Inference dedicated endpoint.

**Pros:** Matches founder dictation/correction style.  
**Cons:** Needs export pipeline, redaction, eval harness; not v0.

Teacher does **not** require a custom HF model to ship v1. Rules + small general instruct model is enough.

---

## Ollama as local default

Lowest-friction self-host for compile step:

- User installs Ollama; Teacher calls `http://127.0.0.1:11434/api/generate`.
- Model pull once: `qwen2.5:7b-instruct` or similar.
- STT separate: **whisper.cpp** CLI or `@xenova/transformers` in extension webview worker (heavier).

---

## Provider adapter interface

```typescript
interface SttProvider {
  id: string;
  transcribe(audio: AudioBuffer, ctx: VoiceSessionContext): Promise<TranscriptSegment[]>;
}

interface CompileProvider {
  id: string;
  compile(input: CompileInput): Promise<CompiledBrief>;
}
```

Register in `teacher.providers.stt` / `teacher.providers.compile` settings.

---

## “Can’t run local” fallback order

1. BYOK cloud STT (Deepgram keywords + workspace terms).
2. BYOK cloud compile (small prompt to GPT-4o-mini / Haiku — structure only).
3. **Rules-only Teacher** — no LLM compile; template + retractions regex still work.
4. Hosted Teacher endpoint (future, opt-in).

Rules-only mode is important: you still get supersession blocks and Goal/Target scaffolding without GPU.

---

## Cost and keys

| Secret | Storage |
|--------|---------|
| `OPENAI_API_KEY` | SecretStorage |
| `DEEPGRAM_API_KEY` | SecretStorage |
| `HF_TOKEN` | SecretStorage |
| Ollama | None (local) |

Never log keys or raw audio in default output channel.

---

## Hardware guidance (founder machine)

Document in README when known:

- GPU STT + 7B compile: comfortable on RTX 3090/4070 class.
- CPU-only: batch Whisper small + rules-only Teacher, or cloud BYOK for STT.

---

## Open questions

- [ ] Bundle whisper.cpp binary per platform vs require user install?
- [ ] Webview WASM whisper (transformers.js) — bundle size vs privacy win?
- [ ] HF model allow-list in extension vs arbitrary model id string?
- [ ] Single “Teacher inference profile” preset: `local | balanced | quality`
