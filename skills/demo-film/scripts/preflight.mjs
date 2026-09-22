// Phase 0: check tools, permissions and displays; write <cache>/stage.json.
//
//   node preflight.mjs <workDir> [--display=1920x1080] [--display-id=3]
//
// Prints a checklist and exits non-zero when something blocks filming.
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { cacheDirFor, loadOrExit, uses } from './config.mjs';
import { checkMachine, DEFAULT_CODE_BIN } from './doctor.mjs';

const args = process.argv.slice(2);
const workDir = path.resolve(args.find(a => !a.startsWith('--')) ?? '.');
const wantId = (args.find(a => a.startsWith('--display-id=')) ?? '').replace('--display-id=', '');
const here = path.dirname(new URL(import.meta.url).pathname);

const config = loadOrExit(workDir);
// Resolution to film at: --display wins, then config.video.display, then the first secondary screen.
const want = (args.find(a => a.startsWith('--display=')) ?? '').replace('--display=', '') || (config.video?.display ?? '');
const cache = cacheDirFor(config.slug);
fs.mkdirSync(path.join(cache, 'frames'), { recursive: true });

const ok = [], bad = [];
const note = (good, msg) => (good ? ok : bad).push(msg);
const run = (cmd, a) => execFileSync(cmd, a, { encoding: 'utf8' }).trim();
const quiet = (cmd, a) => { try { return run(cmd, a); } catch { return null; } };

// ---------- tools, permissions, TTS key, app health (shared with doctor.mjs) ----------
for (const c of await checkMachine(config)) (c.ok ? ok : bad).push(c.ok ? c.label : `${c.label} — ${c.fix}`);
const codeBin = config.codeBin ?? DEFAULT_CODE_BIN;
if (uses(config, 'editor')) {
  const len = path.join(cache, 'vscode/data').length;
  note(len < 80, `cache path length ${len} (VS Code sockets cap at 103)`);
}

// ---------- displays ----------
const displays = run('swift', [path.join(here, 'displays.swift')]).split('\n').filter(Boolean)
  .map((l, i) => { const [id, x, y, w, h, main] = l.split(/\s+/); return { id: +id, x: +x, y: +y, w: +parseFloat(w), h: +parseFloat(h), main: main === 'true', screencaptureIndex: i + 1 }; });
console.log('displays:', displays.map(d => `#${d.id} ${d.w}x${d.h} @${d.x},${d.y}${d.main ? ' (main)' : ''}`).join(' · '));

let target = wantId ? displays.find(d => d.id === +wantId)
  : want ? displays.find(d => `${d.w}x${d.h}` === want)
  : displays.find(d => !d.main) ?? displays[0];
if (!target) { console.error(`\nNo display matches ${wantId || want}. Connect it, or pass --display=WxH.`); process.exit(1); }
note(!target.main || displays.length === 1, target.main ? 'filming the MAIN display — your Claude Code window is on it' : 'filming a secondary display');

// Screen Recording + capture-index mapping: grab one frame from each avfoundation screen device.
// `-list_devices` always exits non-zero and writes to stderr; capture it, don't let it through.
const devs = (() => {
  try { return execSync('ffmpeg -f avfoundation -list_devices true -i "" 2>&1', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { return e.stdout ?? e.stderr ?? ''; }
})();
const indexes = [...devs.matchAll(/\[(\d+)\] Capture screen \d+/g)].map(m => +m[1]);
let captureIndex = null;
for (const i of indexes) {
  const f = path.join(cache, `frames/_probe${i}.png`);
  try {
    execSync(`ffmpeg -y -loglevel error -f avfoundation -framerate 30 -pixel_format uyvy422 -i "${i}:none" -frames:v 1 "${f}" 2>/dev/null`);
    const [w, h] = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).split(',').map(Number);
    if (w === target.w && h === target.h) captureIndex = i;
    fs.rmSync(f, { force: true });
  } catch { /* device busy or not permitted */ }
}
note(captureIndex !== null, captureIndex !== null ? `capture index ${captureIndex} → ${target.w}x${target.h}` : 'could not map the display to a capture device');

// ---------- pointer ----------
const [px, py] = run('swift', [path.join(here, 'ptr.swift')]).split(/\s+/).map(Number);
const onTarget = px >= target.x && px < target.x + target.w && py >= target.y && py < target.y + target.h;
if (onTarget && displays.length === 1) ok.push(`one display: park the pointer in a corner before "go" — it will be in frame there`);
else if (onTarget) bad.push(`pointer is ON the filmed display (${px|0},${py|0}) — move it away before filming`);
else ok.push(`pointer off the filmed display (${px|0},${py|0})`);

// ---------- write stage.json ----------
const machine = {
  display: { ...target, captureIndex },
  codeBin,
  termWindowId: (() => { try { return JSON.parse(fs.readFileSync(path.join(cache, 'stage.json'), 'utf8')).termWindowId ?? null; } catch { return null; } })(),
  checkedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(cache, 'stage.json'), JSON.stringify(machine, null, 2));

console.log('\nOK:');
for (const l of ok) console.log('  ✓', l);
if (bad.length) { console.log('\nBLOCKING:'); for (const l of bad) console.log('  ✗', l); }
console.log(`\ncache: ${cache}\nstage.json written.`);
process.exit(bad.length ? 1 : 0);
