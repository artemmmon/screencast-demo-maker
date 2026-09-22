---
name: {{project}}-demo
description: {{Project}}-specific conventions for recording demo videos — where the scenario, cue and config files live, which URLs to film, how to start the app and which controls must never be clicked. Read this before using the screencast-demo-maker plugin's demo-scenario or demo-film skills in this repository.
---

# {{Project}} demo videos

Project conventions only. The engine is the `screencast-demo-maker` Claude Code plugin
(https://github.com/artemmmon/screencast-demo-maker): skills `demo-setup`, `demo-scenario`
(writes the shooting script), `demo-film` (records it) and the `frame-checker` subagent.

## Prerequisite

If `/screencast-demo-maker:demo-film` is not an available skill, the plugin is not
installed. Stop and give the user the two install commands from the plugin README; do not
improvise filming without it.

## Order

1. If `{{demoDir}}` already holds `scenario.md` and `cues.json`, read them. Otherwise write
   them with `screencast-demo-maker:demo-scenario`, and let the user review them.
2. Ask the user to run `/screencast-demo-maker:demo-film` — it is user-invoked, an agent
   cannot start it. Never record before the user says "go".
3. Hand contact sheets to the `screencast-demo-maker:frame-checker` subagent; never read
   them in the main conversation.
4. Report what the frames and probes showed. The user judges the voice and the result.

## Layout

| What | Where |
|---|---|
| One video's inputs | `{{demoDir}}/{scenario.md,cues.json,scenes.mjs,config.json}` |
| Source of truth the video must cover | {{sourceOfTruth}} |
| Finished video | `{{output}}` |

Working files (clips, narration, frames, staged app profiles) never enter the repo; they
live in `~/.cache/demo-video/<slug>/`.

## Filming this app

- Start it with `{{startCommand}}`; it serves {{urls}}. `config.healthUrls` checks them
  during preflight.
- On screen: {{surfaces}}.
- Narration: {{language}}, for {{audience}}. Filenames, code and this skill stay English.
- {{projectSpecificRule}}

## Never click

{{neverClick}}

They cost money or destroy data, and a demo must be reproducible. Hover to show that a
control exists — that is enough to prove it is there.

## Numbers that have bitten us

Add a line here every time the reality check in `demo-scenario` catches a number that the
screen renders differently from what is stored (rounding, per-page vs total, cached values).
