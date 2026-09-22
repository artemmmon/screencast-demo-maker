# Scenario format

## Shape of `scenario.md`

```markdown
# Demo <slug> — shooting script

~5 min. Filmed by `demo-film` from `cues.json`; this file is the human view.

## Preconditions
- app up: web :3000 (`npm run dev`)
- data on screen: one project with three open tasks, one of them overdue

## 1. Intro — 20 s
**Show:** the task board.
**Say (s1-01):** "Taskly is a small team board. This video shows the new overdue filter. …"

## 2. Where the rule lives — 45 s
**Show:** `src/filters/overdue.ts` (rule § line 12, tests § `overdue.test.ts` 8)
**Do:** jump from the rule to its test.
**Say (s2-01):** "The filter is one function: a task is overdue once its due date has passed …"
**Say (s2-02):** "Its test pins the edge case — a task due today is not overdue yet."

## Coverage
| Criterion | Scene | Cue |
|---|---|---|
| overdue filter explained | 2 | s2-01 |

## Unverified claims
- "the filter runs on the server" — true, but no frame shows it.
```

Line numbers next to **Show** are what `scenes.mjs` passes to `code.open(file, line)`,
so a scene that opens a file carries them — they rot fastest and the filming skill needs
them most. A scene that only shows the running UI has none; name the page, the section
and the control instead.

## Cue ids

`s<scene><NN>` → `s7-03`. Sequential within a scene, no gaps, playback order.
The scene prefix is also the recorded clip name, so one scene can be re-shot alone.

## Pacing

- **Length**: 40–250 characters per cue, which at ~14 chars/second (`tts.charsPerSecond`)
  is 3–18 seconds.
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
- Read-only by default: never plan a scene around clicking something that mutates state
  (run, delete, accept, reject, deploy) — hovering to reveal a control is fine and
  demonstrates it exists. A video whose point *is* a mutation may click it only with the
  user's yes, and only if the scene's pre-roll puts the data back, so a re-take starts clean.
  `config.neverClick` is never clicked, whatever the video is about.
