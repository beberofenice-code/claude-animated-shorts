#!/bin/bash
# Final 2K render of DreamShort in resumable chunks (each part is skipped if it already exists), then concat.
cd "$(dirname "$0")/.."
export TEMP=/tmp/rtmp TMP=/tmp/rtmp
mkdir -p out/dream/final2
TOTAL=2199; STEP=250
for ((a=0; a<TOTAL; a+=STEP)); do
  b=$((a+STEP-1)); ((b>=TOTAL)) && b=$((TOTAL-1))
  part=$(printf "out/dream/final2/part_%04d.mp4" $a)
  [ -f "$part" ] && continue
  npx remotion render src/index.ts DreamShort "$part.tmp.mp4" --frames=$a-$b --concurrency=1 --gl=swangle \
    --browser-executable=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome --scale=1.3333333333333333 \
    --codec=h264 --crf=16 --timeout=300000 > "out/dream/final2/log_$a.txt" 2>&1 && mv "$part.tmp.mp4" "$part"
  echo "$(date +%T) part $a-$b done" >> out/dream/final2/progress.txt
done
echo ALLDONE >> out/dream/final2/progress.txt
