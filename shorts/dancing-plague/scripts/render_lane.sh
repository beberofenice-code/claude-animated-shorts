#!/bin/bash
# sequential short parts (65 frames) for the ranges lost to crashes; skips finished parts
cd /home/user/remotion
export TMPDIR=/home/user/rtmp TEMP=/home/user/rtmp
mkdir -p out/dancing/parts
for r in "$@"; do
  A=${r%-*}; B=${r#*-}
  for a in $(seq $A 65 $B); do
    b=$((a+64)); [ $b -gt $B ] && b=$B
    f=out/dancing/parts/q$(printf %04d $a).mp4
    [ -s "$f" ] && continue
    for try in 1 2; do
      npx remotion render src/index.ts DancingShort2K "$f" --frames=$a-$b --codec h264 --crf 16 \
        --browser-executable /opt/pw-browsers/chromium-1243/chrome-linux64/chrome --gl swangle --concurrency 1 --timeout 400000 \
        > out/dancing/parts/qlog$(printf %04d $a).txt 2>&1 && break
    done
  done
done
echo LANEDONE
