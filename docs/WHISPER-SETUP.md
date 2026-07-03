# Local Whisper setup (optional)

Browser speech (Chrome/Edge Web Speech API) is the default and needs no setup. **Whisper is opt-in** for offline transcription and **hear-time** vocabulary bias via `--prompt`.

**Important:** Workspace codewords and the context index always feed **post-hoc** correction (lexicon, homonym pass, LLM polish) on every provider. **Recognition-time biasing** — passing your glossary to the STT engine while it listens — works only with **Whisper** (`--prompt`) or **Deepgram** (`keywords=`). Browser speech has no vocabulary API.

Teacher does **not** bundle whisper.cpp. You install the CLI and model once, then point Teacher at both paths in **Settings → Speech → Local Whisper**.

## Quick setup

1. **Download whisper.cpp** for your OS from [whisper.cpp releases](https://github.com/ggml-org/whisper.cpp/releases).
   - Windows: prebuilt zip or build from source; use `whisper-cli.exe` or `main.exe`.
   - macOS / Linux: build or use a release binary named `whisper-cli` or `main`.

2. **Download a model** from [Hugging Face — whisper.cpp models](https://huggingface.co/ggerganov/whisper.cpp/tree/main).
   - Recommended for English dev dictation: **`ggml-small.en.bin`** (balance of speed and accuracy).
   - Larger models (medium, large) are more accurate but slower on CPU.

3. In Teacher **Settings → Speech**:
   - **Browse binary…** → select the CLI
   - **Browse model…** → select the `.bin` or `.gguf` file
   - Or tap **Find on disk** if whisper.cpp is already on PATH or in a common folder
   - Tap **Test setup** — should report “Whisper CLI responds”

4. Set **STT provider** to **Auto** (uses Whisper when configured) or **Local whisper**.

## Overhead vs browser speech

| | Browser speech | Whisper local |
|--|----------------|---------------|
| Latency after mic pause | Low (~instant partials) | Often **1–5+ s** per chunk on CPU |
| Local compute | None (Google cloud STT) | CPU/GPU during transcribe |
| Hear-time codeword bias | **No** | **Yes** (`--prompt`) |
| Post-hoc correction | Yes | Yes |

Larger models (medium, large) improve accuracy but increase wait time. **`ggml-small.en.bin`** is the usual starting point for English dev dictation.

## How it works

```
Mic (browser) → audio chunk on pause → extension host → whisper.cpp CLI → transcript
                                                      ↑
                                            workspace stt_prompt (--prompt)
```

After Whisper returns text, Teacher still runs lexicon, dictionary homonym pass, and optional LLM polish — same as Web Speech.

## Settings keys

| Key | Description |
|-----|-------------|
| `teacher.stt.provider` | `auto` \| `webspeech` \| `whisper` \| `deepgram` |
| `teacher.stt.whisper.binaryPath` | Full path to whisper.cpp CLI |
| `teacher.stt.whisper.modelPath` | Full path to GGML/GGUF model |

All three Whisper fields are editable in the Teacher web UI settings panel.

## Expectations

- **Latency:** Pause → transcribe often takes 1–5+ seconds on CPU (model and hardware dependent). The mic shows processing until text returns.
- **Quality:** May not beat Chrome + Teacher’s post-correction for everyone; best when you want offline or hear-time `--prompt` bias.
- **Biasing:** Hear-time glossary only applies while Whisper is the active STT provider. Homonym pass and lexicon still run afterward on all paths.
- **Privacy:** Audio stays on your machine (browser records, extension host runs Whisper).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Test setup: binary not found | Re-browse; on Windows include `.exe` in path |
| Test setup: CLI test failed | Try running the binary with `--help` in a terminal |
| Still using browser speech | Provider must be Auto or Local whisper; Auto skips Whisper if paths invalid |
| Empty transcript | Check Output channel “Teacher” for `[stt:whisper]` errors |

See also [CONFIGURATION.md](./CONFIGURATION.md) for the full STT biasing stack.
