#!/usr/bin/env python3
"""Mix narration into each scene at its logged cue offsets, then concat.

    python3 assemble.py <workDir> [scene ...]

Reads <cache>/scenes/<id>.{mp4,json} + <cache>/audio/<cue>.wav,
writes <cache>/out/<id>.mp4 and <cache>/out/<slug>.mp4.
"""
import json, os, subprocess, sys

work = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
config = json.load(open(os.path.join(work, 'config.json')))
cache = os.path.expanduser(f"~/.cache/demo-video/{config['slug']}")
audio = os.path.join(cache, os.environ.get('AUDIO_DIR', 'audio'))
out = os.path.join(cache, 'out')
os.makedirs(out, exist_ok=True)

order = [s for s in config['order'] if len(sys.argv) <= 2 or s in sys.argv[2:]]
fps = str(config.get('video', {}).get('fps', 30))

for s in order:
    meta = json.load(open(os.path.join(cache, 'scenes', f'{s}.json')))
    # Older clips stored a bare cue list; newer ones add the intended end of the scene.
    cues = meta['cues'] if isinstance(meta, dict) else meta
    end = meta.get('end') if isinstance(meta, dict) else None
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(cache, 'scenes', f'{s}.mp4')]
    for c in cues:
        cmd += ['-i', os.path.join(audio, f"{c['id']}.wav")]
    # Each clip is delayed to its own offset, then all are mixed onto one track.
    f = ''.join(f"[{i+1}:a]aresample=48000,adelay={int(c['at']*1000)}:all=1[a{i}];"
                for i, c in enumerate(cues))
    f += ''.join(f'[a{i}]' for i in range(len(cues)))
    f += (f"amix=inputs={len(cues)}:normalize=0:dropout_transition=0,"
          "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,apad[a]")
    if end:
        cmd += ['-t', f'{end:.3f}']
    cmd += ['-filter_complex', f, '-map', '0:v', '-map', '[a]', '-shortest', '-r', fps,
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '160k', '-ac', '2', os.path.join(out, f'{s}.mp4')]
    subprocess.run(cmd, check=True)
    print('mixed', s)

# Concat every scene in config order (not just the ones re-mixed now).
missing = [s for s in config['order'] if not os.path.exists(os.path.join(out, f'{s}.mp4'))]
if missing:
    print('\nnot concatenating — never mixed: ' + ' '.join(missing))
    print('run without scene arguments to mix them all')
    sys.exit(0)

lst = os.path.join(out, 'list.txt')
with open(lst, 'w') as fh:
    fh.write('\n'.join(f"file '{s}.mp4'" for s in config['order']))
final = os.path.join(out, f"{config['slug']}.mp4")
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
                '-c', 'copy', '-movflags', '+faststart', final], check=True)
print('\n->', final)
print(subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                      'format=duration:stream=codec_name,width,height', '-of', 'default=nw=1', final],
                     capture_output=True, text=True).stdout)
