#!/bin/bash
# Render PisaShort in chunks (CPU WebGL), skipping chunks already done. Log: out/pisa/final/render.log
cd "$(dirname "$0")/.."
CH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
TOTAL=2130; STEP=90
for ((a=0; a<TOTAL; a+=STEP)); do
  b=$((a+STEP-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  out=out/pisa/final/chunk_$(printf %04d $a).mp4
  [ -f "$out" ] && continue
  s=$(date +%s)
  npx remotion render src/index.ts PisaShort "$out.tmp.mp4" --frames=$a-$b --gl=swangle --browser-executable=$CH \
    --concurrency=4 --timeout=900000 --codec h264 --crf 14 --log=error >> out/pisa/final/render.log 2>&1 && mv "$out.tmp.mp4" "$out"
  echo "chunk $a-$b $(( $(date +%s)-s ))s $(date +%H:%M)" >> out/pisa/final/render.log
done
echo ALLDONE >> out/pisa/final/render.log
