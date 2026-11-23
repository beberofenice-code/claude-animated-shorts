#!/bin/bash
# final 2K render in 4 independent processes (each Chrome has its own software-GL process), then concat
cd /home/user/remotion
export TMPDIR=/home/user/rtmp TEMP=/home/user/rtmp
mkdir -p out/dancing/chunks
R=( "0-518" "519-1037" "1038-1556" "1557-2074" )
for i in 0 1 2 3; do
  npx remotion render src/index.ts DancingShort2K out/dancing/chunks/c$i.mp4 --frames=${R[$i]} --codec h264 --crf 16 \
    --browser-executable /opt/pw-browsers/chromium-1243/chrome-linux64/chrome --gl swangle --concurrency 1 --timeout 400000 \
    > out/dancing/chunks/log$i.txt 2>&1 &
  sleep 20
done
wait
echo ALLDONE
