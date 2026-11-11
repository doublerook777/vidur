import { describe, expect, it } from 'vitest';

import { Capturer, PreRoll, bytesToPcm16, pcm16ToBytes, pcm16ToFloat, wavFromPcm16 } from './pcm.js';

const sine = (hz: number, rate: number, seconds: number): Float32Array => Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / rate));

function dominantHz(pcm: Int16Array, rate: number): number {
  // zero crossings are enough for a clean sine
  let c = 0;
  for (let i = 1; i < pcm.length; i++) if (pcm[i - 1]! < 0 && pcm[i]! >= 0) c++;
  return (c * rate) / pcm.length;
}

describe('Capturer', () => {
  it.each([48000, 44100, 16000, 32000])('turns %i Hz input into exact 512-sample frames at 16 kHz', (rate) => {
    const cap = new Capturer(rate);
    const input = sine(440, rate, 1);
    const frames: Int16Array[] = [];
    // The browser delivers 128-sample blocks.
    for (let i = 0; i < input.length; i += 128) frames.push(...cap.push(input.subarray(i, Math.min(input.length, i + 128))));
    expect(frames.every((f) => f.length === 512)).toBe(true);
    expect(frames.length).toBeGreaterThanOrEqual(30); // 1 s is 31.25 frames
    expect(frames.length).toBeLessThanOrEqual(32);
    const all = new Int16Array(frames.length * 512);
    frames.forEach((f, i) => all.set(f, i * 512));
    expect(Math.abs(dominantHz(all, 16000) - 440)).toBeLessThan(8); // pitch is preserved
  });

  it('is independent of how the input is split into blocks', () => {
    const input = sine(300, 48000, 0.5);
    const run = (block: number): Int16Array => {
      const cap = new Capturer(48000);
      const fs: Int16Array[] = [];
      for (let i = 0; i < input.length; i += block) fs.push(...cap.push(input.subarray(i, Math.min(input.length, i + block))));
      const out = new Int16Array(fs.length * 512);
      fs.forEach((f, i) => out.set(f, i * 512));
      return out;
    };
    const a = run(128), b = run(480);
    const n = Math.min(a.length, b.length);
    let maxDiff = 0;
    for (let i = 0; i < n; i++) maxDiff = Math.max(maxDiff, Math.abs(a[i]! - b[i]!));
    expect(maxDiff).toBeLessThan(40); // boundary interpolation only
  });

  it('clips instead of wrapping', () => {
    const cap = new Capturer(16000);
    const loud = new Float32Array(1024).fill(2);
    const frames = cap.push(loud);
    expect(frames[0]![0]).toBe(32767);
    const quiet = cap.push(new Float32Array(512).fill(-2));
    expect(quiet[0]![10]).toBe(-32768);
  });

  it('flush pads the last partial frame with silence', () => {
    const cap = new Capturer(16000);
    cap.push(new Float32Array(100).fill(0.5));
    const f = cap.flush()!;
    expect(f.length).toBe(512);
    expect(f[99]).toBeGreaterThan(0);
    expect(f[100]).toBe(0);
    expect(cap.flush()).toBeNull();
  });
});

describe('PreRoll', () => {
  it('keeps only the last 300 ms (10 frames of 32 ms)', () => {
    const p = new PreRoll(300, 32);
    for (let i = 0; i < 25; i++) p.push(Int16Array.of(i));
    const out = p.drain();
    expect(out).toHaveLength(10);
    expect(out[0]![0]).toBe(15);
    expect(out.at(-1)![0]).toBe(24);
    expect(p.drain()).toEqual([]);
  });
});

describe('conversions', () => {
  it('round trips bytes and float', () => {
    const f = Int16Array.of(0, 32767, -32768, 1000);
    expect([...bytesToPcm16(pcm16ToBytes(f))]).toEqual([...f]);
    const fl = pcm16ToFloat(f);
    expect(fl[1]).toBeCloseTo(1, 3);
    expect(fl[2]).toBe(-1);
  });
  it('drops a stray odd byte', () => {
    expect(bytesToPcm16(new Uint8Array([1, 0, 2]).buffer)).toHaveLength(1);
  });
  it('writes a valid 16 kHz WAV header', () => {
    const wav = wavFromPcm16([new Int16Array(512), new Int16Array(512)]);
    const dv = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF');
    expect(dv.getUint32(24, true)).toBe(16000);
    expect(dv.getUint32(40, true)).toBe(2048);
    expect(wav.length).toBe(44 + 2048);
  });
});
