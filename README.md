# screencast-demo-maker

A Claude Code plugin that turns a feature, a PR or a homework into a **narrated demo
video**: Claude writes the script, checks every number it will say against your running
app, voices it, films your browser, editor and terminal on macOS, and checks every frame
against the narration before handing you the mp4.

| Piece | Kind | You say / type | It does |
|---|---|---|---|
| `demo-setup` | skill | "set up demo videos in this project" | asks what to film, checks the Mac, writes `config.json` and a project skill |
| `demo-scenario` | skill | "write the demo script for …" | writes `scenario.md` + `cues.json`, checked against the running app |
| `demo-film` | skill, **you start it** | `/screencast-demo-maker:demo-film` | narration → staged apps → recording → mp4 → frame check |
| `frame-checker` | subagent | — (used by demo-film) | reads contact sheets, reports per line whether the screen matches the words |

## Requirements

- **macOS** with Screen Recording and Automation permission for your terminal app
- Node ≥ 22, `ffmpeg`, Xcode Command Line Tools (`swift`, `python3`), Google Chrome
- VS Code — only if videos show the editor; Terminal.app — only if they show a terminal
- A voice: **your own** [ElevenLabs](https://elevenlabs.io) API key (free tier ≈ two
  5-minute videos a month), or nothing at all with the built-in macOS `say` voice
- Ideally a second display to film on; one display works, but you cannot use the Mac
  while it films

`node skills/demo-film/scripts/doctor.mjs` checks all of this and prints the fix for
anything missing. The skills run it for you.

## Install

**For yourself** — in a terminal:

```sh
claude plugin marketplace add artemmmon/screencast-demo-maker
claude plugin install screencast-demo-maker@screencast-demo-maker
```

**For everyone on a project** — commit this to the repo's `.claude/settings.json`
(merge it with what is there). Whoever opens the repo in Claude Code and trusts the folder
gets the plugin enabled, with no install step:

```json
{
  "extraKnownMarketplaces": {
    "screencast-demo-maker": {
      "source": { "source": "github", "repo": "artemmmon/screencast-demo-maker" }
    }
  },
  "enabledPlugins": { "screencast-demo-maker@screencast-demo-maker": true }
}
```

`demo-setup` offers to add it for you.

## Your own ElevenLabs key

Everyone who films uses their own ElevenLabs account — keys are never shared, committed or
pasted into chat. The skills check for it before doing anything else and walk you through it:

1. Sign up at [elevenlabs.io](https://elevenlabs.io) (free plan is enough).
2. [Create an API key](https://elevenlabs.io/app/settings/api-keys) with Text to Speech
   and Voices (read) access.
3. Store it in your macOS Keychain — run in your terminal, paste the key at the hidden prompt:
   ```sh
   security add-generic-password -s elevenlabs-api -a "$USER" -U -w
   ```

**Your own voice.** A cloned voice or one from your Voice Library works only on your
account, so keep it out of the repo: put it in your personal file, which overrides any
project's `config.json` for you alone —

```sh
mkdir -p ~/.config/screencast-demo-maker
cat > ~/.config/screencast-demo-maker/config.json <<'JSON'
{ "tts": { "elevenlabs": { "voiceId": "<your voice id>", "voiceName": "<name>" } } }
JSON
```

`node …/doctor.mjs <demo folder>` shows the voice that will be used. The file also takes
`video.display` and `codeBin` — see
[`files-and-config.md`](skills/demo-film/reference/files-and-config.md).

Details, rotation and voices across accounts:
[`skills/demo-film/reference/elevenlabs-key.md`](skills/demo-film/reference/elevenlabs-key.md).

## Quick start

1. In Claude Code, in your project: **"set up demo videos in this project"**. Answer the
   questions (what to show, URLs, voice, display, what must never be clicked).
2. **"write the demo script for <feature>"**. Read `scenario.md`; ask for changes until you
   are happy — every number in it was read off your running app.
3. Start your app, then type **`/screencast-demo-maker:demo-film`**. You pick the voice
   by ear, move the pointer off the filmed display and say **go**. Five minutes of video
   takes about 30–40 minutes, mostly waiting.

Want to see it work before touching your project? `examples/minimal-web/` is a complete,
browser-only, `say`-voiced demo of a static page.

## How a project is laid out

```
your-project/
├─ .claude/skills/<project>-demo/SKILL.md   # your rules: URLs, never-click, where files go
└─ demo/<video>/
   ├─ config.json     # surfaces, voice, display, URLs          (demo-setup)
   ├─ scenario.md     # scenes: show / do / say                 (demo-scenario)
   ├─ cues.json       # the narration, one line per cue         (demo-scenario)
   └─ scenes.mjs      # what the pointer does during each line  (demo-film)
~/.cache/demo-video/<slug>/   # audio, clips, frames — rebuildable, never committed
```

The plugin knows nothing about your project; the project skill knows nothing about
ffmpeg. Commit the four files and a teammate can re-shoot a scene in a minute.

## Reference

- [`skills/demo-film/reference/files-and-config.md`](skills/demo-film/reference/files-and-config.md) — every `config.json` key, the cache, script flags
- [`skills/demo-film/reference/scenes-api.md`](skills/demo-film/reference/scenes-api.md) — the API `scenes.mjs` is written against
- [`skills/demo-film/reference/gotchas.md`](skills/demo-film/reference/gotchas.md) — everything that broke once, and why
- [`skills/demo-scenario/reference/scenario-format.md`](skills/demo-scenario/reference/scenario-format.md) — script grammar, cue ids, pacing

## Troubleshooting

| Symptom | Fix |
|---|---|
| a script says `config.json in …:` and a list | fix those keys; `doctor.mjs <demoDir>` re-checks |
| `Playwright … ✗` after an update | `node <plugin>/skills/demo-film/scripts/doctor.mjs --fix` — updates replace the plugin folder |
| black video / no capture devices | Screen Recording is granted to a *different* app than the one running Claude Code |
| wrong monitor filmed | monitors were re-plugged; run preflight again (indexes move) |
| your mouse pointer in the video | move it to another display, or a corner no scene uses |

## Update and uninstall

```sh
claude plugin marketplace update screencast-demo-maker
claude plugin update screencast-demo-maker@screencast-demo-maker
claude plugin uninstall screencast-demo-maker@screencast-demo-maker
```

Remove `~/.cache/demo-video/` to free the disk space the clips use.

## Changelog · License

[CHANGELOG.md](CHANGELOG.md) · [MIT](LICENSE)
