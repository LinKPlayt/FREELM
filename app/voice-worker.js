// Runs the natural voice in its own worker, off the page. It only turns phonemes into speech (the
// phonemes are made on the page). When the voiceover is done the app ends this worker, which gives
// all of its memory back (WebAssembly memory can't shrink otherwise), so the video encoder has room.
import { loadKokoro, kokoroSpeak } from "./kokoro.js";

self.onmessage = async ({ data: { id, cmd, args } }) => {
  try {
    if (cmd === "ping") {
      self.postMessage({ id, result: true });
    } else if (cmd === "load") {
      await loadKokoro((f) => self.postMessage({ id, progress: f }), args.dtype);
      self.postMessage({ id, result: true });
    } else if (cmd === "speak") {
      const audio = await kokoroSpeak(args.phonemes, { voice: args.voice, speed: args.speed });
      self.postMessage({ id, result: audio }, [audio.buffer]);
    }
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
};
