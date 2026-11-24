#!/bin/bash
# remaining frames 519-2074 in ~130-frame parts, 3 at a time (a crash only costs one part); skips parts already done
cd /home/user/remotion
export TMPDIR=/home/user/rtmp TEMP=/home/user/rtmp
mkdir -p out/dancing/parts
part() {
  a=$1; b=$2; f=out/dancing/parts/p$(printf %04d $a).mp4
  [ -s "$f" ] && return
  npx remotion render src/index.ts DancingShort2K "$f" --frames=$a-$b --codec h264 --crf 16 \
    --browser-executable /opt/pw-browsers/chromium-1243/chrome-linux64/chrome --gl swangle --concurrency 1 --timeout 400000 \
    > out/dancing/parts/log$(printf %04d $a).txt 2>&1
}
export -f part
for a in $(seq 519 130 2074); do b=$((a+129)); [ $b -gt 2074 ] && b=2074; echo "$a $b"; done | xargs -P3 -n2 bash -c 'part "$0" "$1"'
echo PARTSDONE
