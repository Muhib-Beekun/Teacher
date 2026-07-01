# Teacher

Context-aware voice input and **intent compilation** for VS Code, Cursor, and other VS Code–compatible editors.

**Teacher** (the mode) takes a multi-utterance dictation session — including mid-stream corrections like *"ignore that"* or *"I meant…"* — and compiles an agent-ready brief that preserves your voice while separating **current intent** from **superseded reference**.

**Status:** Private design phase. Extension scaffold not yet started.

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
