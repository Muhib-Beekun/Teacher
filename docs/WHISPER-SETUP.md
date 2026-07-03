# Local Whisper setup (optional)

Browser speech (Chrome/Edge Web Speech API) is the default and needs no setup. **Whisper is opt-in** for offline transcription and hear-time vocabulary bias via `--prompt`.

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

- **Latency:** Pause → transcribe often takes 1–3+ seconds on CPU (depends on model and hardware).
- **Quality:** May not beat Chrome + Teacher’s post-correction for everyone; best when you want offline or `--prompt` bias at hear time.
- **Privacy:** Audio stays on your machine (browser records, extension host runs Whisper).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Test setup: binary not found | Re-browse; on Windows include `.exe` in path |
| Test setup: CLI test failed | Try running the binary with `--help` in a terminal |
| Still using browser speech | Provider must be Auto or Local whisper; Auto skips Whisper if paths invalid |
| Empty transcript | Check Output channel “Teacher” for `[stt:whisper]` errors |

See also [CONFIGURATION.md](./CONFIGURATION.md) for the full STT biasing stack.
