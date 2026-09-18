// Opens and places the stage windows on the filmed display, then records the Terminal window id.
//
//   node stage-up.mjs <workDir> [--no-code] [--no-term]
//
// The VS Code instance is isolated (its own user-data-dir), so your real editor,
// its tabs and its extensions are never on camera.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { cacheDirFor, sleep } from './stage.mjs';

const args = process.argv.slice(2);
const workDir = path.resolve(args.find(a => !a.startsWith('--')) ?? '.');
const here = path.dirname(new URL(import.meta.url).pathname);
const config = JSON.parse(fs.readFileSync(path.join(workDir, 'config.json'), 'utf8'));
const cache = cacheDirFor(config.slug);
const machine = JSON.parse(fs.readFileSync(path.join(cache, 'stage.json'), 'utf8'));
const d = machine.display;
const osa = s => execFileSync('osascript', ['-e', s]).toString().trim();

if (!args.includes('--no-code')) {
  const dataDir = path.join(cache, 'vscode/data');
  fs.mkdirSync(path.join(dataDir, 'User/globalStorage'), { recursive: true });

  // Settings: no minimap, no activity bar, one tab, AI/welcome dialogs off, noisy folders hidden.
  const tpl = JSON.parse(fs.readFileSync(path.join(here, '../templates/vscode-settings.json'), 'utf8'));
  tpl['files.exclude'] = Object.fromEntries((config.vscode?.hide ?? []).map(k => [k, true]));
  Object.assign(tpl, config.vscode?.settings ?? {});
  fs.writeFileSync(path.join(dataDir, 'User/settings.json'), JSON.stringify(tpl, null, 2));

  // Window bounds must be pre-seeded: VS Code has no CLI flag for them.
  const sp = path.join(dataDir, 'User/globalStorage/storage.json');
  const storage = fs.existsSync(sp) ? JSON.parse(fs.readFileSync(sp, 'utf8')) : {};
  storage.windowsState = {
    lastActiveWindow: { folder: `file://${config.projectRoot}`, uiState: { mode: 1, x: d.x, y: d.y + 25, width: d.w, height: d.h - 25 } },
    openedWindows: [],
  };
  fs.writeFileSync(sp, JSON.stringify(storage, null, 2));

  try { execFileSync('pkill', ['-f', path.join(cache, 'vscode/data')]); await sleep(2500); } catch {}
  const first = config.vscode?.firstFile ?? 'README.md';
  execFileSync('bash', ['-c',
    `"${machine.codeBin}" --user-data-dir "${dataDir}" --extensions-dir "${path.join(cache, 'vscode/ext')}" ` +
    `--disable-workspace-trust "${config.projectRoot}" -g "${path.join(config.projectRoot, first)}:1" >/dev/null 2>&1 &`]);
  await sleep(7000);
  console.log('VS Code staged');
}

if (!args.includes('--no-term')) {
  const init = config.terminal?.init ?? `cd ${config.projectRoot} && clear`;
  const id = osa(`tell application "Terminal"
  set w to do script ${JSON.stringify(init)}
  delay 0.5
  set win to first window whose tabs contains w
  set font size of w to ${config.terminal?.fontSize ?? 14}
  set custom title of w to "demo-stage"
  return id of win
end tell`);
  // position+size, not `set bounds`: bounds alone lands short, Terminal snapping to whole rows.
  osa(`tell application "Terminal"
  set position of window id ${id} to {${d.x}, ${d.y + 25}}
  set size of window id ${id} to {${d.w}, ${d.h - 25}}
end tell`);
  machine.termWindowId = Number(id);
  fs.writeFileSync(path.join(cache, 'stage.json'), JSON.stringify(machine, null, 2));
  console.log('Terminal staged, window id', id);
}

console.log(execFileSync('swift', [path.join(here, 'wins.swift')], { encoding: 'utf8' })
  .split('\n').filter(l => /Code|Terminal|Chrome/.test(l)).join('\n'));
