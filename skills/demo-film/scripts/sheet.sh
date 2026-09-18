#!/bin/zsh
# Contact sheet for one scene: a labelled frame late in each cue, plus the last frame.
#
#   ./sheet.sh <workDir> <scene>   ->  <cache>/frames/sheet-<scene>.png
#
# Sampling at 85% of a cue means the on-screen action for that line has landed.
set -e
work=${1:A}; s=$2
slug=$(python3 -c "import json,sys;print(json.load(open('$work/config.json'))['slug'])")
cache=~/.cache/demo-video/$slug
rm -f $cache/frames/$s-[0-9]*.png(N)   # (N) so an empty match is not an error
ts=$cache/frames/.ts-$s
python3 -c "
import json
m = json.load(open('$cache/scenes/$s.json'))
for c in (m['cues'] if isinstance(m, dict) else m): print(c['id'], round(c['at']+c['dur']*0.85, 2))
" > $ts
i=0
while read id t; do
  i=$((i+1))
  ffmpeg -y -loglevel error -ss $t -i $cache/scenes/$s.mp4 -frames:v 1 \
    -vf "scale=960:-1,drawtext=text='$id @$t':fontcolor=yellow:fontsize=26:x=20:y=h-40:box=1:boxcolor=black" \
    $cache/frames/$s-$(printf %02d $i).png
done < $ts
ffmpeg -y -loglevel error -sseof -0.3 -i $cache/scenes/$s.mp4 -frames:v 1 -vf "scale=960:-1" $cache/frames/$s-99.png
ffmpeg -y -loglevel error -pattern_type glob -i "$cache/frames/$s-[0-9]*.png" \
  -vf "tile=2x$(( (i+2)/2 ))" $cache/frames/sheet-$s.png
rm -f $ts
echo "$cache/frames/sheet-$s.png  ($(ffprobe -v error -show_entries format=duration -of csv=p=0 $cache/scenes/$s.mp4)s)"
