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

// Returns { config, problems }. `problems` lists what is wrong; it is empty for a usable config.
export function readConfig(workDir) {
  const file = path.join(workDir, 'config.json');
  if (!fs.existsSync(file)) {
    return { config: null, problems: [`no config.json in ${workDir} — run the demo-setup skill, or copy templates/config.example.json`] };
  }
  let config;
  try { config = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { config: null, problems: [`config.json is not valid JSON: ${e.message}`] }; }

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

  return { config, problems };
}

// Throws a ConfigError naming every problem; returns the config with defaults filled in.
export function loadConfig(workDir) {
  const { config, problems } = readConfig(workDir);
  if (problems.length) {
    throw new ConfigError(`config.json in ${workDir}:\n  - ${problems.join('\n  - ')}`);
  }
  return withDefaults(config);
}

export function withDefaults(config) {
  return {
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
