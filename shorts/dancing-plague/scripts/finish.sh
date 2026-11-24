#!/bin/bash
# concat the parts in frame order, mux the mix (video stream 0, audio from mix.wav), QA
set -e
cd /home/user/remotion/out/dancing
for f in parts/[pq]*.mp4; do echo "$(basename $f .mp4 | cut -c2-) $f"; done | sort -n | awk '{print "file /home/user/remotion/out/dancing/"$2}' > concat.txt
ffmpeg -y -v error -f concat -safe 0 -i concat.txt -map 0:v:0 -c copy video_2k.mp4
ffmpeg -y -v error -i video_2k.mp4 -i /root/dancing-short/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart final.mp4
ffprobe -v error -count_frames -show_entries stream=codec_type,width,height,nb_read_frames:format=duration -of compact final.mp4
