#!/bin/bash
# encode.sh <dir> <fps> <out.mp4> [audio.wav] : H.264 High, CRF 16, BT.709, AAC 320k, faststart.
dir=$1; fps=$2; out=$3; audio=${4:-soundtrack.wav}
ffmpeg -v error -y -framerate $fps -i "$dir/%06d.jpg" -i "$audio" -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 17 -x264-params aq-mode=3:aq-strength=0.9 -pix_fmt yuv420p -profile:v high -level 4.2 -g $((fps*2)) -bf 2 \
  -vf "scale=out_color_matrix=bt709:out_range=tv" -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart "$out"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,bit_rate -show_entries format=duration,size -of compact=p=0 "$out"
