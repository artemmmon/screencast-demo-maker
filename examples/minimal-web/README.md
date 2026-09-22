# Example: minimal web demo

The smallest complete input for `demo-film`: two browser scenes against a static page,
narrated by the free macOS `say` voice. Use it to check that filming works on a new Mac
before pointing the plugin at a real project.

| File | Written by | What |
|---|---|---|
| `scenario.md`, `cues.json` | `demo-scenario` | what is shown and said |
| `config.json` | `demo-setup` | surfaces, voice, URLs, output |
| `scenes.mjs` | `demo-film` | what the pointer does while each line plays |
| `site/` | — | the "app" being filmed |

```sh
python3 -m http.server 8765 -d site          # in this folder; keep it running
```

Then, in Claude Code opened on this folder: `/screencast-demo-maker:demo-film`.
To drive it by hand instead, with `P` the plugin's `skills/demo-film/scripts` folder:

```sh
node $P/doctor.mjs . --fix
node $P/preflight.mjs .
node $P/tts.mjs . all
node $P/director.mjs . --dry       # no recording; stills in ~/.cache/demo-video/example-minimal-web/frames
node $P/director.mjs .
python3 $P/assemble.py .
```
