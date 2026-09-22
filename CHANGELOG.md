# Changelog

Versions follow [SemVer](https://semver.org). Claude Code re-installs the plugin only
when `.claude-plugin/plugin.json` `version` changes, so every release bumps it (in
`marketplace.json` too) and is tagged with `claude plugin tag --push`, which checks that
the two agree and creates `screencast-demo-maker--vX.Y.Z`. Bump rule: patch — wording and fixes; minor — new skill, config key or
script flag; major — a `config.json` or `scenes.mjs` change that breaks existing demos.

## 1.1.0 — 2026-09-22

### Added
- Each user's own ElevenLabs key: `demo-setup` and `demo-film` check for it before any
  other work and walk the user through creating and storing it (`reference/elevenlabs-key.md`).
- `demo-setup` skill: asks what to film up front, runs the doctor, writes `config.json`
  and a `<project>-demo` project skill from a template, offers the team-install snippet.
- `doctor.mjs`: one command that checks the Mac and a demo folder and prints the fix for
  each problem; `--fix` installs Playwright. `preflight.mjs` reuses its checks.
- `config.mjs`: `config.json` is validated with readable errors instead of TypeErrors.
- `surfaces` config key: stage and check only the apps a video uses (browser-only videos
  no longer need VS Code or Terminal).
- `tts.provider: "say"` — free, offline macOS voice; `tts.language`, `tts.charsPerSecond`,
  `tts.rate`, `tts.voiceSettings`.
- `projectRoot` may be relative to the demo folder, so committed demos work on any clone.
- Single-display filming: a warning instead of a blocker.
- `examples/minimal-web/`: a complete browser-only demo to try the plugin on.
- README with install for a person and for a team repo, troubleshooting, update/uninstall;
  LICENSE; this changelog; trigger evals for `claude plugin eval`.

### Changed
- `tts-el.mjs` → `tts.mjs` (same commands).
- `demo-film` starts with an explicit intake phase; `demo-scenario` asks its questions in
  one batch before writing and sets `config.order`.
- The terminal's default init puts the running Node first on PATH instead of a hard-coded
  Homebrew path. `vscode.hide` now adds to the template's `files.exclude`.
- Examples and references no longer mention the project the plugin was born in.

## 1.0.0 — 2026-09-18

First release: `demo-scenario`, `demo-film` (ElevenLabs narration, isolated VS Code,
Terminal and Chrome, ffmpeg capture, assembly), `frame-checker` subagent.
