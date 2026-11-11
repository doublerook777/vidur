/** Mix speech and noise at a target SNR (dB). Integer PCM16 in, integer PCM16 out. */

const SILENT_THRESHOLD = 100; // |sample| below this counts as silence for RMS measurement

function speechRms(speech: Int16Array): number {
  let sumSquares = 0;
  let count = 0;
  for (let i = 0; i < speech.length; i++) {
    const s = speech[i]!;
    if (Math.abs(s) < SILENT_THRESHOLD) continue;
    sumSquares += s * s;
    count += 1;
  }
  if (count === 0) {
    for (let i = 0; i < speech.length; i++) sumSquares += speech[i]! * speech[i]!;
    count = speech.length;
  }
  return Math.sqrt(sumSquares / Math.max(1, count));
}

function rms(samples: Int16Array | Float64Array, offset = 0, length?: number): number {
  const end = length === undefined ? samples.length : Math.min(samples.length, offset + length);
  let sumSquares = 0;
  for (let i = offset; i < end; i++) {
    const s = samples[i]!;
    sumSquares += s * s;
  }
  return Math.sqrt(sumSquares / Math.max(1, end - offset));
}

function clamp16(v: number): number {
  if (v > 32767) return 32767;
  if (v < -32768) return -32768;
  return Math.round(v);
}

/**
 * Noise is scaled so its RMS relative to the speech's non-silent RMS gives `snrDb`.
 * Noise is looped or trimmed to the speech length. Output is clipped (saturated),
 * never wrapped.
 */
export function mixAtSnr(speech: Int16Array, noise: Int16Array, snrDb: number): Int16Array {
  if (noise.length === 0) throw new RangeError('noise must not be empty');
  const sRms = speechRms(speech);
  const nRms = rms(noise);
  const targetNoiseRms = sRms * Math.pow(10, -snrDb / 20);
  const scale = nRms > 0 ? targetNoiseRms / nRms : 0;

  const out = new Int16Array(speech.length);
  for (let i = 0; i < speech.length; i++) {
    const n = noise[i % noise.length]! * scale;
    out[i] = clamp16(speech[i]! + n);
  }
  return out;
}

/**
 * Estimate the SNR of `mixed` relative to `speech` (noise = mixed − speech,
 * same alignment, speech RMS over its non-silent part).
 */
export function measureSnr(speech: Int16Array, mixed: Int16Array): number {
  const len = Math.min(speech.length, mixed.length);
  const noiseEstimate = new Float64Array(len);
  for (let i = 0; i < len; i++) noiseEstimate[i] = mixed[i]! - speech[i]!;
  const sRms = speechRms(speech.subarray(0, len));
  const nRms = rms(noiseEstimate);
  if (nRms === 0) return Infinity;
  return 20 * Math.log10(sRms / nRms);
}
