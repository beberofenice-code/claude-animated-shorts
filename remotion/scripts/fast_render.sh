#!/bin/bash
# Fast resumable CPU render of PisaShort: 90-frame chunks at half scale, then concat + Lanczos upscale to 1080x1920,
# mux the finished voice + sound mix, commit and push out/final-short.mp4. Rerun at any time: finished chunks are skipped.
set -u
cd "$(dirname "$0")/.."
CH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
MIX=../projects/pisa/audio/mix.wav
LOG=chunks/render.log
BRANCH=ccr-a531b0d5-peo0lr
TOTAL=2130; STEP=90
for ((a=0; a<TOTAL; a+=STEP)); do
  b=$((a+STEP-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  out=chunks/chunk_$(printf %04d $a).mp4
  [ -s "$out" ] && continue
  s=$(date +%s)
  # post.dpr 0.5: R3F clamps the WebGL buffer to dpr >= 1, so --scale=0.5 alone would still render 1080x1920 internally
  if npx remotion render src/index.ts PisaShort "chunks/tmp_$a.mp4" --frames=$a-$b --scale=0.5 --gl=swangle \
      --image-format=jpeg --jpeg-quality=85 --concurrency=1 --crf=23 --codec=h264 --timeout=900000 \
      --browser-executable=$CH --props='{"post":{"dpr":0.5}}' --log=error >> $LOG 2>&1; then
    mv "chunks/tmp_$a.mp4" "$out"
    echo "chunk $a-$b $(( $(date +%s)-s ))s $(date +%H:%M)" >> $LOG
  else
    echo "chunk $a-$b FAILED $(date +%H:%M)" >> $LOG; exit 1
  fi
done
ls chunks/chunk_*.mp4 | sort | sed "s|^chunks/|file '|; s|$|'|" > chunks/list.txt
mkdir -p out
ffmpeg -y -loglevel error -f concat -safe 0 -i chunks/list.txt -i "$MIX" -map 0:v:0 -map 1:a:0 \
  -vf "scale=1080:1920:flags=lanczos,fps=30" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 256k -shortest -movflags +faststart out/final-short.mp4 >> $LOG 2>&1 || { echo "FFMPEG FAILED" >> $LOG; exit 1; }
echo "ALLDONE $(date +%H:%M) $(ffprobe -v error -show_entries format=duration -of csv=p=0 out/final-short.mp4)s" >> $LOG
cd .. && git add -f remotion/out/final-short.mp4 remotion/scripts/fast_render.sh && \
  git commit -qm "Pisa short: final video (fast chunked render, upscaled to 1080x1920, voice + sound mix)" && \
  for i in 1 2 3 4; do git push -q -u origin $BRANCH && break; sleep $((2**i)); done && echo "PUSHED $(date +%H:%M)" >> remotion/$LOG
