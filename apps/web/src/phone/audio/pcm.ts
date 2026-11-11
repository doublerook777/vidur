/**
 * Pure audio helpers. `Capturer` runs inside an AudioWorklet (its source is copied into the worklet via toString,
 * so it must not reference anything outside itself). Everything else runs on the main thread.
 */

/** Resamples any input rate to 16 kHz mono PCM16 and cuts it into exact 512-sample (1,024-byte, 32 ms) frames. */
export class Capturer {
  private pos = 0; // fractional read position into the current input, carried across calls
  private buf: number[] = [];
  private readonly step: number;

  constructor(inRate: number, outRate = 16000) {
    this.step = inRate / outRate;
  }

  /** Feeds float samples in [-1, 1]. Returns zero or more complete frames. */
  push(input: Float32Array): Int16Array[] {
    const frames: Int16Array[] = [];
    const n = input.length;
    let p = this.pos;
    while (p < n) {
      const i = Math.floor(p);
      const frac = p - i;
      const s0 = input[i]!;
      const s1 = i + 1 < n ? input[i + 1]! : input[n - 1]!;
      const v = s0 + (s1 - s0) * frac;
      const c = Math.max(-1, Math.min(1, v));
      this.buf.push(c < 0 ? Math.round(c * 32768) : Math.round(c * 32767));
      if (this.buf.length === 512) {
        frames.push(Int16Array.from(this.buf));
        this.buf = [];
      }
      p += this.step;
    }
    this.pos = p - n;
    return frames;
  }

  /** The samples still waiting for a full frame, padded with silence. Used when the button is released. */
  flush(): Int16Array | null {
    if (!this.buf.length) return null;
    const out = new Int16Array(512);
    out.set(this.buf);
    this.buf = [];
    return out;
  }
}

/** Keeps the last `ms` of frames so the first syllable survives the time between speaking and pressing. */
export class PreRoll {
  private frames: Int16Array[] = [];
  private readonly max: number;
  constructor(ms = 300, frameMs = 32) {
    this.max = Math.ceil(ms / frameMs);
  }
  push(frame: Int16Array): void {
    this.frames.push(frame);
    if (this.frames.length > this.max) this.frames.shift();
  }
  /** Returns what has been kept, oldest first, and empties the buffer. */
  drain(): Int16Array[] {
    const out = this.frames;
    this.frames = [];
    return out;
  }
  get length(): number {
    return this.frames.length;
  }
}

export function pcm16ToFloat(pcm: Int16Array): Float32Array {
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i]! / 32768;
  return out;
}

export function bytesToPcm16(bytes: ArrayBuffer): Int16Array {
  return new Int16Array(bytes.slice(0, bytes.byteLength - (bytes.byteLength % 2)));
}

export function pcm16ToBytes(frame: Int16Array): ArrayBuffer {
  return frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength) as ArrayBuffer;
}

/** A WAV file for debugging and for the "intelligible at 16 kHz" check. */
export function wavFromPcm16(frames: Int16Array[], rate = 16000): Uint8Array {
  const samples = frames.reduce((n, f) => n + f.length, 0);
  const out = new Uint8Array(44 + samples * 2);
  const v = new DataView(out.buffer);
  const w = (o: number, s: string): void => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + samples * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples * 2, true);
  let o = 44;
  for (const f of frames) for (let i = 0; i < f.length; i++, o += 2) v.setInt16(o, f[i]!, true);
  return out;
}
