# Teacher

Context-aware voice input and **intent compilation** for VS Code, Cursor, and other VS Code–compatible editors.

**Teacher** (the mode) takes a **continuous** dictation session — keep speaking after the first pass, fix mistakes with your voice not the keyboard — then **re-scaffolds** an agent-ready brief from everything you've said (including *ignore that* / *I meant…*).

**Status:** Private design phase. Extension scaffold not yet started.

## vs Cursor voice

| Cursor | Teacher |
|--------|---------|
| One shot → text dumped in box | **Session stays open** — append more speech anytime |
| Imperfect → type corrections by hand | **Speak corrections**; compiler re-drives the brief |
| What you see is raw transcript | Optional **dual pane**: your words ↔ compiled prompt |
## Docs

| Doc | Contents |
|-----|----------|
| [docs/CONTEXT.md](./docs/CONTEXT.md) | Origin story, product wedge, links to AmpliJob backlog |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Extension shape, pipeline, Open VSX / Cursor |
| [docs/INFERENCE.md](./docs/INFERENCE.md) | Self-hosted, BYOK, Hugging Face options |
| [docs/CONTEXT-INDEX.md](./docs/CONTEXT-INDEX.md) | Codebase indexing without vector RAG |
| [docs/TEACHER-COMPILER.md](./docs/TEACHER-COMPILER.md) | Session model, re-drive, output templates |
| [docs/TRAINING-DATA.md](./docs/TRAINING-DATA.md) | Cursor conversation exports as supervision |

## Related AmpliJob work

Voice STT context seeding in product backlog: `environment/docs/product/backlog.md` items **39–42** and `evidence-and-atoms.md` §9.1.

## License

TBD (private repo until scope is settled).
