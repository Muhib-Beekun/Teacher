# Continue Teacher — session handoff prompt

Copy everything in the block below into a **new Cursor chat** with workspace root `C:\Users\Public\Projects\Teacher` (or multi-root `amplijob.code-workspace` including `teacher`).

**Canonical plan:** [PLAN.md](./PLAN.md)

---

## Prompt (copy from here)

```markdown
You are implementing **Teacher** — a VS Code / Open VSX extension that works in **Cursor**. Repo: `C:\Users\Public\Projects\Teacher` (private GitHub: AmpliJob/Teacher).

**Read first (in order):**
1. `docs/PLAN.md` — canonical product plan and roadmap
2. `README.md`
3. `docs/CONTEXT.md` — product wedge vs Cursor native STT
4. `docs/TEACHER-COMPILER.md` — continuous session, live re-scaffold, dual pane
5. `docs/CONTEXT-INDEX.md` — vectorless workspace indexing
6. `docs/INFERENCE.md` — local-first, Ollama, Hugging Face, BYOK
7. `docs/ARCHITECTURE.md` — extension shape, commands, settings

**Product summary**

Teacher is two layers:
1. **Context-aware STT** — `VoiceSessionContext` from workspace symbols, deps, open files, `.teacher/codewords.txt` → STT keyword/prompt biasing.
2. **Teacher compiler** — multi-segment dictation with voice corrections (*ignore that*, *I meant…*); **re-scaffolds** an agent brief after each segment; **does not** dump raw transcript into Cursor chat until user hits Send.

**Critical UX vs Cursor (non-negotiable):**
- **Continuous session** — Stop = chunk done, not session over; review, append, Send when ready.
- **Live re-scaffold** — right pane updates compiled prompt after each segment (`teacher.compile.live` default on).
- **Dual pane default** — left: your words (audit); right: scaffolded agent prompt. Chat held empty until Send.
- **AmpliJob reference** — Shared tail Facts frames 2/2b in `environment/.../evidence-intake-journey-mockup.html`.
- **Local inference first** — Ollama + whisper.cpp; BYOK fallback; rules-only compile works with zero API calls.

**Current repo state:**
- Extension shell: commands, dual-pane webview, launch config
- Workspace context index: `WorkspaceContextIndex`, `teacher.rebuildIndex`, `npm run dump-context`
- **Not yet:** retraction detector, rules compiler, mic/STT, `teacher.compile.mode` setting

**Next implementation unit (recommended order):**
1. Retraction detector + rules compiler (`src/session/RetractionDetector.ts`, compile path in panel)
2. AmpliJob-style panel UX (collapsible segments, fix markers, Included/Superseded grouping)
3. Webview mic + STT adapter (local whisper / BYOK)

**Constraints**
- Open VSX; Cursor-compatible; no Cursor private APIs.
- Secrets in SecretStorage only. No cloud telemetry v0.
- Repo is **private** on GitHub (AmpliJob/Teacher).

**When done:** list files changed, how to run/test in Cursor, and next unit.

Start by reading `docs/PLAN.md`, confirm understanding in 5 bullets, then implement the next unit from the plan unless told otherwise.
```

---

## Shorter variant (if context is tight)

```markdown
Repo: `C:\Users\Public\Projects\Teacher` (private). Read `docs/PLAN.md` first.

Teacher = continuous voice session for Cursor: dual pane (transcript | scaffolded agent brief), workspace STT index, rules/LLM compile, Send gate. Scaffold + dual pane on by default (AmpliJob Facts 2/2b pattern). Extension shell + context index done; next = retraction detector + rules compiler. Local-first inference; training not required for v0.
```
