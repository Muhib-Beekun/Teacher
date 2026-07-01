# Install Teacher in Cursor

Teacher is **not** on Open VSX or the VS Code Marketplace yet. It lives in this repo. You install it locally on your machine.

Pick **one** method below.

---

## Method A — Install the `.vsix` file (recommended)

This makes Teacher show up in Cursor like any other extension.

### 1. Build the install package

In PowerShell, from this repo folder:

```powershell
cd C:\Users\Public\Projects\Teacher
npm install
npm run package
```

That creates **`teacher-0.0.1.vsix`** in the repo root.

### 2. Install in Cursor

**Option 1 — Command Palette**

1. Open **Cursor** (your normal Cursor window, not VS Code)
2. `Ctrl+Shift+P`
3. Type: **`Extensions: Install from VSIX...`**
4. Select `C:\Users\Public\Projects\Teacher\teacher-0.0.1.vsix`
5. **Reload** when Cursor asks

**Option 2 — Extensions sidebar**

1. Open Extensions (`Ctrl+Shift+X`)
2. Click the **`...`** menu at the top of the Extensions panel
3. **Install from VSIX...**
4. Pick `teacher-0.0.1.vsix`

### 3. Use it

1. Open any project in Cursor
2. `Ctrl+Shift+P` → **`Teacher: Start Session`**
3. Teacher panel opens beside your editor — mic, dual pane, Send to Agent

After code changes in this repo, run `npm run package` again and reinstall the VSIX (or use Method B while developing).

---

## Method B — Extension Development Host (for building Teacher)

Use this when **editing the Teacher repo itself** — not when you just want to use it in another project.

1. Open **`C:\Users\Public\Projects\Teacher`** as the workspace in Cursor
2. Run **`npm install`** and **`npm run build`**
3. Go to **Run and Debug** (`Ctrl+Shift+D`)
4. Select **Run Teacher Extension**
5. Press **F5**

A **second Cursor window** opens (Extension Development Host). Teacher only works in **that** window, not your original one.

This is confusing if you expected it in your main Cursor. For daily use, prefer **Method A**.

---

## Method C — Open the Teacher folder in Cursor

If Method A is installed, you do **not** need Method B. Just:

1. Open any codebase in Cursor
2. Command Palette → **Teacher: Start Session**

---

## Optional setup (after install)

| Feature | How |
|---------|-----|
| **Whisper (local STT)** | Cursor Settings → search `teacher.stt.whisper` → set binary + model paths |
| **Deepgram (cloud STT)** | `Ctrl+Shift+P` → **Teacher: Set Deepgram API Key** |
| **Ollama (smarter compile)** | Run Ollama with `qwen2.5:7b-instruct` — auto-detected |

---

## Troubleshooting

**"I don't see Teacher commands"**

- Confirm the extension is installed: Extensions sidebar → search **Teacher**
- Reload Cursor after installing the VSIX

**"I ran npm install in the repo but nothing changed in Cursor"**

- `npm install` only builds code. It does **not** install into Cursor. You must install the **VSIX** (Method A) or press **F5** (Method B).

**"F5 opened a weird second window"**

- That's normal for extension development. For normal use, install the VSIX instead.

---

## Later: marketplace

When ready, Teacher will publish to **Open VSX** (and optionally the Microsoft VS Code Marketplace). Both have a review step before the extension is publicly searchable — similar to an app store, not instant go-live.

**Why VSIX for now**

| Reason | Detail |
|--------|--------|
| Early / private | Repo is private; extension is still moving fast |
| No publisher setup yet | Open VSX needs an Eclipse account + namespace claim (`amplijob`) |
| Review time | Open VSX manual review can take days; MS Marketplace similar |
| Cursor | Cursor can install VSIX or Open VSX extensions; VSIX is fine for you solo |

**Path to marketplace**

1. Stabilize v0 (mic, STT, Send) — you are here
2. Create [open-vsx.org](https://open-vsx.org) publisher account
3. `npx ovsx publish teacher-0.0.1.vsix -p <token>`
4. In Cursor: Extensions → search **Teacher** → Install (no VSIX step)

Until then, **`npm run package`** + **Install from VSIX** is the normal dev loop — same as most extensions before their first publish.

---
