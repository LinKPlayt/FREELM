#!/bin/bash
# verify.sh <video.mp4> <tag> : streams, duration, loudness, and a contact sheet of key moments.
f=$1; tag=$2
ffprobe -v error -show_entries stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,sample_rate,channels,bit_rate -show_entries format=duration,size -of compact=p=0 "$f"
ffmpeg -hide_banner -nostats -i "$f" -vn -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tail -2
d=$(mktemp -d); i=1
for t in 0.5 2.6 6.5 8.6 11.6 15.2 19.7 22.6 25.8 30.6 33.1 35.1 37.1 39.1 41.2 42.8 44.7 49.0; do
  ffmpeg -v error -y -ss $t -i "$f" -frames:v 1 -q:v 3 "$d/$(printf %04d $i).jpg"; i=$((i+1)); done
if [ "$tag" = wide ]; then ffmpeg -v error -y -i "$d/%04d.jpg" -vf "scale=480:270,tile=6x3:padding=4" -frames:v 1 stills/final_$tag.jpg
else ffmpeg -v error -y -i "$d/%04d.jpg" -vf "scale=216:384,tile=9x2:padding=4" -frames:v 1 stills/final_$tag.jpg; fi
rm -rf "$d"; echo "sheet: stills/final_$tag.jpg"
