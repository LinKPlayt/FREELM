#!/bin/bash
# Cuts the reel clips the edit uses into 30 fps JPEG sequences (frames/<name>/0001.jpg ...).
set -e
ex() { mkdir -p frames/$1; ffmpeg -v error -y -ss $3 -t $4 -i reels/$2.mov -vf "fps=30,scale=$5:flags=lanczos" -q:v $6 frames/$1/%04d.jpg; echo "$1: $(ls frames/$1 | wc -l) frames"; }
ex quiz_full quiz 0 3.85 1080:1920 2      # the full-screen moment (with its narration)
ex quiz_tiny quiz 0 3.85 72:128 4         # the same, tiny: upscaled, it's the blurred backdrop in 16:9
ex quiz_tile quiz 3.75 4.3 540:960 3      # the quiz carries on in the wall
ex market market 2.5 4.3 540:960 3        # live S&P 500 chart
ex explainer explainer 11.0 4.3 540:960 3 # "doubles every 7 years"
ex topic topic 20.0 4.3 540:960 3         # the $1,000 counter
ffmpeg -v error -y -ss 0 -t 3.75 -i reels/quiz.mov -vn -ac 2 -ar 48000 -c:a pcm_s16le assets/narr_quiz.wav
