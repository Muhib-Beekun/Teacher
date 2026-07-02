# Install Teacher in Cursor

Teacher is **not** on Open VSX or the VS Code Marketplace yet. Install from a VSIX built in this repo.

**After install:** follow **[SETUP.md](./SETUP.md)** for API keys, compile provider, and first mic session.

---

## Method A — Install the `.vsix` file (recommended)

### 1. Build the install package

```powershell
cd C:\Users\Public\Projects\Teacher
npm install
npm run package
```

Creates **`teacher-<version>.vsix`** in the repo root (e.g. `teacher-0.0.41.vsix`).

### 2. Install in Cursor

1. `Ctrl+Shift+P` → **`Extensions: Install from VSIX...`**
2. Select the latest **`teacher-*.vsix`** in the repo root
3. **Reload** when prompted

Or: Extensions sidebar → **`...`** → **Install from VSIX...**

### 3. Configure and use

1. Open any project in Cursor
2. `Ctrl+Shift+P` → **`Teacher: Start Session`** or **`Teacher: Open Web UI`**
3. Open **Settings** in the web UI → inference preset + API key + compile provider
4. See **[SETUP.md](./SETUP.md)** for full checklist

Re-run `npm run package` and reinstall the VSIX after extension code changes.

---

## Method B — Extension Development Host

For **editing the Teacher repo itself**:

1. Open `C:\Users\Public\Projects\Teacher` in Cursor
2. `npm install` && `npm run build`
3. Run and Debug → **Run Teacher Extension** → **F5**

A second Cursor window opens. For daily use in other projects, prefer **Method A**.

---

## Optional features

| Feature | How |
|---------|-----|
| **Cloud compile** | Settings → Inference provider + API key, or workspace `.env` |
| **Local Ollama** | Run Ollama; Compile provider → Auto or Local Ollama |
| **Deepgram STT** | **Teacher: Set Deepgram API Key** |
| **Whisper STT** | Settings → `teacher.stt.whisper.*` paths |

---

## Troubleshooting

**No Teacher commands** — Confirm extension is installed; reload after VSIX install.

**`npm install` did nothing in Cursor** — That only builds the repo. Install the **VSIX** (Method A).

**Compiler: not configured** — Add API key or start Ollama. See [SETUP.md](./SETUP.md) § Compile provider.

---

## Later: marketplace

When ready: Open VSX publisher account → `npx ovsx publish teacher-*.vsix`. Until then, see [RELEASES.md](./RELEASES.md) for VSIX + GitHub Releases.
