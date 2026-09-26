// Loads and validates <workDir>/config.json. Every script goes through here, so a missing
// or mistyped key fails with one readable message instead of a TypeError three calls later.
//
// No third-party imports: doctor.mjs and preflight.mjs must run before Playwright exists.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const cacheDirFor = slug => path.join(os.homedir(), '.cache', 'demo-video', slug);

export const SURFACES = ['browser', 'editor', 'terminal'];
export const TTS_PROVIDERS = ['elevenlabs', 'say'];

export class ConfigError extends Error {}

// ---------- the personal file: one person's voice and machine, never committed ----------
//
// $XDG_CONFIG_HOME/screencast-demo-maker/config.json (default ~/.config/…), or the path in
// $SCREENCAST_DEMO_USER_CONFIG. It overrides the project's config.json for this person only:
//   { "tts": { "elevenlabs": { "voiceId": "…", "voiceName": "…" }, "say": { "voiceId": "Lesya" } },
//     "video": { "display": "2560x1440" }, "codeBin": "…" }
// A tts block applies only while its provider is the active one, so a personal ElevenLabs
// voice never reaches a project narrated with `say`.
const PERSONAL_TTS_KEYS = ['voiceId', 'voiceName', 'model', 'voiceSettings', 'keychainService', 'rate'];
const PERSONAL_VIDEO_KEYS = ['display'];

export function userConfigPath() {
  if (process.env.SCREENCAST_DEMO_USER_CONFIG) return process.env.SCREENCAST_DEMO_USER_CONFIG;
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'screencast-demo-maker', 'config.json');
}

// Returns { user, file, problems }. No file is fine: `user` is null and nothing is overridden.
export function readUserConfig() {
  const file = userConfigPath();
  if (!fs.existsSync(file)) return { user: null, file, problems: [] };
  let user;
  try { user = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { user: null, file, problems: [`${file} is not valid JSON: ${e.message}`] }; }

  const problems = [];
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const only = (obj, keys, where) => {
    for (const k of Object.keys(obj)) if (!keys.includes(k)) problems.push(`${file}: ${where}${k} is not a personal setting (allowed: ${keys.join(', ')})`);
  };
  if (!isObj(user)) return { user: null, file, problems: [`${file}: must be a JSON object`] };
  only(user, ['tts', 'video', 'codeBin'], '');
  if (user.tts !== undefined) {
    if (!isObj(user.tts)) problems.push(`${file}: tts must be an object keyed by provider (${TTS_PROVIDERS.join(', ')})`);
    else {
      only(user.tts, TTS_PROVIDERS, 'tts.');
      for (const p of TTS_PROVIDERS) {
        if (user.tts[p] === undefined) continue;
        if (!isObj(user.tts[p])) problems.push(`${file}: tts.${p} must be an object`);
        else only(user.tts[p], PERSONAL_TTS_KEYS, `tts.${p}.`);
      }
    }
  }
  if (user.video !== undefined) {
    if (!isObj(user.video)) problems.push(`${file}: video must be an object`);
    else only(user.video, PERSONAL_VIDEO_KEYS, 'video.');
  }
  if (user.codeBin !== undefined && typeof user.codeBin !== 'string') problems.push(`${file}: codeBin must be a path`);
  return { user: problems.length ? null : user, file, problems };
}

// Returns { config, user, problems }. `problems` lists what is wrong — in config.json or in
// the personal file — and is empty for a usable config. `user` is the personal file, if any.
export function readConfig(workDir) {
  const personal = readUserConfig();
  const file = path.join(workDir, 'config.json');
  if (!fs.existsSync(file)) {
    return { config: null, user: null, problems: [`no config.json in ${workDir} — run the demo-setup skill, or copy templates/config.example.json`, ...personal.problems] };
  }
  let config;
  try { config = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { config: null, user: null, problems: [`config.json is not valid JSON: ${e.message}`, ...personal.problems] }; }

  // A relative projectRoot is read from the folder holding config.json, so a demo folder
  // committed to a repo ("projectRoot": "../..") works on every clone.
  if (typeof config.projectRoot === 'string' && config.projectRoot && !path.isAbsolute(config.projectRoot)) {
    config.projectRoot = path.resolve(workDir, config.projectRoot);
  }

  const problems = [];
  const need = (ok, msg) => { if (!ok) problems.push(msg); };

  need(typeof config.slug === 'string' && /^[\w.-]{1,40}$/.test(config.slug),
    'slug: required, letters/digits/-/_ only, ≤ 40 chars (it names ~/.cache/demo-video/<slug>)');
  need(typeof config.projectRoot === 'string' && config.projectRoot !== '',
    'projectRoot: required, the project being filmed — absolute, or relative to the folder holding config.json');
  if (typeof config.projectRoot === 'string' && config.projectRoot) {
    need(fs.existsSync(config.projectRoot), `projectRoot: ${config.projectRoot} does not exist`);
  }
  need(Array.isArray(config.order) && config.order.length > 0 && config.order.every(s => typeof s === 'string'),
    'order: required, the playback order of scene ids, e.g. ["s1","s2"]');
  need(typeof config.output === 'string' && config.output.endsWith('.mp4'),
    'output: required, where the finished .mp4 goes, relative to projectRoot');

  const surfaces = config.surfaces ?? SURFACES;
  need(Array.isArray(surfaces) && surfaces.length > 0 && surfaces.every(s => SURFACES.includes(s)),
    `surfaces: a non-empty list drawn from ${SURFACES.join(', ')}`);

  const provider = config.tts?.provider ?? 'elevenlabs';
  need(TTS_PROVIDERS.includes(provider), `tts.provider: one of ${TTS_PROVIDERS.join(', ')}`);
  const cps = config.tts?.charsPerSecond;
  need(cps === undefined || (typeof cps === 'number' && cps > 5 && cps < 30), 'tts.charsPerSecond: a number between 5 and 30');

  problems.push(...personal.problems);
  return { config, user: personal.user, problems };
}

// Throws a ConfigError naming every problem; returns the config with defaults filled in.
export function loadConfig(workDir) {
  const { config, user, problems } = readConfig(workDir);
  if (problems.length) {
    throw new ConfigError(`config for ${workDir}:\n  - ${problems.join('\n  - ')}`);
  }
  return withDefaults(config, user);
}

// Fills in defaults, then lays the personal file (`user`, from readConfig) over the result.
// When it changed anything, `config.personal` = { file, applied: ['tts.voiceId', …] }.
export function withDefaults(config, user = null) {
  const c = {
    ...config,
    surfaces: config.surfaces ?? SURFACES,
    healthUrls: config.healthUrls ?? [],
    video: { fps: 30, zoom: 1.25, ...config.video },
    tts: {
      provider: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      keychainService: 'elevenlabs-api',
      charsPerSecond: 14,
      ...config.tts,
    },
    neverClick: config.neverClick ?? [],
  };
  if (!user) return c;

  const applied = [];
  const mine = user.tts?.[c.tts.provider] ?? {};
  for (const k of PERSONAL_TTS_KEYS) if (mine[k] !== undefined) { c.tts[k] = mine[k]; applied.push(`tts.${k}`); }
  for (const k of PERSONAL_VIDEO_KEYS) if (user.video?.[k] !== undefined) { c.video[k] = user.video[k]; applied.push(`video.${k}`); }
  if (user.codeBin !== undefined) { c.codeBin = user.codeBin; applied.push('codeBin'); }
  if (applied.length) c.personal = { file: userConfigPath(), applied };
  return c;
}

export const uses = (config, surface) => (config.surfaces ?? SURFACES).includes(surface);

// Scripts call this as their entry point so a bad config prints cleanly and exits 2.
export function loadOrExit(workDir) {
  try { return loadConfig(workDir); }
  catch (e) {
    if (e instanceof ConfigError) { console.error(e.message); process.exit(2); }
    throw e;
  }
}
