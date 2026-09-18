---
name: demo-scenario
description: Writes the shooting script for a demo/screencast video — scenes with what to show, what to do and what to say — and the cue list that narration is generated from. Use when the user asks for a demo script, a scenario for a video, a plan for showing off a feature or homework, or says "сценарій демо" / "план демо-відео". Also use before filming with demo-film, which consumes the files this produces.
---

# Demo scenario

Produces the first two of the four files that filming needs, in
`<project>/<somewhere>/demo/` (for course homework: `hw/LNN/demo/`):

- `scenario.md` — human-readable: scenes, what is on screen, what is said.
- `cues.json` — a bare JSON array `[{ "id": "s2-04", "scene": "s2", "text": "…" }]`.

The other two — `scenes.mjs` (the code that drives the screen) and `config.json` (paths,
voice, display) — are written later, by `demo-film`. Do not write them here; a scenario
is useful on its own, including to a person filming by hand.

A project's own demo skill (`*-demo`), if it has one, names a worked example of all four.

## 1. Intake

Ask only for what is missing. When you cannot ask — running unattended, or told not to —
assume the defaults below, and list every assumption at the top of `scenario.md` under
`## Assumptions` instead of stalling.

- **Source of truth** — grading criteria (`hw/LNN/*criteria*.md`), a spec, a PR, a diff.
  Every criterion must end up covered by a scene, so read it first.
- **Target length** — default 4–6 minutes. Narration runs ~14 characters/second,
  so a 5-minute video is roughly 3500–4000 characters of spoken text.
- **Language** of narration, and who the audience is (a reviewer who knows the
  codebase needs no product intro). Narration follows the user's spoken language; the
  files around it — headings, notes, coverage tables, comments — stay English, so a
  Ukrainian voice-over still lives in an English `scenario.md`.

If the project has its own demo skill (`*-demo`) or an existing `demo/config.json`,
read it first: it carries URLs, ids and "never click this" rules.

## 2. Write `scenario.md`

One `##` section per scene, numbered, with an estimated duration. Inside each:

- **Show** — the file, page or panel on screen.
- **Do** — the interaction (hover, click, scroll). Omit for a still scene.
- **Say** — the exact narration, verbatim, split into the cues you will emit.

See `reference/scenario-format.md` for the grammar, cue ids and pacing rules.

Keep scenes short and specific. A scene that needs more than ~6 cues is two scenes.

## 3. Reality check — do not skip

The narration quotes numbers and file positions; both drift. Before emitting cues,
verify every checkable claim against the running system, and fix the text to match
reality rather than the other way round.

**How to read the running app.** A modern UI fetches its numbers on the client, so
`curl` returns a loading state with nothing in it — never quote a number from raw HTML.
Use the Playwright that ships with the filming skill; the project itself usually has
none:

```sh
cd ${CLAUDE_SKILL_DIR}/../demo-film/scripts   # playwright lives here, not in the project
test -d node_modules/playwright || npm install   # first run after install or update
node -e '
import("playwright").then(async ({ chromium }) => {
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.goto("http://localhost:3000/…", { waitUntil: "networkidle" });
  console.log(await p.locator("main").ariaSnapshot());   // the rendered text, as a tree
  await b.close();
});'
```

`ariaSnapshot()` gives the rendered strings; `getAttribute`/`evaluate` gives exact state
(`aria-pressed`, a title attribute). The API is a second source, but it returns *stored*
values — the screen is what the narration must match.

Then check:

- **Numbers on screen** — read the rendered value, not the stored one. Rounding bites:
  a stored `0.01259` renders as `$0.013`.
- **Labels on screen** — a heading can contradict the narration even when both are
  defensible ("N findings in this run" over a whole review round). Quote the string as
  it is, and report the contradiction.
- **Aggregates** — confirm what a number actually sums. A per-round total and a
  per-card total are different numbers with the same shape.
- **Line anchors** — `grep -n` every file:line the video jumps to; put them in the
  scenario next to the Show line so `scenes.mjs` can use them.
- **Counts** — test counts, entry counts, findings counts: run the command, read it.
- **Freshness** — state that will change before filming (dates, "3h ago") stays out
  of the narration.
- **The criterion's own wording** — where a criterion exists, compare it to what the
  product actually does, not just to what the narration says. A criterion asking for
  "the sum of all successful runs" and an implementation that sums the latest round are
  a real divergence; the video cannot paper over it. Report it to the user as a product
  question and let them decide, rather than quietly narrating around it.

List anything unverifiable at the end of `scenario.md` under `## Unverified claims`,
so the user can decide whether to keep saying it. Claims that are true but not shown on
screen (“a config in each of the four packages”) go there too — they are fine to say,
but the user should know the frame does not prove them.

## 4. Emit `cues.json` + coverage

- One cue per spoken sentence or tight pair of sentences; 3–18 seconds each.
- `id` is `<scene>-<NN>`, zero-padded, in playback order. `demo-film` groups by
  `scene` to steer intonation across cue boundaries, so ids must be consistent.
- Write the text the way it should be *spoken*, in normal spelling — modern TTS
  reads `.it.test.ts` and `snake_case` correctly; do not insert phonetic hacks.
  Spell out currency and long digit strings in words where a reader would.
- Finish with a table in `scenario.md`: criterion → scene → cue. Name any criterion
  no scene covers; suggest where to add it.

## 5. Hand off

Tell the user: the two file paths, the estimated length (`chars / 14` seconds), and what
the reality check changed or could not verify.

Then stop. **Filming is a separate, user-invoked step: the user types
`/screencast-demo-maker:demo-film` themselves.** That skill cannot be invoked by an agent, so do
not offer to continue into filming and do not start improvising it — say what the user has to type, and that it
needs the app running, a spare display and an ElevenLabs key in the Keychain.
