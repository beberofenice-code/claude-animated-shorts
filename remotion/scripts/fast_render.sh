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
# bundle once (the code is locked); every part reuses it
[ -f chunks/bundle/index.html ] || npx remotion bundle src/index.ts --out-dir chunks/bundle --log=error >> $LOG 2>&1 || { echo "BUNDLE FAILED" >> $LOG; exit 1; }
for ((a=0; a<TOTAL; a+=STEP)); do
  b=$((a+STEP-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  out=chunks/chunk_$(printf %04d $a).mp4
  [ -s "$out" ] && continue
  # each 90-frame chunk is built from 15-frame parts (saved as they finish), so a restart loses at most one part
  mkdir -p chunks/parts
  for ((p=a; p<=b; p+=15)); do
    q=$((p+14)); [ $q -gt $b ] && q=$b
    part=chunks/parts/part_$(printf %04d $p).mp4
    [ -s "$part" ] && continue
    s=$(date +%s)
    # post.dpr 0.5: R3F clamps the WebGL buffer to dpr >= 1, so --scale=0.5 alone would still render 1080x1920 internally
    if npx remotion render chunks/bundle PisaShort "chunks/tmp_$p.mp4" --frames=$p-$q --scale=0.5 --gl=swangle \
        --image-format=jpeg --jpeg-quality=85 --concurrency=1 --crf=23 --codec=h264 --timeout=900000 \
        --browser-executable=$CH --props='{"post":{"dpr":0.5}}' --log=error >> $LOG 2>&1; then
      mv "chunks/tmp_$p.mp4" "$part"
      echo "part $p-$q $(( $(date +%s)-s ))s $(date +%H:%M)" >> $LOG
    else
      echo "part $p-$q FAILED $(date +%H:%M)" >> $LOG; exit 1
    fi
  done
  ls chunks/parts/part_*.mp4 | sort | awk -v a=$a -v b=$b -v d="$PWD" -F_ '{n=$NF+0} n>=a && n<=b {print "file \x27" d "/" $0 "\x27"}' > chunks/parts/list_$a.txt
  ffmpeg -y -loglevel error -f concat -safe 0 -i chunks/parts/list_$a.txt -c copy "chunks/tmp_c$a.mp4" >> $LOG 2>&1 && mv "chunks/tmp_c$a.mp4" "$out"
  echo "chunk $a-$b done $(date +%H:%M)" >> $LOG
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
