// Narration: one trimmed 48 kHz wav per cue, from ElevenLabs or the free macOS `say`.
//
//   node tts.mjs <workDir> voices
//   node tts.mjs <workDir> audition <cueId> <voice:label> [...]
//   node tts.mjs <workDir> all [cueId ...]        # voice/model from config.json + the personal file
//
// config.tts.provider picks the engine:
//   "elevenlabs" (default) — voice is an ElevenLabs voice id. The API key comes from the
//                 macOS Keychain and is never printed or written to disk:
//                 security add-generic-password -s elevenlabs-api -a "$USER" -w   (hidden input)
//   "say"        — voice is a macOS voice name ("Samantha", "Lesya"). No key, no quota,
//                 noticeably more robotic; good for drafts and for trying the plugin out.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { cacheDirFor, loadOrExit, userConfigPath } from './config.mjs';

const [workDirArg, cmd, ...a] = process.argv.slice(2);
const workDir = path.resolve(workDirArg ?? '.');
const config = loadOrExit(workDir);
const cache = cacheDirFor(config.slug);
const cuesFile = path.join(workDir, 'cues.json');
if (!fs.existsSync(cuesFile)) { console.error(`no ${cuesFile} — write it with the demo-scenario skill`); process.exit(2); }
const cues = JSON.parse(fs.readFileSync(cuesFile, 'utf8'));
const { provider, charsPerSecond } = config.tts;
const text = c => c.text ?? c.el ?? c.tts;   // el/tts: cue fields from before 1.0, still read

// ---------- providers: each writes one raw audio file for one cue ----------
const providers = {
  elevenlabs() {
    const KEY = execFileSync('security', ['find-generic-password', '-s', config.tts.keychainService, '-w'],
      { encoding: 'utf8' }).trim();
    const API = 'https://api.elevenlabs.io/v1';
    const H = { 'xi-api-key': KEY, 'content-type': 'application/json' };
    return {
      ext: 'mp3',
      // Free tier serves mp3 only; we convert to wav ourselves.
      async speak(voice, c, out, ctx = {}) {
        const r = await fetch(`${API}/text-to-speech/${voice}?output_format=mp3_44100_128`, {
          method: 'POST', headers: H,
          body: JSON.stringify({
            text: text(c), model_id: config.tts.model,
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, ...config.tts.voiceSettings },
            ...ctx,
          }),
        });
        if (!r.ok) throw new Error(`${c.id}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
        fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
      },
      async voices() {
        const sub = await (await fetch(`${API}/user/subscription`, { headers: H })).json();
        if (sub.character_limit) console.log(`tier ${sub.tier}: ${sub.character_count}/${sub.character_limit} chars used`);
        const v = await (await fetch(`${API}/voices`, { headers: H })).json();
        for (const x of v.voices ?? []) console.log(x.voice_id, '|', x.name, '|', x.labels?.gender, x.labels?.age, '|', x.labels?.use_case ?? '');
      },
    };
  },
  say() {
    return {
      ext: 'aiff',
      // previous/next text is an ElevenLabs feature; `say` reads each cue on its own.
      async speak(voice, c, out) {
        const args = ['-v', voice, '-o', out];
        if (config.tts.rate) args.push('-r', String(config.tts.rate));
        execFileSync('say', [...args, text(c)]);
      },
      async voices() {
        const lang = (config.tts.language ?? '').replace('-', '_');
        const all = execFileSync('say', ['-v', '?'], { encoding: 'utf8' }).split('\n').filter(Boolean);
        for (const l of all.filter(l => !lang || l.includes(lang))) console.log(l);
        if (lang) console.log(`\n(filtered by tts.language=${config.tts.language}; ${all.length} voices in total)`);
        console.log('More voices: System Settings → Accessibility → Spoken Content → System voice → Manage Voices');
      },
    };
  },
}[provider]();

const dur = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

if (cmd === 'voices') {
  await providers.voices();
  console.log(`\nprovider ${provider} · script: ${cues.length} cues, ${cues.reduce((n, c) => n + text(c).length, 0)} chars`);

} else if (cmd === 'audition') {
  const dir = path.join(cache, 'audition');
  fs.mkdirSync(dir, { recursive: true });
  const c = cues.find(x => x.id === a[0]) ?? cues[0];
  for (const s of a.slice(1)) {
    const i = s.lastIndexOf(':');
    const [id, label] = i > 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, s];
    await providers.speak(id, c, path.join(dir, `${label}-${c.id}.${providers.ext}`));
    console.log('ok', label);
  }
  console.log(`\nopen ${dir}`);

} else if (cmd === 'all') {
  const voice = config.tts.voiceId;
  if (!voice) { console.error(`no tts.voiceId in config.json or in ${userConfigPath()} — audition voices and let the user pick first`); process.exit(2); }
  const out = path.join(cache, process.env.AUDIO_DIR || 'audio');
  fs.mkdirSync(path.join(out, 'raw'), { recursive: true });
  const want = a;
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    if (want.length && !want.includes(c.id)) continue;
    // Neighbouring text within the same scene steers intonation across a cue boundary.
    const sameScene = j => cues[j] && (cues[j].scene ?? cues[j].id.split('-')[0]) === (c.scene ?? c.id.split('-')[0]);
    const raw = path.join(out, `raw/${c.id}.${providers.ext}`);
    await providers.speak(voice, c, raw, {
      previous_text: sameScene(i - 1) ? text(cues[i - 1]) : undefined,
      next_text: sameScene(i + 1) ? text(cues[i + 1]) : undefined,
    });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af',
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,' +
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse',
      '-ar', '48000', '-ac', '1', path.join(out, `${c.id}.wav`)]);
    const d = dur(path.join(out, `${c.id}.wav`));
    // A clip far from the expected speaking rate is usually a truncated or failed generation.
    const expect = text(c).length / charsPerSecond;
    const flag = d < 1.2 || d < expect * 0.45 || d > expect * 2.2 ? '  <-- CHECK' : '';
    console.log(c.id, d.toFixed(1) + 's', flag);
  }
  console.log(`\nwavs in ${out}`);

} else {
  console.log('usage: node tts.mjs <workDir> voices|audition|all');
}
