#!/bin/bash
# renders the 2K final in 4 chunks (resumable: skips finished chunks), then concatenates
cd "$(dirname "$0")/.."
mkdir -p out/final
for r in $(seq 0 210 1890 | awk '{print $1"-"$1+209}'); do
  f=out/final/part_${r}.mp4
  [ -s "$f" ] && continue
  npx remotion render src/index.ts PelikulaShort "$f.tmp.mp4" --frames=$r --scale 1.3333333333333333 --concurrency 2 \
    --codec h264 --crf 16 --props '{"noAudio":true}' --log=error > out/final/log_$r.txt 2>&1 && mv "$f.tmp.mp4" "$f"
  echo "chunk $r done $(date +%T)" >> out/final/progress.txt
done
ls out/final/part_*.mp4 | sort -t_ -k2 -n | sed 's/^out\/final\//file /' > out/final/list.txt
ffmpeg -y -v error -f concat -safe 0 -i out/final/list.txt -c copy out/final/video.mp4 && echo ALLDONE >> out/final/progress.txt
