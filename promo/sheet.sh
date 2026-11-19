#!/bin/bash
# sheet.sh <prefix> <cols> <tile WxH> <out> t1 t2 ...  -> contact sheet of stills/<prefix>_<t>.jpg
prefix=$1; cols=$2; size=$3; out=$4; shift 4
d=$(mktemp -d); i=1
for t in "$@"; do cp "stills/${prefix}_$(printf %.2f $t).jpg" "$d/$(printf %04d $i).jpg"; i=$((i+1)); done
n=$((i-1)); rows=$(( (n + cols - 1) / cols ))
ffmpeg -v error -y -i "$d/%04d.jpg" -vf "scale=$size,tile=${cols}x${rows}:padding=4:color=black" -frames:v 1 "$out"; rm -rf "$d"
