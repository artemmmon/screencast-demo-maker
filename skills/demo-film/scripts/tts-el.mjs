// ElevenLabs narration.
//
//   node tts-el.mjs <workDir> voices
//   node tts-el.mjs <workDir> audition <cueId> <voiceId:label> [...]
//   node tts-el.mjs <workDir> all [cueId ...]        # voice/model from config.json
//
// The API key comes from the macOS Keychain and is never printed or written to disk:
//   security add-generic-password -s elevenlabs-api -a "$USER" -w     (run once, hidden input)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { cacheDirFor } from './stage.mjs';

const [workDirArg, cmd, ...a] = process.argv.slice(2);
const workDir = path.resolve(workDirArg ?? '.');
const config = JSON.parse(fs.readFileSync(path.join(workDir, 'config.json'), 'utf8'));
const cache = cacheDirFor(config.slug);
const cues = JSON.parse(fs.readFileSync(path.join(workDir, 'cues.json'), 'utf8'));

const KEY = execFileSync('security', ['find-generic-password', '-s', config.tts?.keychainService ?? 'elevenlabs-api', '-w'],
  { encoding: 'utf8' }).trim();
const API = 'https://api.elevenlabs.io/v1';
const H = { 'xi-api-key': KEY, 'content-type': 'application/json' };
const MODEL = config.tts?.model ?? 'eleven_multilingual_v2';
const text = c => c.text ?? c.el ?? c.tts;

// Free tier serves mp3 only; we convert to wav ourselves.
async function speak(voice, c, out, ctx = {}) {
  const r = await fetch(`${API}/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      text: text(c), model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
      ...ctx,
    }),
  });
  if (!r.ok) throw new Error(`${c.id}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
}

const dur = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

if (cmd === 'voices') {
  const sub = await (await fetch(`${API}/user/subscription`, { headers: H })).json();
  if (sub.character_limit) console.log(`tier ${sub.tier}: ${sub.character_count}/${sub.character_limit} chars used`);
  const v = await (await fetch(`${API}/voices`, { headers: H })).json();
  for (const x of v.voices ?? []) console.log(x.voice_id, '|', x.name, '|', x.labels?.gender, x.labels?.age, '|', x.labels?.use_case ?? '');
  console.log(`\nscript: ${cues.length} cues, ${cues.reduce((n, c) => n + text(c).length, 0)} chars`);

} else if (cmd === 'audition') {
  const dir = path.join(cache, 'audition');
  fs.mkdirSync(dir, { recursive: true });
  const c = cues.find(x => x.id === a[0]) ?? cues[0];
  for (const s of a.slice(1)) {
    const [id, label] = s.split(':');
    await speak(id, c, path.join(dir, `${label}-${c.id}.mp3`));
    console.log('ok', label);
  }
  console.log(`\nopen ${dir}`);

} else if (cmd === 'all') {
  const voice = config.tts?.voiceId;
  if (!voice) throw new Error('config.json has no tts.voiceId — audition first');
  const out = path.join(cache, 'audio');
  fs.mkdirSync(path.join(out, 'raw'), { recursive: true });
  const want = a;
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    if (want.length && !want.includes(c.id)) continue;
    // Neighbouring text within the same scene steers intonation across a cue boundary.
    const sameScene = j => cues[j] && (cues[j].scene ?? cues[j].id.split('-')[0]) === (c.scene ?? c.id.split('-')[0]);
    await speak(voice, c, path.join(out, `raw/${c.id}.mp3`), {
      previous_text: sameScene(i - 1) ? text(cues[i - 1]) : undefined,
      next_text: sameScene(i + 1) ? text(cues[i + 1]) : undefined,
    });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(out, `raw/${c.id}.mp3`), '-af',
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,' +
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse',
      '-ar', '48000', '-ac', '1', path.join(out, `${c.id}.wav`)]);
    const d = dur(path.join(out, `${c.id}.wav`));
    // A clip far from ~14 chars/second is usually a truncated or failed generation.
    const expect = text(c).length / 14;
    const flag = d < 1.2 || d < expect * 0.45 || d > expect * 2.2 ? '  <-- CHECK' : '';
    console.log(c.id, d.toFixed(1) + 's', flag);
  }
  console.log(`\nwavs in ${out}`);

} else {
  console.log('usage: node tts-el.mjs <workDir> voices|audition|all');
}
