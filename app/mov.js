// Minimal QuickTime (.mov) writer: H.264 video from the browser's encoder + uncompressed PCM audio.
//
// Writing the audio as plain 16-bit PCM means the soundtrack never passes through the browser's
// audio encoder or recorder, so the sound in the file is exactly the samples the app generated.
// QuickTime with PCM audio is Apple's native format: it plays in Photos and AVFoundation, and
// YouTube, TikTok and Instagram accept it.
//
// writeMov({ video: { width, height, fps, description, chunks: [{ data, timestamp, key }] },
//            audio: { sampleRate, channels, pcm: Int16Array (interleaved) } })
//   -> { parts: Uint8Array[], size }   (timestamps in microseconds, chunks in decode order)

const enc = new TextEncoder();
const cat = (arrs) => {
  let n = 0; for (const a of arrs) n += a.length;
  const out = new Uint8Array(n); let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
};
const u8 = (v) => Uint8Array.of(v & 255);
const u16 = (v) => Uint8Array.of((v >>> 8) & 255, v & 255);
const u32 = (v) => Uint8Array.of((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
const i32 = (v) => u32(v >>> 0);
const fourcc = (s) => enc.encode(s);
const zeros = (n) => new Uint8Array(n);
const box = (type, ...content) => { const body = cat(content.flat()); return cat([u32(body.length + 8), fourcc(type), body]); };
const fullBox = (type, version, flags, ...content) => box(type, u8(version), u8(flags >> 16), u8(flags >> 8), u8(flags), ...content);
const MATRIX = cat([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);
const pascal = (s) => cat([u8(s.length), fourcc(s)]);

function u32Table(values) {
  const out = new Uint8Array(values.length * 4), dv = new DataView(out.buffer);
  values.forEach((v, i) => dv.setUint32(i * 4, v >>> 0));
  return out;
}

const mvhd = (durationMs) => fullBox("mvhd", 0, 0, u32(0), u32(0), u32(1000), u32(durationMs), u32(0x00010000), u16(0x0100),
  zeros(10), MATRIX, zeros(24), u32(3));
const tkhd = (id, durationMs, volume, w, h) => fullBox("tkhd", 0, 0x000003, u32(0), u32(0), u32(id), u32(0), u32(durationMs), zeros(8),
  u16(0), u16(0), u16(volume), u16(0), MATRIX, u32(w << 16), u32(h << 16));
const mdhd = (timescale, duration) => fullBox("mdhd", 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0));
const hdlr = (componentType, subtype, name) => fullBox("hdlr", 0, 0, fourcc(componentType), fourcc(subtype), u32(0), u32(0), u32(0), pascal(name));
const dinf = () => box("dinf", fullBox("dref", 0, 0, u32(1), fullBox("url ", 0, 1)));
const stsc = (perChunk) => fullBox("stsc", 0, 0, u32(1), u32(1), u32(perChunk), u32(1));
const stco = (offset) => fullBox("stco", 0, 0, u32(1), u32(offset));

function videoTrak(v, timescale, frameDur, offset, durationMs, shift) {
  const n = v.chunks.length;
  const entry = box("avc1", zeros(6), u16(1), u16(0), u16(0), u32(0), u32(0), u32(0), u16(v.width), u16(v.height),
    u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x0018), u16(0xffff),
    box("avcC", new Uint8Array(v.description)));
  // Decode times are evenly spaced; any reordering (B-frames) goes into composition offsets.
  const offsets = v.chunks.map((c, i) => Math.round(c.timestamp * timescale / 1e6) - i * frameDur + shift);
  const runs = [];
  for (const o of offsets) { const last = runs[runs.length - 1]; if (last && last[1] === o) last[0]++; else runs.push([1, o]); }
  const needCtts = runs.length > 1 || runs[0][1] !== 0;
  const keys = []; v.chunks.forEach((c, i) => { if (c.key) keys.push(i + 1); });
  const stbl = box("stbl",
    fullBox("stsd", 0, 0, u32(1), entry),
    fullBox("stts", 0, 0, u32(1), u32(n), u32(frameDur)),
    needCtts ? fullBox("ctts", 0, 0, u32(runs.length), u32Table(runs.flat())) : [],
    keys.length < n ? fullBox("stss", 0, 0, u32(keys.length), u32Table(keys)) : [],
    stsc(n),
    fullBox("stsz", 0, 0, u32(0), u32(n), u32Table(v.chunks.map((c) => c.data.length))),
    stco(offset));
  const mediaDur = n * frameDur;
  const edts = shift ? box("edts", fullBox("elst", 0, 0, u32(1), u32(durationMs), i32(shift), u32(0x00010000))) : [];
  return box("trak", tkhd(1, durationMs, 0, v.width, v.height), edts,
    box("mdia", mdhd(timescale, mediaDur), hdlr("mhlr", "vide", "VideoHandler"),
      box("minf", fullBox("vmhd", 0, 1, u16(0x40), u16(0x8000), u16(0x8000), u16(0x8000)), hdlr("dhlr", "url ", "DataHandler"), dinf(), stbl)));
}

function audioTrak(a, offset, durationMs) {
  const frames = a.pcm.length / a.channels, bytesPerFrame = 2 * a.channels;
  const entry = box("sowt", zeros(6), u16(1), u16(0), u16(0), u32(0), u16(a.channels), u16(16), u16(0), u16(0), u32(a.sampleRate * 65536));
  const stbl = box("stbl",
    fullBox("stsd", 0, 0, u32(1), entry),
    fullBox("stts", 0, 0, u32(1), u32(frames), u32(1)),
    stsc(frames),
    fullBox("stsz", 0, 0, u32(bytesPerFrame), u32(frames)),
    stco(offset));
  return box("trak", tkhd(2, durationMs, 0x0100, 0, 0),
    box("mdia", mdhd(a.sampleRate, frames), hdlr("mhlr", "soun", "SoundHandler"),
      box("minf", fullBox("smhd", 0, 0, u16(0), u16(0)), hdlr("dhlr", "url ", "DataHandler"), dinf(), stbl)));
}

export function writeMov({ video, audio }) {
  const fps = video.fps, timescale = fps * 1000, frameDur = 1000;
  // Shift so that composition offsets are never negative (needed only when frames are reordered).
  let shift = 0;
  video.chunks.forEach((c, i) => { shift = Math.max(shift, i * frameDur - Math.round(c.timestamp * timescale / 1e6)); });
  const videoMs = Math.round(video.chunks.length * 1000 / fps);
  const audioMs = Math.round(audio.pcm.length / audio.channels * 1000 / audio.sampleRate);
  const durationMs = Math.max(videoMs, audioMs);
  const videoBytes = video.chunks.reduce((n, c) => n + c.data.length, 0);
  const pcmBytes = new Uint8Array(audio.pcm.buffer, audio.pcm.byteOffset, audio.pcm.byteLength);   // little-endian = "sowt"

  const ftyp = box("ftyp", fourcc("qt  "), u32(0x20050300), fourcc("qt  "));
  const moovFor = (vOff, aOff) => box("moov", mvhd(durationMs),
    videoTrak(video, timescale, frameDur, vOff, videoMs, shift), audioTrak(audio, aOff, audioMs));
  const moovSize = moovFor(0, 0).length;                       // offsets are fixed-width, so the size doesn't change
  const mdatHeader = cat([u32(8 + videoBytes + pcmBytes.length), fourcc("mdat")]);
  const vOff = ftyp.length + moovSize + mdatHeader.length;
  const moov = moovFor(vOff, vOff + videoBytes);
  const parts = [ftyp, moov, mdatHeader, ...video.chunks.map((c) => c.data), pcmBytes];
  return { parts, size: parts.reduce((n, p) => n + p.length, 0) };
}

// Float samples (mono, -1..1) -> interleaved 16-bit stereo, little-endian.
export function pcm16Stereo(mono) {
  const out = new Int16Array(mono.length * 2);
  for (let i = 0; i < mono.length; i++) {
    const v = Math.max(-1, Math.min(1, mono[i])) * 32767 | 0;
    out[2 * i] = v; out[2 * i + 1] = v;
  }
  return out;
}
