// Renders the composition frame by frame (deterministic, so every frame is exact) and pipes the frames
// into ffmpeg. Usage:
//   node render_video.js stills <wide|tall> <t1,t2,...> [prefix]
//   node render_video.js video  <wide|tall> <fps> <out.mp4> [from] [to] [audio.wav]
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const [mode, fmt = 'wide', a3, a4, a5, a6, a7] = process.argv.slice(2);
const W = fmt === 'tall' ? 1080 : 1920, H = fmt === 'tall' ? 1920 : 1080;
(async () => {
  const b = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://127.0.0.1:8099/promo.html?fmt=${fmt}`); await p.evaluate(() => window.ready);
  if (mode === 'stills') {
    fs.mkdirSync('stills', { recursive: true });
    for (const t of a3.split(',').map(Number)) {
      await p.evaluate((t) => window.render(t), t);
      await p.screenshot({ path: `stills/${a4 || fmt}_${t.toFixed(2)}.jpg`, type: 'jpeg', quality: 90 });
    }
  } else {
    const fps = Number(a3), out = a4, from = Number(a5 || 0), to = Number(a6 || 52), audio = a7;
    const args = ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'];
    if (audio) args.push('-ss', String(from), '-t', String(to - from), '-i', audio);
    args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', String(fps * 2), '-bf', '2', '-movflags', '+faststart',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709');
    if (audio) args.push('-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest');
    args.push(out);
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round((to - from) * fps), t0 = Date.now();
    for (let i = 0; i < n; i++) {
      const t = from + i / fps;
      await p.evaluate((t) => window.render(t), t);
      const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % (fps * 2) === 0) process.stdout.write(`  ${t.toFixed(1)}s  ${((Date.now() - t0) / 1000 / (i + 1) * 1000).toFixed(0)} ms/frame\n`);
    }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r));
    console.log(`${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${out}`);
  }
  console.log(errs.slice(0, 8).join('\n') || 'no page errors'); await b.close();
})();
