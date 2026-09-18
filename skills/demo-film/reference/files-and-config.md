# Files, config and the working cache

## The four input files

`demo-scenario` writes the first two; the other two are written during filming.

| File | Written by | What it is |
|---|---|---|
| `scenario.md` | demo-scenario | the human view: scenes, what is shown, what is said |
| `cues.json` | demo-scenario | a **bare JSON array** `[{ "id", "scene", "text" }]`, playback order |
| `scenes.mjs` | demo-film, phase 2 | the code that drives the screen — see `scenes-api.md` |
| `config.json` | demo-film, phase 0 | everything machine- and project-specific |

## `config.json`

```jsonc
{
  "slug": "myapp-L01",             // names the cache dir: ~/.cache/demo-video/<slug>/
  "projectRoot": "/abs/path",      // every file path in scenes.mjs is relative to this
  "output": "hw/L01/demo-L01.mp4", // where the finished video is copied, relative to projectRoot
  "order": ["s1", "s2", "…"],      // PLAYBACK order — what the concat step follows
  "healthUrls": ["http://localhost:3000"],   // preflight pings these
  "video": { "fps": 30, "zoom": 1.25, "display": "1920x1080" },
  "tts": {
    "voiceId": "…",                // ElevenLabs voice; empty means audition first
    "voiceName": "Eric",           // for humans only
    "model": "eleven_multilingual_v2",
    "keychainService": "elevenlabs-api"      // `security find-generic-password -s <this> -w`
  },
  "vscode": {
    "firstFile": "CLAUDE.md",      // opened when the editor is staged
    "hide": ["hw", "**/node_modules"]         // becomes files.exclude
  },
  "terminal": {
    "fontSize": 14,
    "init": "export PATH=…; cd /abs/path; clear"   // runs once; the staged shell inherits nothing
  },
  "web": { "baseUrl": "…" },       // free-form; scenes.mjs reads it as config.web
  "neverClick": ["Run Review", "Delete"]        // documentation for whoever writes scenes.mjs
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
