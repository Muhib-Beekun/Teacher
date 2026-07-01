# Codebase context — vectorless indexing

How Teacher knows your repo **without** embedding everything into a vector database.

---

## Why vectorless first

Full **vector RAG** (chunk docs → embed → similarity search) is powerful but heavy for a desktop extension:

- Embedding model size, index storage, stale chunks, `.gitignore` leaks.
- Most agent prompts need **dozens of precise terms**, not paragraphs of retrieved prose.
- VS Code already exposes **structured symbols** — use the IDE’s index, not a second one.

Teacher’s default is **symbol- and lexicon-driven context**: build a capped **`dictionary_context`** + optional **Target** file list. No Pinecone, no Chroma, no local sqlite of vectors in v0.

Vector RAG remains an **optional plugin** for monorepos where symbol index is thin (prose-heavy docs repos).

---

## Vectorless stack (default)

```text
Workspace open
    │
    ▼
┌─────────────────────────────────────┐
│ 1. VS Code Language API              │
│    executeDocumentSymbolProvider     │
│    (per open folder, debounced)      │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 2. Lexical scan (ripgrep-lite)      │
│    package.json deps, pyproject,     │
│    go.mod; basename index; .codewords│
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 3. Rank & cap (max N terms)         │
│    open file > importers > deps > rest│
└──────────────┬──────────────────────┘
               ▼
        VoiceSessionContext
        · dictionary_context[]
        · targetFiles[]
        · stt_prompt string
```

---

## What gets indexed

| Source | Examples | Refresh |
|--------|----------|---------|
| Active editor | `TeacherCompiler.ts`, symbol at cursor | Immediate |
| Open documents | Tabs visible | On tab change |
| Workspace symbols | `invokeRefineGraph`, `GapLevel` | Debounced 2–5s after save |
| Dependency manifests | `@nestjs/common`, `langgraph` | On file change |
| Path basenames | `evidence-intake-journey-mockup.html` | Full scan once + watcher |
| User glossary | `.teacher/codewords.txt`, setting | Manual |
| Git | Branch name (optional) | On branch change |

**Excluded by default:** `node_modules`, `dist`, `.git`, secrets globs, binary files, files >500KB.

---

## Ranking (when terms exceed cap)

Score each candidate term:

```text
score =
  (in_active_file ? 100 : 0)
+ (in_open_tabs ? 50 : 0)
+ (mentioned_in_selection ? 80 : 0)
+ (is_exported_symbol ? 30 : 0)
+ (is_dependency_name ? 20 : 0)
+ (basename_match_recent_utterance ? 40 : 0)  // after first STT pass
```

Keep top `teacher.context.maxTerms` (default 200). STT APIs often cap keywords at 100–500 — stay conservative.

---

## “Vectorless RAG” — when you still search text

Sometimes symbols aren’t enough (*"that mockup frame seven expander"*). Lightweight **non-embedding** search:

| Method | Cost | Use |
|--------|------|-----|
| **BM25 / ripgrep** over `docs/`, `*.md`, mockup paths | Low | Find file by phrase user spoke |
| **Path fuzzy match** | Very low | *journey mockup* → `evidence-intake-journey-mockup.html` |
| **Recent files** | Zero | VS Code `workspace.textDocuments` history |

Pipeline:

1. Extract noun phrases from latest segment (rules or tiny LLM).
2. Ripgrep workspace with `.gitignore` respect.
3. Add top 3 file paths to **Target** section only — not full file contents into STT.

This is **retrieval without vectors**: keyword search + structure, not semantic embeddings.

---

## When to add vector RAG (optional module)

Consider embeddings only if:

- Monorepo >50k files and symbol provider times out.
- User dictation references **conceptual** docs (*"the constitutional rule about AI calls"*) not symbol names.
- You want cross-session “remember how we named X last month.”

If added:

- Embed **file paths + first heading + export signatures**, not every line.
- Store index in `.teacher/index/` (gitignored).
- Local model: `sentence-transformers/all-MiniLM-L6-v2` or `@xenova/transformers` MiniLM in worker.
- Still pass **term lists** to STT; use vectors only for Target file disambiguation.

---

## Privacy

- Index builds **locally**; never upload repo tree by default.
- Cloud STT receives only **derived term list** + audio — not full source files.
- Optional setting: `teacher.context.sendSnippetToCompile` — include selection text in compile prompt (off by default).

---

## `.teacher/` workspace folder (gitignored)

```text
.teacher/
  codewords.txt       # user additions: AmpliJob, Langfuse, n8n
  sessions/           # optional debug JSONL
  index/              # future vector index if enabled
```

Recommend adding `.teacher/` to global gitignore template in docs.

---

## STT vs Teacher compile — who gets what

| Field | STT provider | Teacher compile |
|-------|--------------|-----------------|
| `dictionary_context[]` | Yes | Also for homonym pass |
| Full symbol table | No (too large) | Top-K symbols in prompt |
| File contents | No | Active selection only if opted in |
| Target file paths | No | Yes — structured brief |

---

## Implementation notes (VS Code API)

- `vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri)`
- `vscode.workspace.findFiles(relativePattern, exclude, maxResults)`
- `vscode.window.activeTextEditor` + `document.getText(selection)`
- Watch: `onDidChangeTextDocument`, `onDidOpenTextDocument` debounced

No Language Server Protocol requirement — works in Cursor as-is.

---

## Success metrics (spike)

Compare STT word error rate on a fixed script with vs without index:

- Script includes 10 workspace-specific tokens (file names, symbols, deps).
- Target: **>50% reduction** in critical token errors before Teacher compile even runs.
