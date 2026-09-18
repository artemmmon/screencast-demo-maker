// stage.mjs — the filming engine. A scenes.mjs file builds scenes against this API.
//
// Nothing here emits synthetic OS input events: VS Code is driven by `code -r -g`,
// Terminal by AppleScript `do script`, the browser by Playwright. See reference/gotchas.md.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const cacheDirFor = slug => path.join(os.homedir(), '.cache', 'demo-video', slug);

const osa = s => execFileSync('osascript', ['-e', s]).toString().trim();
const ffprobeDur = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// A visible pointer: the real macOS cursor is not reliably captured, so the page draws its own.
const CURSOR = () => {
  if (window.__cur) return;
  const c = document.createElement('div'); window.__cur = c;
  c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transform:translate(-200px,-200px);' +
    'background:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'22\' height=\'22\' viewBox=\'0 0 24 24\'><path d=\'M4 2l16 9-7 2-3 7z\' fill=\'white\' stroke=\'black\' stroke-width=\'1.5\'/></svg>") no-repeat;';
  document.documentElement.appendChild(c);
  const z = () => Number(getComputedStyle(document.documentElement).zoom) || 1;
  addEventListener('mousemove', e => { c.style.transform = `translate(${e.clientX / z() - 3}px,${e.clientY / z() - 2}px)`; }, true);
};

export async function createStage({ workDir, dry = false }) {
  const config = JSON.parse(fs.readFileSync(path.join(workDir, 'config.json'), 'utf8'));
  const cache = cacheDirFor(config.slug);
  const machine = JSON.parse(fs.readFileSync(path.join(cache, 'stage.json'), 'utf8'));
  for (const d of ['scenes', 'frames', 'out', 'audio']) fs.mkdirSync(path.join(cache, d), { recursive: true });

  const root = config.projectRoot;
  const fps = config.video?.fps ?? 30;
  const zoom = config.video?.zoom ?? 1.25;
  const audioDir = path.join(cache, process.env.AUDIO_DIR || 'audio');
  const p_ = f => path.join(cache, f);

  // ---------- recording ----------
  let rec = null;
  async function record(scene) {
    rec = { scene, log: [], t0: Date.now(), ff: null };
    if (dry) return;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-progress', 'pipe:1', '-stats_period', '0.1',
      '-f', 'avfoundation', '-framerate', String(fps), '-capture_cursor', '0', '-pixel_format', 'uyvy422',
      '-i', `${machine.display.captureIndex}:none`,
      '-r', String(fps), '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', '-pix_fmt', 'yuv420p',
      p_(`scenes/${scene}.mp4`)], { stdio: ['pipe', 'pipe', 'inherit'] });
    rec.ff = ff;
    // Clock sync: trust ffmpeg's own out_time_us for t0, not the spawn time.
    await new Promise(res => ff.stdout.on('data', d => {
      const m = /out_time_us=(\d+)/.exec(d.toString());
      if (m && Number(m[1]) > 0 && !rec.synced) { rec.synced = true; rec.t0 = Date.now() - Number(m[1]) / 1000; res(); }
    }));
    await sleep(700);
  }

  async function stop() {
    await sleep(dry ? 100 : 700);
    // ffmpeg keeps writing for a few seconds after `q`; remember where the scene *meant*
    // to end so assembly can trim the tail instead of leaving silent video.
    const end = (Date.now() - rec.t0) / 1000;
    if (rec.ff) { rec.ff.stdin.write('q'); await new Promise(r => rec.ff.on('close', r)); }
    fs.writeFileSync(p_(`scenes/${rec.scene}.json`), JSON.stringify({ end, cues: rec.log }, null, 1));
    console.log(`[${rec.scene}] done`, rec.log.map(l => `${l.id}@${l.at.toFixed(1)}`).join(' '), `end@${end.toFixed(1)}`);
  }

  // A narration slot: log the offset, run the on-screen action in parallel, hold for the clip length.
  // `action` receives the clip length in ms so it can pace itself (e.g. `await sleep(ms * 0.5)`).
  async function cue(id, action) {
    const d = ffprobeDur(path.join(audioDir, `${id}.wav`));
    rec.log.push({ id, at: (Date.now() - rec.t0) / 1000, dur: d });
    console.log(`  cue ${id} (${d.toFixed(1)}s)`);
    const hold = sleep(dry ? 1200 : d * 1000 + 400);
    if (action) await action(d * 1000);
    await hold;
  }

  const shot = name => execFileSync('screencapture', ['-x', '-D', String(machine.display.screencaptureIndex), p_(`frames/${name}.png`)]);

  // ---------- VS Code ----------
  const code = {
    // Jump to file:line in the isolated instance. Smooth scrolling makes this read as a scroll.
    // The column is always sent: `-g file:line` on an already-open file anchors a selection
    // from the previous position, which shows up on camera as a highlighted document.
    open(file, line = 1, col = 1) {
      execFileSync(machine.codeBin, ['--user-data-dir', p_('vscode/data'), '--extensions-dir', p_('vscode/ext'),
        '-r', '-g', `${path.join(root, file)}:${line}:${col}`]);
    },
  };

  // ---------- Terminal ----------
  const term = {
    run: cmd => osa(`tell application "Terminal" to do script ${JSON.stringify(cmd)} in window id ${machine.termWindowId}`),
    front: () => osa(`tell application "Terminal"\nset index of window id ${machine.termWindowId} to 1\nactivate\nend tell`),
    hide: () => osa(`tell application "Terminal" to set miniaturized of window id ${machine.termWindowId} to true`),
    show: () => osa(`tell application "Terminal" to set miniaturized of window id ${machine.termWindowId} to false`),
  };

  // ---------- Browser ----------
  let ctx = null, page = null, mx = 900, my = 500;
  const css = `html{zoom:${zoom}} ` +
    '[style*="min-height: 100vh"],[style*="min-height:100vh"]{min-height:80vh !important;height:80vh !important} ' +
    'nextjs-portal{display:none !important}';

  const web = {
    get page() { return page; },
    async up() {
      if (ctx) return;
      ctx = await chromium.launchPersistentContext(p_('chrome-profile'), {
        channel: 'chrome', headless: false, viewport: null, chromiumSandbox: true,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [`--window-position=${machine.display.x},${machine.display.y}`,
          `--window-size=${machine.display.w},${machine.display.h - 25}`,
          '--no-first-run', '--no-default-browser-check', '--disable-infobars', '--hide-crash-restore-bubble'],
      });
      // A fresh tab drops focus from the omnibox, so no blue halo in the shot.
      const first = ctx.pages()[0]; page = await ctx.newPage(); await first?.close(); await page.bringToFront();
    },
    // Navigate and re-apply zoom + cursor (both are per-document).
    async open(url, { wait = 'networkidle', settle = 800 } = {}) {
      await web.up();
      await page.goto(url, { waitUntil: wait });
      await web.prep();
      await sleep(settle);
    },
    async prep() {
      await page.addStyleTag({ content: css }).catch(() => {});
      await page.evaluate(z => { document.documentElement.style.zoom = String(z); }, zoom);
      await page.evaluate(CURSOR);
      await page.mouse.move(mx, my);
    },
    async glide(x, y, ms = 900) {
      const n = Math.max(8, Math.round(ms / 16)), x0 = mx, y0 = my;
      for (let i = 1; i <= n; i++) {
        const t = i / n, e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
        await sleep(12);
      }
      mx = x; my = y;
    },
    get pos() { return [mx, my]; },
    async center(loc) { const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; },
    async glideTo(loc, ms) { const [x, y] = await web.center(loc); await web.glide(x, y, ms); },
    // Re-reads the box right before pressing: a smooth scroll still settling moves the
    // target after glideTo measured it, and the click then lands on empty space.
    async clickOn(loc, ms) {
      await web.glideTo(loc, ms);
      await sleep(250);
      const [x, y] = await web.center(loc);
      if (Math.hypot(x - mx, y - my) > 2) await web.glide(x, y, 160);
      await page.mouse.down(); await sleep(60); await page.mouse.up();
    },
    // Click, then confirm the app reacted; re-click once if it did not.
    async clickUntil(loc, check, ms) {
      await web.clickOn(loc, ms);
      await sleep(400);
      if (await check()) return true;
      await web.clickOn(loc, 200);
      await sleep(400);
      return check();
    },
    // Hover a trigger, then move *into* its popover along a straight line — a diagonal dash closes it.
    async hoverInto(trigger, { dx = 60, dy = 170, hold = 0 } = {}) {
      const [x, y] = await web.center(trigger);
      await web.glide(x, my, 1200); await web.glide(x, y, 300);
      if (hold) await sleep(hold);
      await web.glide(x + dx, y + dy, 1100);
    },
    scrollIntoCenter: loc => loc.evaluate(e => e.scrollIntoView({ behavior: 'smooth', block: 'center' })),
    scrollIntoStart: loc => loc.evaluate(e => e.scrollIntoView({ behavior: 'smooth', block: 'start' })),
    scrollBy: (sel, dy) => page.evaluate(([s, d]) => document.querySelector(s).scrollBy({ top: d, behavior: 'smooth' }), [sel, dy]),
    async wheel(total, step = 5, ms = 40) { for (let i = 0; i < Math.round(total / step); i++) { await page.mouse.wheel(0, step); await sleep(ms); } },
    async close() { if (ctx) { await ctx.close(); ctx = null; page = null; } },
  };

  return { config, machine, cache, root, dry, sleep, record, stop, cue, shot, code, term, web,
           path: p_, audioDir };
}
