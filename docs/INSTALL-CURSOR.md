# Install Teacher in Cursor

**After install:** follow **[SETUP.md](./SETUP.md)** for API keys, compile provider, and first mic session.

---

## Method A — Open VSX (VSCodium and compatible editors)

1. Open Extensions
2. Search **`Teacher`** publisher **`muhib-beekun`**
3. Or open [open-vsx.org/extension/muhib-beekun/teacher](https://open-vsx.org/extension/muhib-beekun/teacher)

**Cursor** does not use Open VSX by default — use Method B or C below.

---

## Method B — Install from GitHub Release VSIX (Cursor, recommended)

1. Download **`teacher-<version>.vsix`** from [GitHub Releases](https://github.com/Muhib-Beekun/Teacher/releases)
2. `Ctrl+Shift+P` → **`Extensions: Install from VSIX...`**
3. Select the downloaded file → **Reload**

Or build locally:

```powershell
cd C:\Users\Public\Projects\Teacher
npm install
npm run package
```

Creates **`teacher-<version>.vsix`** in the repo root.

---

## Method C — Build your own VSIX (dogfood latest `master`)

Same as Method B build step — install the VSIX from your repo root. Use this when you want the newest commits before a tagged release.

---

## Microphone: open Chrome or Edge

Cursor **cannot** use the microphone inside its own UI. Teacher opens a local page in your browser:

1. `Ctrl+Shift+P` → **`Teacher: Open Web UI`**
2. **Chrome** or **Edge** opens → URL like **`http://127.0.0.1:3721/`**
3. Click **Allow** when asked for the microphone
4. Tap the mic, speak, pause — review **Your Words** and **Agent Prompt**

If nothing opens: copy the URL from **View → Output → Teacher** and paste it into Chrome/Edge. See **[SETUP.md](./SETUP.md) § Open your browser** for troubleshooting.

---

## Configure

1. Open **Settings** in the web UI → inference preset + API key + compile provider
2. See **[SETUP.md](./SETUP.md)** for full checklist

Re-run `npm run package` and reinstall the VSIX after extension code changes (Method B/C).

---

## Extension Development Host

For **editing the Teacher repo itself**:

1. Open the Teacher repo in Cursor
2. `npm install` && `npm run build`
3. Run and Debug → **Run Teacher Extension** → **F5**

A second Cursor window opens. For daily use in other projects, prefer **Method B**.

---

## Optional features

| Feature | How |
|---------|-----|
| **Cloud compile** | Settings → Inference provider + API key, or workspace `.env` |
| **Local Ollama** | Run Ollama; Compile provider → Auto or Local Ollama |
| **Deepgram STT** | Settings → **Teacher: Set Deepgram API Key** |
| **Whisper STT** | Settings → `teacher.stt.whisper.*` paths |

---

## Troubleshooting

**No Teacher commands** — Confirm extension is installed; reload after VSIX install.

**`npm install` did nothing in Cursor** — That only builds the repo. Install the **VSIX** (Method B/C).

**Compiler: not configured** — Add API key or start Ollama. See [SETUP.md](./SETUP.md) § Compile provider.

**Open VSX publish** — Maintainer: sign Eclipse ECA, then `npm run publish:ovsx`. See [RELEASES.md](./RELEASES.md).
