# demo-video — Claude Code plugin

Turns a feature or a homework into a narrated demo video, recorded on macOS.

| Piece | Kind | Invoked as | Does |
|---|---|---|---|
| `demo-scenario` | skill | `/demo-video:demo-scenario`, or by the model | writes `scenario.md` + `cues.json`, checked against the running app |
| `demo-film` | skill, user-only | `/demo-video:demo-film` | ElevenLabs narration → staged VS Code, Terminal, Chrome → ffmpeg recording → mp4 |
| `frame-checker` | subagent | `demo-video:frame-checker` | reads contact sheets and reports, per cue, whether the screen matches the words |

## Install

```sh
claude plugin marketplace add artemmmon/screencast-demo-maker
claude plugin install demo-video@demo-video
```

Or from inside Claude Code: `/plugin marketplace add artemmmon/screencast-demo-maker`,
then `/plugin install demo-video@demo-video`.

## Requirements

- macOS, a spare display to film on, Screen Recording + Automation permissions
- Node ≥ 22, `ffmpeg`, `python3`, Google Chrome, VS Code (`code` on PATH), Xcode CLT (`swift`)
- An ElevenLabs API key in the Keychain:
  `security add-generic-password -s elevenlabs-api -a "$USER" -w`
- Playwright is installed into the skill folder on first use (`npm install`); the
  skills do this themselves, and again after a plugin update.

## Project conventions

The plugin is generic. Per-project facts — where the scenario lives, which URLs and
ids to film, which controls must never be clicked, a finished example to copy — belong
in a project skill named `<project>-demo` in that repo's `.claude/skills/`. Both skills
read it first when it exists.
