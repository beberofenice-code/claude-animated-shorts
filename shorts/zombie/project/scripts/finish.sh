#!/bin/bash
set -e
cd ~/zombie-short/out/final
printf "file 'part_0.mp4'\nfile 'part_517.mp4'\nfile 'part_1034.mp4'\nfile 'part_1551.mp4'\n" > list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i list.txt -c copy video_1080.mp4
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 video_1080.mp4
ffmpeg -y -loglevel error -i video_1080.mp4 -i ../../audio/out/mix.wav -map 0:v:0 -map 1:a:0 \
  -vf "scale=1440:2560:flags=lanczos" -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 256k -shortest -movflags +faststart zombie_final_2k.mp4
ls -la zombie_final_2k.mp4
