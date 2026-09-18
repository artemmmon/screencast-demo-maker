# Gotchas

Everything here cost time to discover. Read before debugging.

## Input and permissions

- **Synthetic input is blocked.** A Swift CGEvent helper (mouse move, scroll,
  keystroke) is refused by the auto-mode classifier as self-driving. Do not rebuild
  it. Everything is driven through app-level APIs instead: `code -r -g`,
  AppleScript `do script`, Playwright's `page.mouse`.
- Because of that, **Accessibility permission is not needed**. Screen Recording and
  Automation are.
- **Permission state is per host app.** Grants belong to the terminal the session
  runs in (Terminal.app vs iTerm vs VS Code). `AXIsProcessTrusted: false` while the
  toggle looks on usually means the grant went to a different app — remove and re-add.
- Some checks (`swift ptr.swift`, `osascript`) answer differently inside the command
  sandbox. Run them with the sandbox disabled when the answer looks wrong.

## Displays and capture

- **Indexes are not stable.** The avfoundation capture index and `screencapture -D`
  number change whenever a monitor is plugged, unplugged or rearranged. Map them by
  grabbing one frame from each device and comparing resolution — never hard-code.
- `screencapture -D` is 1-based over `CGGetActiveDisplayList`; avfoundation numbers
  its own devices. They do not match.
- **The real pointer is recorded even with `-capture_cursor 0`** when it sits still
  on the filmed display. It must be moved to another screen.
- Sync the clip clock to ffmpeg's own `-progress` `out_time_us`, not to spawn time;
  startup latency is hundreds of milliseconds and varies.
- ffmpeg also keeps writing for ~3 s after `q`. That tail is silent video at the end of
  every scene and adds up fast. `stop()` records the intended end in the scene json and
  assembly trims to it — so a scene's real ending is the last `sleep()` you wrote, not
  whatever the encoder did afterwards.

## VS Code

- `--user-data-dir` must be short: VS Code opens a unix socket inside it and fails
  with `listen EINVAL` past 103 characters. `~/.cache/demo-video/<slug>/vscode/data`
  fits; a session scratchpad path does not.
- There is **no CLI flag for window bounds**. Pre-seed
  `User/globalStorage/storage.json` → `windowsState.lastActiveWindow.uiState` before
  launching, and launch after writing it.
- **`code -r -g` lands ~1.3–1.8 s after it is called, and `stage.code.open` blocks for
  that whole round-trip.** It is deliberately synchronous, so a scene's pacing is the sum
  of your `sleep()`s *plus* ~1.5 s per jump — count the jumps when a gap comes out longer
  than you wrote. Every cue timing has to budget for it:
  - a line under ~3 s has room for exactly one jump, fired at the start of the cue;
  - showing three files inside one short line does not work — open the first one during
    the gap before the cue and let the line cover the last two;
  - to raise VS Code over the Terminal mid-line, open the target file *before* recording
    too, otherwise the previous scene's file flashes while it comes forward.
- **Always pass the column**: `-g file:line` on a file that is already open anchors a
  *selection* from the previous cursor position, so half the document appears
  highlighted on camera. `-g file:line:1` just moves the cursor. `stage.code.open`
  does this for you.
- `"editor.smoothScrolling": true` makes `code -r -g file:line` look like a scroll
  rather than a cut. `"workbench.editor.showTabs": "single"` stops tabs piling up
  across a scene.
- `files.exclude` hides noise folders from the explorer (`hw`, `temp`, clones).
- First launch shows welcome/AI dialogs; the template settings disable them, but
  launch once before filming anyway.

## Chrome / Playwright

- `channel: 'chrome'`, `chromiumSandbox: true`, and drop `--enable-automation` via
  `ignoreDefaultArgs` — otherwise the "controlled by automation" bar is in frame.
- `--no-sandbox` triggers a yellow warning bar. Never pass it.
- **`deviceScaleFactor` does nothing in headed mode.** To make a 1080p screen
  readable, set CSS `zoom` on `<html>` instead. Consequences:
  - a page whose shell is `min-height: 100vh` overflows — override it in the same
    stylesheet;
  - `zoom` must be re-applied after every navigation, and so must the cursor overlay;
  - the overlay divides client coordinates by the zoom factor.
- The first tab of a persistent context has focus in the omnibox (blue halo). Open a
  new tab and close the first one.
- Hide dev overlays (`nextjs-portal`).
- A hover popover closes on a diagonal dash. Approach in two straight moves — same
  column first, then down — and enter the panel slowly (`web.hoverInto`).
- `page.mouse` moves do not move the OS cursor, which is why the page draws its own.

## Terminal

- The staged window is a fresh login shell: it does **not** inherit the PATH or env of
  the session that launched it. A command that works for you can die there
  (`node` resolving to an old version, a missing toolchain). Put every export in
  `config.terminal.init` — it runs once when the window is created and survives the
  `cd … && clear` a scene does at its start.
- Always film a terminal scene once and read the frames. A command that fails still
  looks busy for a second, and the narration will happily talk over a stack trace.

## Narration

- ElevenLabs free tier returns **mp3 only**; request `mp3_44100_128` and convert.
- `previous_text` / `next_text` from neighbouring cues in the same scene keeps
  intonation continuous across cue boundaries.
- Trim leading/trailing silence per clip, then `loudnorm` once at assembly.
- A clip far shorter than `characters / 14` seconds is usually a truncated
  generation — re-generate rather than trusting it.
- Modern multilingual voices pronounce `snake_case` and `.it.test.ts` correctly.
  Phonetic respellings written for macOS `say` make them sound worse.

## Pacing

- Start the on-screen action *inside* the cue (`await sleep(ms * 0.5)`), not after
  it. Waiting for a line to finish before moving produces dead air.
- **A line that describes a state needs that state on screen when it starts.** Navigation
  — a tab switch, a page load, opening a panel — belongs *before* the cue, with an
  explicit `waitFor()`; only pointer movement and scrolling belong inside it. A click
  costs a full second of glide before the app even reacts, which is most of a short line.
- `silencedetect -d 4` on the final file finds every place that happened.
- When a command (test run, build) outruns its line, give the cue a second action
  that shows the result appearing.
