#!/bin/bash
# Final 2K render in 250-frame chunks (resumable), then lossless concat into out/baychimo/video.mp4
cd "$(dirname "$0")/.."
export TMPDIR=$PWD/remotion-tmp
mkdir -p out/baychimo/chunks
B=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
for a in $(seq 0 250 1981); do
  b=$((a + 249)); [ $b -gt 1981 ] && b=1981
  f=out/baychimo/chunks/c_$(printf %04d $a).mp4
  [ -s "$f" ] && continue
  for try in 1 2 3; do
    npx remotion render src/index.ts BaychimoShort "$f" --codec h264 --crf 16 --scale 1.3333333333333333 --frames=$a-$b \
      --browser-executable $B --gl swangle --concurrency 2 --timeout 600000 --log error >> out/baychimo/render.log 2>&1 && break
    rm -f "$f"
  done
  [ -s "$f" ] || { echo "FAILED chunk $a"; exit 1; }
  echo "chunk $a done"
done
ls out/baychimo/chunks/c_*.mp4 | sed "s#^#file '$PWD/#; s#\$#'#" > out/baychimo/chunks/list.txt
ffmpeg -v error -y -f concat -safe 0 -i out/baychimo/chunks/list.txt -c copy out/baychimo/video.mp4 && echo "ALL DONE"
