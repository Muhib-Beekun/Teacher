# Continue Teacher — session handoff prompt

Copy everything in the block below into a **new Cursor chat** with workspace root `C:\Users\Public\Projects\teacher` (or multi-root `amplijob.code-workspace` including `teacher`).

---

## Prompt (copy from here)

```markdown
You are implementing **Teacher** — a VS Code / Open VSX extension that works in **Cursor**. Repo: `C:\Users\Public\Projects\teacher` (private GitHub: AmpliJob/Teacher).

**Read first (in order):**
1. `README.md`
2. `docs/CONTEXT.md` — product wedge vs Cursor native STT
3. `docs/TEACHER-COMPILER.md` — continuous session, live re-scaffold, dual pane
4. `docs/CONTEXT-INDEX.md` — vectorless workspace indexing
5. `docs/INFERENCE.md` — local-first, Ollama, Hugging Face, BYOK
6. `docs/ARCHITECTURE.md` — extension shape, commands, settings
7. `docs/TRAINING-DATA.md` — Cursor transcript exports (later)

**Product summary**

Teacher is two layers:
1. **Context-aware STT** — `VoiceSessionContext` from workspace symbols, deps, open files, `.teacher/codewords.txt` → STT keyword/prompt biasing.
2. **Teacher compiler** — multi-segment dictation with voice corrections (*ignore that*, *I meant…*); **re-scaffolds** an agent brief after each segment; **does not** dump raw transcript into Cursor chat until user hits Send.

**Critical UX vs Cursor (non-negotiable):**
- **Continuous session** — keep speaking after first utterance; never force keyboard fixes because mic session ended.
- **Live re-scaffold** — right pane updates compiled prompt (Goal / Target / Constraints / Verification + superseded reference block) after each segment (`teacher.compile.live` default on).
- **Dual pane default** — left: your words (audit); right: agent prompt. Chat box held empty until Send (`teacher.session.holdChatBox`).
- **Local inference first** — Ollama + whisper.cpp; BYOK Deepgram/OpenAI/HF as fallback.

**Current repo state:** Design docs only — no extension scaffold yet.

**Suggested next implementation unit (pick one and execute):**

**Option A — Extension shell (recommended first)**
- `package.json` with `engines.vscode`, contributes.commands, Open VSX metadata
- `src/extension.ts` — register commands from ARCHITECTURE.md
- Webview panel skeleton: dual pane (left transcript stub, right brief stub)
- `teacher.startSession` / `teacher.appendSegment` / `teacher.send` wired with placeholder text
- `.vscode/launch.json` for Extension Development Host (test in Cursor)

**Option B — Context indexer spike**
- `src/context/WorkspaceContextIndex.ts` — symbols via `vscode.executeDocumentSymbolProvider`, package.json deps, cap at N terms
- Unit test or CLI script printing `dictionary_context` for a sample workspace
- Document STT A/B procedure in README

**Option C — Transcript analyzer (training prep)**
- `tools/analyze-transcripts.ts` — scan `%USERPROFILE%\.cursor\projects\*\agent-transcripts\*.jsonl` for correction patterns (*I meant*, *ignore that*)
- Output counts + sample pairs to `tmp/` (gitignored)

**Constraints**
- Publish target: Open VSX; Cursor-compatible; no Cursor private APIs.
- Secrets in VS Code SecretStorage only.
- No telemetry cloud in v0.
- Align conceptually with AmpliJob backlog items 39–42 in `../environment/docs/product/backlog.md` but keep code in this repo.

**When done:** list files changed, how to run/test in Cursor, and what the next unit should be.

Start by reading the docs above, confirm understanding in 5 bullets, then implement **Option A** unless I say otherwise.
```

---

## Shorter variant (if context is tight)

```markdown
Repo: `C:\Users\Public\Projects\teacher`. Read README + docs/CONTEXT.md + docs/TEACHER-COMPILER.md + docs/ARCHITECTURE.md.

Build Open VSX VS Code extension for Cursor: continuous voice session, dual-pane preview (transcript | re-scaffolded agent brief), context-aware STT index, local-first inference. Docs-only repo today — scaffold extension shell (package.json, webview panel, commands) as first unit. Non-negotiable: session stays open after first utterance; re-compile brief each segment; don't insert into chat until Send.
```
