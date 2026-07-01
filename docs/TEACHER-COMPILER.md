# Teacher compiler — session, re-drive, output

Specification for the **Teacher** intent compilation mode.

---

## User story

As a developer dictating to Cursor, I speak for 30–120 seconds, change my mind mid-stream, and want the agent to receive **one clear brief** — not a transcript where paragraph one contradicts paragraph four.

---

## Session lifecycle

```text
startSession → [appendSegment]* → compile → preview → confirm → insert
                    ↑                    │
                    └── "Teacher" or Ctrl+Shift+Enter ──┘
```

Each **segment** is one push-to-talk (or continuous) utterance:

```typescript
interface Segment {
  id: string;
  t_start: number;
  t_end: number;
  text_raw: string;           // STT output
  text_corrected?: string;    // homonym pass
  tags: SegmentTag[];         // retraction, correction, scope
}

type SegmentTag =
  | { kind: 'retract'; scope: 'previous_segment' | 'phrase'; phrase?: string }
  | { kind: 'correct'; target: 'previous'; phrase: string }
  | { kind: 'finalize' };
```

---

## Retraction detection (v1 — rules)

Phrase patterns (case-insensitive, start of segment or after pause):

| Pattern | Effect |
|---------|--------|
| `ignore that`, `disregard that`, `scratch that`, `forget that` | Mark previous segment superseded |
| `ignore the … part`, `don't do the …` | Mark matching phrase in prior segments |
| `I meant …`, `what I really want is …` | Correction segment; links to prior |
| `actually, …` | Soft correction — merge with conflict resolution |
| `only …` / `not the list view` | Scope narrow — annotate constraints |
| `Teacher` / `send that` / `compile` | Trigger compile |

v2: small local LLM classifies spans when rules ambiguous.

---

## Compile output

### Human-readable (default paste)

```markdown
## Goal
<one paragraph — user's words, lightly cleaned>

## Target
- <paths and symbols from workspace index + speech>

## Constraints
- <bullets from current-intent segments only>

## Verification
- <how to know done — if spoken or inferred from "make sure">

---
**Reference only (superseded — do not implement unless asked again)**
- <bulleted retracted ideas, with short quotes>
```

### Machine-friendly (optional setting)

```xml
<teacher_brief version="1">
  <goal>...</goal>
  <target files="..." symbols="..." />
  <constraints>...</constraints>
  <verification>...</verification>
  <superseded reference="do-not-act">...</superseded>
</teacher_brief>
```

---

## Voice preservation rules (compile prompt)

When using an LLM compile provider, system instructions must include:

1. **Do not invent requirements** not spoken or implied by workspace Target.
2. **Prefer user's phrasing** in Goal and Constraints; fix STT errors only when dictionary match >0.9.
3. **Superseded block is mandatory** if any retraction tag exists.
4. **No em-dashes** (AmpliJob prose rule — optional but consistent).
5. **Shorter is not always better** — don't summarize away nuance the user repeated twice.

Rules-only compile (no LLM) still produces template with retracted bullets verbatim.

---

## Preview UI (required v1)

Webview panel before insert:

| Pane | Content |
|------|---------|
| Left (collapsible) | Raw segments, timestamps, tags |
| Right | Compiled brief + superseded |
| Footer | Edit textarea, **Send to agent**, **Copy**, **Cancel** |

User must be able to edit compiled text without re-recording.

---

## Modes

| Mode | Behavior |
|------|----------|
| `teacher` | Full compile (default) |
| `verbatim` | Segments concatenated, no supersession |
| `polish` | Deferred — prose cleanup for non-agent fields |

---

## Insert targets

| Target | Mechanism |
|--------|-----------|
| Active editor | `editor.edit` insert at cursor |
| Chat / Composer | Clipboard + focus chat + paste command (best-effort) |
| New untitled doc | Open preview doc for manual drag |

Document Cursor version quirks in README when discovered.

---

## Example

**Segments (STT raw):**

1. *"Update frame four to put regenerate and the percentage in the card body aligned with the arrows"*
2. *"Actually keep the top section like it was don't move regenerate there"*
3. *"Steal frame seven bottom expander for frame four dimmed background sixty percent sheet"*
4. *"For dismiss I think swipe down not a button tell me if that's wrong but implement swipe first"*

**Compiled:**

**Goal:** Update job application frame 4 to use frame 7’s bottom half-sheet expander (dimmed background, ~60% sheet).

**Target:** `docs/product/mockups/evidence-intake-journey-mockup.html` — frames 4, 7.

**Constraints:**
- Keep top section as-is; do not place regenerate / percentage / arrows in card body (retracted).
- Dismiss via swipe-down on sheet; no dismiss button in v1 unless UX review overrides.

**Verification:** Frame 4 matches frame 7 sheet pattern; no layout regression.

**Reference only:**
- Early idea: align regenerate, percentage, and arrows inside card body.

---

## Evaluation

Track locally (opt-in):

- User edited preview before send? (yes/no, char diff)
- Retraction tags fired vs user manual delete in preview
- STT critical token error count before/after index

Feeds [TRAINING-DATA.md](./TRAINING-DATA.md) export pipeline.
