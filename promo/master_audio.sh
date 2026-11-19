#!/bin/bash
# soundtrack_raw.wav -> soundtrack.wav : limit peaks, then a two-pass linear loudness normalisation (-14 LUFS, -1 dBTP).
set -e
ffmpeg -v error -y -i soundtrack_raw.wav -af "alimiter=limit=0.8:attack=1:release=40:level=false" -ar 48000 -c:a pcm_f32le lim.wav
J=$(ffmpeg -hide_banner -nostats -i lim.wav -af loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
g() { echo "$J" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i lim.wav -af "loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" -ar 48000 -c:a pcm_s24le soundtrack.wav
rm -f lim.wav
ffmpeg -hide_banner -nostats -i soundtrack.wav -af "ebur128=peak=true" -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):" | tail -3
