---
name: demo-film
description: Films a narrated demo/screencast video on macOS from a scenario produced by demo-scenario — confirms the setup with the user, generates narration (ElevenLabs or macOS say), stages an isolated browser, VS Code and/or Terminal on the chosen display, records scene by scene with ffmpeg, assembles and verifies the result. Use only when the user explicitly asks to film, shoot, record or re-record a demo video, or invokes it by name.
disable-model-invocation: true
---

# Demo film

Turns `demo/{scenario.md,cues.json,scenes.mjs,config.json}` into one narrated mp4.

You are the director: the user picks the voice by ear, grants permissions and says
"go". Never start recording without that word. Scripts live in
`${CLAUDE_SKILL_DIR}/scripts/`; working files go to `~/.cache/demo-video/<slug>/`.

- `reference/files-and-config.md` — the four input files, every `config.json` key, the cache layout, script flags
- `reference/scenes-api.md` — the engine API `scenes.mjs` is written against
- `reference/gotchas.md` — read before debugging anything; it is all hard-won

Start a new project from `templates/` (`scenes.example.mjs`, `config.example.json`).
If the project has its own demo skill (`*-demo`), read it first: it names a finished
example to copy from, the URLs to film and the controls never to click.

## Phase −1 — intake (every session, before anything touches the screen)

1. Find the demo folder (`<workDir>`): the project's `*-demo` skill names it; otherwise ask.
   No `config.json` there → run the `demo-setup` skill first, then come back.
2. Run the doctor; `--fix` installs Playwright, which a plugin update wipes:
   ```sh
   node ${CLAUDE_SKILL_DIR}/scripts/doctor.mjs <workDir> --fix
   ```
3. Show the user the short plan and ask, **in one AskUserQuestion call**, anything that is
   missing or that the doctor flagged — never fill it in yourself:
   - which scenes to film (all, or a re-take list);
   - the display: the doctor reports how many are connected; with one, say that the staged
     windows will cover their screen for the whole take;
   - the voice, if `tts.voiceId` is empty (auditioned in phase 1) — and the provider, if
     there is no ElevenLabs key: wait for the key, or switch to `say` for a draft;
   - anything the doctor marked ✗ that only they can fix (permissions, starting the app).

## Re-shooting one scene

The common case once a video exists. Nothing else is touched, and the other scenes'
clips are reused from the cache:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/stage-up.mjs <workDir>          # if the stage is not up
node ${CLAUDE_SKILL_DIR}/scripts/director.mjs <workDir> --scenes=s6
python3 ${CLAUDE_SKILL_DIR}/scripts/assemble.py <workDir> s6     # re-mixes s6, re-concats all
${CLAUDE_SKILL_DIR}/scripts/sheet.sh <workDir> s6                # then hand to screencast-demo-maker:frame-checker
cp ~/.cache/demo-video/<slug>/out/<slug>.mp4 <projectRoot>/<config.output>
```

`assemble.py` with scene arguments re-mixes only those scenes but always re-concatenates
the whole video, so the final file is complete. Copying to `config.output` is the
director's job, not the script's. Run preflight again first if monitors changed.

## Ground rules

- **No synthetic OS input.** Never send CGEvent/System Events mouse moves or
  keystrokes — the sandbox blocks it and it is fragile anyway. The engine drives
  VS Code with `code -r -g`, Terminal with AppleScript `do script`, the browser
  with Playwright.
- **Never click `config.neverClick`**, and no other control that changes data unless the
  project's `*-demo` skill allows it and the scene's pre-roll restores the state. Hover to
  show that a control exists.
- **The user's pointer is on camera.** It must be on another display before filming —
  or, with a single display, parked in a corner the scenes never use.
- **What lands in the project:** `scenes.mjs` and the chosen voice in `config.json` (both
  in the demo folder), and the final mp4 at `config.output`. Everything else stays in the cache.

## Phase 0 — preflight

```sh
node ${CLAUDE_SKILL_DIR}/scripts/preflight.mjs <workDir> [--display=1920x1080]
```

Checks tools, Automation and Screen Recording permission, maps the target display to
its avfoundation capture index, pings `config.healthUrls`, and writes
`~/.cache/demo-video/<slug>/stage.json`. It exits non-zero and names what blocks.

Show the user the checklist. If a permission is missing, open the right pane
(`open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"`)
and wait — do not try to work around it. Display indexes change whenever a monitor is
re-plugged, so preflight runs again after any change to the display setup.

Then stage the windows. Only the apps in `config.surfaces` come up (`editor` → VS Code,
`terminal` → Terminal.app); Chrome starts later, right before the first browser scene:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/stage-up.mjs <workDir>
```

## Phase 1 — narration

`config.tts.provider` picks the engine:

| Provider | Voice id | Needs |
|---|---|---|
| `elevenlabs` (default) | an ElevenLabs voice id | an API key in the Keychain; free tier is 10k chars/month |
| `say` | a macOS voice name (`Samantha`, `Lesya`) | nothing — free, offline, robotic; fine for drafts |

For ElevenLabs, if the doctor reports no key, ask the user to run once (hidden input,
never in chat): `security add-generic-password -s elevenlabs-api -a "$USER" -w`.

```sh
node ${CLAUDE_SKILL_DIR}/scripts/tts.mjs <workDir> voices
node ${CLAUDE_SKILL_DIR}/scripts/tts.mjs <workDir> audition <cueId> <voice:label> [...]
node ${CLAUDE_SKILL_DIR}/scripts/tts.mjs <workDir> all [cueId ...]
```

If `config.tts.voiceId` is set, use it. Otherwise audition 3 voices that speak
`config.tts.language` on the cue with the most foreign-language terms, `open` the
audition folder and ask the user to choose — you cannot judge a voice, so never pick
one silently. Save the winner to `config.json`.

`all` trims silence, converts to 48 kHz wav and flags clips whose length is far from
`chars / tts.charsPerSecond`; re-generate anything flagged.

## Phase 2 — scenes

Write `<workDir>/scenes.mjs` against the engine (`reference/scenes-api.md`); start from
`templates/scenes.example.mjs` and `templates/config.example.json` for a new project.
Discover selectors headlessly first — `ariaSnapshot()` on the real page, never guess:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/director.mjs <workDir> --dry --scenes=s6,s7
```

`--dry` runs every action with 1.2 s cues and no recording, and writes the stills a
scene asks for. Check those stills before filming for real.

## Phase 3 — the gate

Tell the user, then stop and wait for "go":

1. pointer off the filmed display, or in an unused corner of the only one (preflight re-checks this);
2. no typing while it runs — keyboard focus jumps to the staged windows;
3. Do Not Disturb on, and hands off the filmed display.

## Phase 4 — film and assemble

```sh
node ${CLAUDE_SKILL_DIR}/scripts/director.mjs <workDir> [--scenes=s4,s5]
python3 ${CLAUDE_SKILL_DIR}/scripts/assemble.py <workDir>
```

Each scene records to `<cache>/scenes/<id>.mp4` with a `<id>.json` of cue offsets;
assembly mixes the wavs at those offsets, normalises loudness and concatenates in
`config.order`. Re-shooting one scene and re-assembling is always safe.

## Phase 5 — verify

```sh
${CLAUDE_SKILL_DIR}/scripts/sheet.sh <workDir> <scene>     # per scene
```

Hand the sheets to the **`screencast-demo-maker:frame-checker` subagent** with the expected content per
cue — do not read contact sheets in the main conversation, they are enormous.
Also check the assembled file yourself:

```sh
ffmpeg -hide_banner -nostats -i <cache>/out/<slug>.mp4 -af "volumedetect,silencedetect=n=-45dB:d=4" -vn -f null -
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of default=nw=1 <cache>/out/<slug>.mp4
```

Silent gaps over ~5 s mean an action outran its line: shorten the wait or give the
cue more to do, then re-shoot that scene. Report honestly that you cannot hear the
audio; the user judges voice quality.

**Verification is a loop, not a step.** Expect two or three rounds: fix what the
checker names, re-shoot only those scenes, re-assemble, hand the new sheets back. A
re-shoot re-times the scene, so a scene that changed must be re-checked even when the
edit looked trivial — and a fix in one cue routinely breaks the pacing of the next.
Deliver only after a pass with no failures, and say which scenes were checked.

Do not drift into polishing beyond what the checker flags. The video is done when every
cue passes and the probes are clean; taste questions (voice, phrasing, whether a true
claim is worth showing) belong to the user, not to another re-shoot.

## Phase 6 — deliver

Copy `<cache>/out/<slug>.mp4` to `config.output`, list what you verified and what
only the user can judge. Keep the cache (re-takes are cheap). On request, quit the
staged VS Code (`pkill -f <cache>/vscode/data`) and the Terminal window.
