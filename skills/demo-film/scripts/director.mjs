// Generic runner. Loads <workDir>/scenes.mjs and films the scenes it declares.
//
//   node director.mjs <workDir> [--dry] [--scenes=s4,s5]
//
// scenes.mjs exports:
//   export const order   = ['s2','s3',...]          // filming order (file scenes first is usually calmest)
//   export const browser = ['s1','s6',...]          // scenes that need Chrome
//   export default stage => ({ s2: async () => {...}, ... })
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStage } from './stage.mjs';

const args = process.argv.slice(2);
const workDir = path.resolve(args.find(a => !a.startsWith('--')) ?? '.');
const dry = args.includes('--dry');
const only = (args.find(a => a.startsWith('--scenes=')) ?? '').replace('--scenes=', '').split(',').filter(Boolean);

const stage = await createStage({ workDir, dry });
const mod = await import(pathToFileURL(path.join(workDir, 'scenes.mjs')).href);
const scenes = mod.default(stage);
const browserScenes = new Set(mod.browser ?? []);

const order = (mod.order ?? Object.keys(scenes)).filter(s => !only.length || only.includes(s));
const firstBrowser = order.find(s => browserScenes.has(s));

for (const s of order) {
  if (!scenes[s]) throw new Error(`scenes.mjs has no scene "${s}"`);
  // Chrome comes up once, right before the first browser scene; the Terminal window steps aside.
  if (s === firstBrowser) { try { stage.term.hide(); } catch {} await stage.web.up(); }
  console.log('>>>', s);
  await scenes[s]();
}
await stage.web.close();
