// Is this machine (and this project's config) ready to film? Read-only unless --fix.
//
//   node doctor.mjs [workDir] [--fix]
//
// Without a workDir it checks the machine only. With one it also validates config.json and
// only asks for what that config needs (no VS Code check when `surfaces` has no "editor",
// no Keychain check for the `say` voice, …). --fix runs the one safe repair: `npm install`
// of Playwright into this folder. Exit code: 0 ready, 1 something blocks.
//
// preflight.mjs imports checkMachine() from here, so the two never disagree.
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig, withDefaults, uses } from './config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const quiet = (cmd, a) => { try { return execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };

export const DEFAULT_CODE_BIN = '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code';
const CHROME = '/Applications/Google Chrome.app';

// Each check: { ok, label, fix? }. `fix` is the exact thing the user runs or clicks.
export async function checkMachine(config = null, { fix = false } = {}) {
  const out = [];
  const add = (ok, label, fixHint) => out.push({ ok, label, fix: ok ? undefined : fixHint });
  const surfaces = config ? config.surfaces : ['browser', 'editor', 'terminal'];

  add(process.platform === 'darwin', `macOS (${process.platform})`, 'filming uses AppleScript, avfoundation and CoreGraphics: macOS only');

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  add(nodeMajor >= 22, `Node ${process.versions.node}`, 'brew install node@22 — and put it first on PATH');

  for (const [bin, hint] of [['ffmpeg', 'brew install ffmpeg'], ['ffprobe', 'brew install ffmpeg'],
    ['python3', 'xcode-select --install'], ['swift', 'xcode-select --install']]) {
    add(!!quiet('which', [bin]), bin, hint);
  }

  let hasPlaywright = fs.existsSync(path.join(here, 'node_modules/playwright'));
  if (!hasPlaywright && fix) {
    execSync('npm install --no-fund --no-audit', { cwd: here, stdio: 'inherit' });
    hasPlaywright = fs.existsSync(path.join(here, 'node_modules/playwright'));
  }
  add(hasPlaywright, 'Playwright (in the plugin scripts folder)', `node ${path.join(here, 'doctor.mjs')} --fix`);

  if (surfaces.includes('browser')) add(fs.existsSync(CHROME), 'Google Chrome', 'install Google Chrome into /Applications');

  if (surfaces.includes('editor')) {
    const codeBin = config?.codeBin ?? DEFAULT_CODE_BIN;
    add(fs.existsSync(codeBin), `VS Code CLI (${codeBin})`,
      'install VS Code into /Applications, or set "codeBin" in config.json, or drop "editor" from "surfaces"');
  }

  // Automation: asking System Events for a process name is the cheapest call that needs it.
  const automation = quiet('osascript', ['-e', 'tell application "System Events" to get name of first process']) !== null;
  add(automation, 'Automation permission',
    'System Settings → Privacy & Security → Automation → allow your terminal app to control System Events and Terminal');

  // Screen Recording: without it avfoundation lists no "Capture screen" devices.
  const devs = (() => {
    try { return execSync('ffmpeg -f avfoundation -list_devices true -i "" 2>&1', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { return e.stdout ?? e.stderr ?? ''; }
  })();
  const screens = [...devs.matchAll(/\[(\d+)\] Capture screen \d+/g)].length;
  add(screens > 0, `Screen Recording permission (${screens} screen${screens === 1 ? '' : 's'} visible)`,
    'open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture" — allow your terminal app, then restart it');
  if (screens === 1) {
    out.push({ ok: true, warn: true, label: 'one display: filming works, but the staged windows cover your screen and the pointer must sit in a corner' });
  }

  if (config?.tts.provider === 'elevenlabs') {
    const key = quiet('security', ['find-generic-password', '-s', config.tts.keychainService, '-w']);
    add(!!key, `ElevenLabs key in Keychain (${config.tts.keychainService})`,
      `security add-generic-password -s ${config.tts.keychainService} -a "$USER" -U -w   (paste the key at the hidden prompt) — or set tts.provider to "say"`);
  }
  if (config?.tts.provider === 'say') add(!!quiet('which', ['say']), 'macOS say', 'ships with macOS');

  for (const url of config?.healthUrls ?? []) {
    const code = quiet('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-m', '5', url]);
    add(code !== null && code.startsWith('2'), `${url} → ${code ?? 'no answer'}`, 'start the app under test before filming');
  }
  return out;
}

export function checkProject(workDir) {
  const { config, problems } = readConfig(workDir);
  const out = problems.map(p => ({ ok: false, label: p, fix: `edit ${path.join(workDir, 'config.json')}` }));
  if (!config || problems.length) return { config: null, checks: out };
  const c = withDefaults(config);
  out.push({ ok: true, label: `config.json (${c.slug}, surfaces: ${c.surfaces.join(', ')}, voice: ${c.tts.provider})` });

  const cuesFile = path.join(workDir, 'cues.json');
  if (fs.existsSync(cuesFile)) {
    try {
      const cues = JSON.parse(fs.readFileSync(cuesFile, 'utf8'));
      const scenes = new Set(cues.map(x => x.scene ?? x.id.split('-')[0]));
      const missing = [...scenes].filter(s => !c.order.includes(s));
      out.push({ ok: Array.isArray(cues) && !missing.length,
        label: `cues.json (${cues.length} cues, ${scenes.size} scenes)`,
        fix: missing.length ? `config.order is missing scenes: ${missing.join(', ')}` : 'cues.json must be a bare JSON array' });
    } catch (e) { out.push({ ok: false, label: `cues.json: ${e.message}`, fix: 'write it with the demo-scenario skill' }); }
  } else {
    out.push({ ok: true, warn: true, label: 'no cues.json yet — the demo-scenario skill writes it' });
  }
  if (!fs.existsSync(path.join(workDir, 'scenes.mjs'))) {
    out.push({ ok: true, warn: true, label: 'no scenes.mjs yet — demo-film writes it in phase 2' });
  }
  if (!uses(c, 'editor') && !uses(c, 'terminal') && !uses(c, 'browser')) out.push({ ok: false, label: 'surfaces is empty' });
  return { config: c, checks: out };
}

export function printChecks(checks) {
  for (const c of checks) {
    const mark = !c.ok ? '✗' : c.warn ? '!' : '✓';
    console.log(`  ${mark} ${c.label}`);
    if (!c.ok && c.fix) console.log(`      → ${c.fix}`);
  }
}

// ---------- CLI ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const workArg = args.find(a => !a.startsWith('--'));
  const fix = args.includes('--fix');
  let config = null, all = [];
  if (workArg) {
    const workDir = path.resolve(workArg);
    console.log(`Project: ${workDir}`);
    const r = checkProject(workDir);
    printChecks(r.checks);
    config = r.config;
    all.push(...r.checks);
    console.log('');
  }
  console.log('Machine:');
  const m = await checkMachine(config, { fix });
  printChecks(m);
  all.push(...m);
  const blocking = all.filter(c => !c.ok).length;
  console.log(blocking ? `\n${blocking} thing(s) to fix before filming.` : '\nReady to film.');
  process.exit(blocking ? 1 : 0);
}
