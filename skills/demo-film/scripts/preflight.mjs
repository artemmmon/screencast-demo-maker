// Phase 0: check tools, permissions and displays; write <cache>/stage.json.
//
//   node preflight.mjs <workDir> [--display=1920x1080] [--display-id=3]
//
// Prints a checklist and exits non-zero when something blocks filming.
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { cacheDirFor } from './stage.mjs';

const args = process.argv.slice(2);
const workDir = path.resolve(args.find(a => !a.startsWith('--')) ?? '.');
const wantId = (args.find(a => a.startsWith('--display-id=')) ?? '').replace('--display-id=', '');
const here = path.dirname(new URL(import.meta.url).pathname);

const config = JSON.parse(fs.readFileSync(path.join(workDir, 'config.json'), 'utf8'));
// Resolution to film at: --display wins, then config.video.display, then the first secondary screen.
const want = (args.find(a => a.startsWith('--display=')) ?? '').replace('--display=', '') || (config.video?.display ?? '');
const cache = cacheDirFor(config.slug);
fs.mkdirSync(path.join(cache, 'frames'), { recursive: true });

const ok = [], bad = [];
const note = (good, msg) => (good ? ok : bad).push(msg);
const run = (cmd, a) => execFileSync(cmd, a, { encoding: 'utf8' }).trim();
const quiet = (cmd, a) => { try { return run(cmd, a); } catch { return null; } };

// ---------- tools ----------
for (const [bin, hint] of [['ffmpeg', 'brew install ffmpeg'], ['ffprobe', 'brew install ffmpeg'],
  ['python3', 'ships with macOS'], ['swift', 'xcode-select --install'], ['screencapture', 'ships with macOS']]) {
  note(!!quiet('which', [bin]), `${bin}${quiet('which', [bin]) ? '' : ` MISSING — ${hint}`}`);
}
const nodeMajor = Number(process.versions.node.split('.')[0]);
note(nodeMajor >= 22, `node ${process.versions.node}${nodeMajor >= 22 ? '' : ' — needs >= 22'}`);
try { await import('playwright'); ok.push('playwright'); }
catch { bad.push('playwright MISSING — npm i playwright in the skill scripts dir'); }

const codeBin = config.codeBin ?? '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code';
note(fs.existsSync(codeBin), `VS Code CLI${fs.existsSync(codeBin) ? '' : ` MISSING at ${codeBin}`}`);
note(path.join(cache, 'vscode/data').length < 80, `cache path length ${path.join(cache, 'vscode/data').length} (VS Code sockets cap at 103)`);

// ---------- permissions ----------
const automation = quiet('osascript', ['-e', 'tell application "System Events" to get name of first process']) !== null;
note(automation, automation ? 'Automation (System Events)' : 'Automation DENIED — System Settings → Privacy → Automation → Terminal');

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
note(indexes.length > 0, indexes.length ? `Screen Recording (capture devices: ${indexes.join(', ')})` : 'Screen Recording DENIED — System Settings → Privacy → Screen Recording → Terminal');
note(captureIndex !== null, captureIndex !== null ? `capture index ${captureIndex} → ${target.w}x${target.h}` : 'could not map the display to a capture device');

// ---------- app under test ----------
for (const url of config.healthUrls ?? []) {
  const code = quiet('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-m', '5', url]);
  note(code === '200', `${url} → ${code ?? 'no answer'}`);
}

// ---------- pointer ----------
const [px, py] = run('swift', [path.join(here, 'ptr.swift')]).split(/\s+/).map(Number);
const onTarget = px >= target.x && px < target.x + target.w && py >= target.y && py < target.y + target.h;
if (onTarget) bad.push(`pointer is ON the filmed display (${px|0},${py|0}) — move it away before filming`);
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
