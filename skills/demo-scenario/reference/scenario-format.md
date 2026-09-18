# Scenario format

## Shape of `scenario.md`

```markdown
# Demo <slug> — shooting script

~5 min. Filmed by `demo-film` from `cues.json`; this file is the human view.

## Preconditions
- stack up: web :3000, api :3001
- data on screen: one repo, PR #1 with a finished review round

## 1. Intro — 20 s
**Show:** PR list.
**Say (s1-01):** "DevDigest is a local AI pull-request reviewer. …"

## 2. CLAUDE.md — 45 s
**Show:** `CLAUDE.md` (Stack § line 7, Packages § 13, Commands § 24, Naming § 40, Do not touch § 64)
**Do:** jump section to section.
**Say (s2-01):** "Stack — language, frameworks …"
**Say (s2-02):** "Packages — four packages …"

## Coverage
| Criterion | Scene | Cue |
|---|---|---|
| CLAUDE.md documents the stack | 2 | s2-01 |

## Unverified claims
- "the reviewer never calls the LLM here" — checked by watching network in scene 7 only.
```

Line numbers next to **Show** are what `scenes.mjs` passes to `code.open(file, line)`,
so a scene that opens a file carries them — they rot fastest and the filming skill needs
them most. A scene that only shows the running UI has none; name the page, the section
and the control instead.

## Cue ids

`s<scene><NN>` → `s7-03`. Sequential within a scene, no gaps, playback order.
The scene prefix is also the recorded clip name, so one scene can be re-shot alone.

## Pacing

- **Length**: 40–250 characters per cue, which at ~14 chars/second is 3–18 seconds.
  Longer and a single on-screen action has to be stretched to cover it. Shorter and it
  will not survive one `code.open`, which alone eats ~1.5 s.
- **Budget**: narration total ≈ characters / 14 seconds. Video runs 10–20% longer
  because of gaps between cues.
- **No dead air**: a scene should not hold a still frame for more than ~4 seconds.
  When an action takes longer than its line (a test run, a page load), give the cue
  a second half that describes what is appearing.
- **Overlap**: the action starts *during* the line, not after it. In `scenes.mjs`
  that is `await sleep(ms * 0.5)` inside the cue callback.

## Writing lines that a TTS reads well

- Short main clauses. One idea per sentence.
- Numbers as they are read aloud: "zero point zero one three dollars", not `$0.013`.
- Keep identifiers in their normal spelling (`.it.test.ts`, `snake_case`,
  `RunCostBadge`); a modern multilingual model pronounces them, and phonetic
  respellings are what makes narration sound robotic.
- Avoid words the video does not show. If the line says "three green checks", three
  green checks must be on screen at that moment.

## Choosing what to show

- Prefer the real UI over a file that describes the UI.
- One claim per scene needs one visible proof.
- Read-only: never plan a scene around clicking something that mutates state
  (run, delete, accept, reject, deploy). Hovering to reveal a control is fine and
  demonstrates it exists.
