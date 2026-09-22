# Writing `scenes.mjs`

```js
// FILMING order — not the order the video plays in. Playback order is `config.order`,
// which is what assembly concatenates. Both lists must name every scene.
export const order   = ['s2', 's3', 's1', 's6'];
export const browser = ['s1', 's6'];               // scenes needing Chrome

export default function scenes(stage) {
  const { sleep, record, stop, cue, shot, code, term, web, config, dry } = stage;
  return {
    async s2() {
      code.open('README.md', 1); await sleep(1500);   // pre-roll, before recording
      await record('s2');
      await cue('s2-01', () => code.open('README.md', 7));
      await stop();
    },
  };
}
```

File scenes first, browser scenes last: Chrome starts once, just before the first
scene listed in `browser`, and the Terminal window is minimised at that point.

Destructure only what `config.surfaces` stages: a browser-only video uses `web` and never
touches `code` or `term` (see `examples/minimal-web` in the plugin repo).

## Recording

| Call | Meaning |
|---|---|
| `await record(id)` | start capturing; blocks until ffmpeg's clock is live |
| `await cue(id, fn)` | log the offset of narration `id`, run `fn(ms)` in parallel, hold for the clip |
| `await stop()` | stop and write `<id>.mp4` + `<id>.json` (assembly trims the clip back to here) |
| `shot(name)` | still into `<cache>/frames/<name>.png` (use under `if (dry)`) |

`fn` receives the clip length in ms — pace with it: `await sleep(ms * 0.5)` before
the move that the second half of the sentence describes.

Anything outside `record`/`stop` is not filmed: use it for pre-roll and cleanup.

## Editor and terminal

```js
code.open('src/app.ts', 12);       // jump in the isolated VS Code
term.run('npm test');              // type-less command in the staged window
term.front();                        // bring it forward
term.hide(); term.show();
```

## Browser

```js
await web.open(url);                 // navigate + re-apply zoom and cursor overlay
const p = web.page;                  // the Playwright page
await web.glide(x, y, ms);           // eased pointer move
await web.glideTo(locator, ms);
await web.clickOn(locator, ms);      // glide, pause, click
await web.hoverInto(trigger, { dx, dy, hold });   // open a popover and move into it
await web.scrollIntoCenter(locator);
await web.scrollIntoStart(locator);
await web.scrollBy('main', 260);
await web.wheel(totalPx, step, ms);  // slow, readable scroll
const [x, y] = web.pos;
await web.prep();                    // re-apply zoom + cursor after a same-page nav
```

Find selectors with `ariaSnapshot()` on the real page before writing the scene;
prefer `getByRole(...)` names over CSS.

## Rules

- Never click anything in `config.neverClick`. To show such a control, hover it.
- Re-`prep()` after any navigation that Playwright does not drive (a click on a link
  inside the page still needs it).
- Keep a scene under ~70 seconds; it is the unit of re-shooting.
- Put `if (dry) shot('dry-<scene>')` at each moment you want to verify before filming.
