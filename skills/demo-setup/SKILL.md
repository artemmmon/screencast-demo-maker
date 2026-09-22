---
name: demo-setup
description: Sets a project up for narrated demo videos with the screencast-demo-maker plugin — interviews the user about what to film (surfaces, URLs, voice, language, display, forbidden controls, output), checks the Mac with the doctor script, and writes the demo folder's config.json plus a project skill `<project>-demo`. Use when the user wants to start making demo videos in a project, says "set up demo videos", "налаштуй демо-відео", "підготуй проєкт до демо", or when demo-scenario or demo-film finds no config.json. Not for writing the script itself (demo-scenario) or filming (demo-film).
---

# Demo setup

One conversation that turns "I want demo videos here" into a project that the other two
skills can work in. Output:

- `<demoDir>/config.json` — machine- and video-specific settings (`demo-film` reads it);
- `.claude/skills/<project>-demo/SKILL.md` — the project's filming rules, from
  `templates/project-skill.md` (both other skills read it first);
- optionally, the plugin entry in the project's `.claude/settings.json` so teammates get it.

Scripts live in `${CLAUDE_SKILL_DIR}/../demo-film/scripts/`. Write nothing before step 3.

## 0. Your own ElevenLabs key — before anything else

Narration defaults to ElevenLabs, and every person films with **their own** key, stored in
their own Keychain — never shared, committed or pasted into chat. Before step 1, check for
it and, if it is missing, walk the user through getting one exactly as
`../demo-film/reference/elevenlabs-key.md` says. Wait for "done" (or for the user to choose
the free `say` voice instead) before continuing.

## 1. Look before asking

Read, and do not ask about, whatever the project already answers:

- an existing `.claude/skills/*-demo/SKILL.md` or any `**/demo/**/config.json` — if one
  exists, this is an update: show it and ask only what should change;
- `package.json` scripts, `README`, `docker-compose*` — likely app URLs and the start command;
- `git remote -v` — the project name;
- the user's language in this conversation — the default narration language.

## 2. Ask — once, up front, all together

Use AskUserQuestion (or one numbered message if it is unavailable), at most 4 questions a
call, two calls at most. Offer the value you found in step 1 as the first, "(Recommended)"
option. Never guess an answer the user has not confirmed.

| # | Question | Becomes |
|---|---|---|
| 1 | What is this video for — which spec, criteria, PR or feature is the source of truth? | project skill "Source of truth" |
| 2 | Where do demo files live? (default `demo/<name>/`; one folder per video) | `<demoDir>`, `output` |
| 3 | What appears on screen: browser, code editor (VS Code), terminal? | `surfaces` |
| 4 | App URL(s) to film, and how the app is started | `web.baseUrl`, `healthUrls`, project skill |
| 5 | Narration language and audience | `tts.language`, project skill |
| 6 | Voice: ElevenLabs (natural, needs *your own* free API key — step 0) or macOS `say` (free, robotic) | `tts.provider` |
| 7 | Displays: a spare monitor to film on, or only one screen? | `video.display` |
| 8 | Controls that must never be clicked (delete, deploy, paid actions) — or may the video click mutating controls if a pre-roll restores the data? | `neverClick`, project skill |

Target length is asked later by `demo-scenario`, per video, not here.

## 3. Check the Mac

```sh
node ${CLAUDE_SKILL_DIR}/../demo-film/scripts/doctor.mjs <demoDir> --fix
```

`--fix` only installs Playwright into the plugin folder. Show the checklist as it
printed. Every ✗ has an exact fix under it: run the ones that are plain commands only
with the user's go-ahead; permissions and API keys are the user's to grant — give the
command and wait. The key procedure is in `../demo-film/reference/elevenlabs-key.md`.

## 4. Write the files

1. `<demoDir>/config.json` from `../demo-film/templates/config.example.json`:
   - `slug` = `<project>-<video>`, short (it names `~/.cache/demo-video/<slug>`);
   - `projectRoot` relative to `<demoDir>` (e.g. `"../.."`), so the folder works on every clone;
   - `order` = `["s1"]` for now — `demo-scenario` fills it;
   - `surfaces`, `healthUrls`, `web`, `tts.provider`, `tts.language`, `neverClick` from the answers;
   - `tts.voiceId` empty: the user picks a voice by ear during filming;
   - drop `vscode` / `terminal` blocks the surfaces do not use.
2. `.claude/skills/<project>-demo/SKILL.md` from `templates/project-skill.md`. Fill every
   `{{…}}`; delete a section rather than leave a placeholder in it.
3. Run the doctor again on `<demoDir>`: the project half must be all ✓.

## 5. Offer team install (ask first)

If the project is shared, offer to add this to `.claude/settings.json` (merge, never
overwrite existing keys). Anyone who trusts the folder then gets the plugin enabled:

```json
{
  "extraKnownMarketplaces": {
    "screencast-demo-maker": { "source": { "source": "github", "repo": "artemmmon/screencast-demo-maker" } }
  },
  "enabledPlugins": { "screencast-demo-maker@screencast-demo-maker": true }
}
```

## 6. Hand off

Tell the user what was written and what the doctor still flags, then the next steps:

1. "write the demo scenario for <feature>" — `demo-scenario`, reviewed by the user;
2. start the app, then type `/screencast-demo-maker:demo-film` — filming is user-invoked only.
