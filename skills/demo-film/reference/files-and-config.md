# Files, config and the working cache

## The four input files

| File | Written by | What it is |
|---|---|---|
| `config.json` | demo-setup (voice added by demo-film) | everything machine- and project-specific |
| `scenario.md` | demo-scenario | the human view: scenes, what is shown, what is said |
| `cues.json` | demo-scenario | a **bare JSON array** `[{ "id", "scene", "text" }]`, playback order |
| `scenes.mjs` | demo-film, phase 2 | the code that drives the screen — see `scenes-api.md` |

## `config.json`

`scripts/config.mjs` validates it; `doctor.mjs <workDir>` prints every problem at once.

```jsonc
{
  // --- required ---
  "slug": "myapp-intro",           // names the cache dir ~/.cache/demo-video/<slug>/; ≤ 40 chars
  "projectRoot": "../..",          // absolute, or relative to this folder; file paths in scenes.mjs are relative to it
  "output": "demo/intro/intro.mp4",// where the finished video is copied, relative to projectRoot
  "order": ["s1", "s2", "…"],      // PLAYBACK order — what the concat step follows

  // --- optional (default) ---
  "surfaces": ["browser", "editor", "terminal"],  // (all three) which apps are staged and checked
  "healthUrls": ["http://localhost:3000"],        // ([]) preflight and doctor ping these
  "video": { "fps": 30, "zoom": 1.25, "display": "1920x1080" },  // display: (first non-main screen)
  "tts": {
    "provider": "elevenlabs",      // ("elevenlabs") or "say" — the free macOS voice
    "voiceId": "…",                // ElevenLabs voice id, or a `say` voice name; empty = audition first
    "voiceName": "Eric",           // for humans only
    "language": "en",              // narration language; filters `say` voices, guides the audition
    "model": "eleven_multilingual_v2",
    "keychainService": "elevenlabs-api",        // `security find-generic-password -s <this> -w`
    "charsPerSecond": 14,          // (14) expected speaking rate: pacing budget and the <-- CHECK flag
    "rate": 180,                   // `say` only: words per minute
    "voiceSettings": {}            // ElevenLabs only: merged over stability 0.5, similarity 0.75
  },
  "vscode": {                      // "editor" surface only
    "firstFile": "README.md",      // (README.md) opened when the editor is staged
    "hide": ["**/node_modules"],   // added to files.exclude
    "settings": {}                 // merged over templates/vscode-settings.json
  },
  "codeBin": "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
  "terminal": {                    // "terminal" surface only
    "fontSize": 14,
    "init": "…"                    // (PATH with the current node first; cd projectRoot; clear) — runs once
  },
  "web": { "baseUrl": "…" },       // free-form; scenes.mjs reads it as config.web
  "neverClick": ["Delete"]         // ([]) never clicked by any scene, whatever the video is about
}
```

**Two different orders, on purpose.** `config.order` is the order the finished video
plays in and is what assembly concatenates. `scenes.mjs`'s exported `order` is the order
scenes are *filmed* in — usually file scenes first, browser scenes last, so Chrome starts
once. They are unrelated lists and both must name every scene.

## The cache — `~/.cache/demo-video/<slug>/`

Nothing here belongs in the repository; all of it is rebuildable.

| Path | What |
|---|---|
| `stage.json` | written by preflight: display, capture index, VS Code path, Terminal window id |
| `audio/<cue>.wav` | narration, trimmed; `audio/raw/` keeps the original mp3s |
| `audition/` | voice samples, for the user to listen to |
| `scenes/<id>.mp4` | raw silent clip of one scene |
| `scenes/<id>.json` | `{ "end": <seconds>, "cues": [{ id, at, dur }] }` — offsets, and where the scene meant to stop |
| `out/<id>.mp4` | that scene with narration mixed in |
| `out/<slug>.mp4` | the concatenated result, copied to `config.output` |
| `frames/` | stills and contact sheets |
| `vscode/`, `chrome-profile/` | the staged apps' isolated profiles |

Keep the cache between sessions: re-shooting one scene is a minute's work only because
the other scenes' clips are still here.

## Script flags and environment

| Script | Flags |
|---|---|
| `doctor.mjs [workDir]` | `--fix` installs Playwright into `scripts/` |
| `preflight.mjs <workDir>` | `--display=WxH`, `--display-id=N` override `video.display` |
| `stage-up.mjs <workDir>` | `--no-code`, `--no-term` skip an app for this run on top of `surfaces` |
| `director.mjs <workDir>` | `--dry` (no recording, 1.2 s cues, stills), `--scenes=s4,s5` |
| `tts.mjs <workDir>` | `voices` · `audition <cue> <voice:label>…` · `all [cue…]` |
| `assemble.py <workDir> [scene…]` | re-mixes the named scenes, always re-concatenates all |

`AUDIO_DIR=<name>` makes `tts.mjs`, the engine and `assemble.py` use `<cache>/<name>/`
instead of `<cache>/audio/` — handy for comparing two voices without regenerating the other.
