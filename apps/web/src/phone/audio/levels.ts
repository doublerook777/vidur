/**
 * Live loudness of what the shopkeeper says (mic) and of what Vidur says (speaker), 0 to 1.
 * The voice circle reads it a few times a second to move. Nothing is stored and it never leaves the page.
 */
interface Reading {
  v: number;
  t: number;
}

const mic: Reading = { v: 0, t: 0 };
const out: Reading = { v: 0, t: 0 };

/** Root mean square of 16-bit samples, scaled so ordinary speech reads about 0.4 to 0.8. */
export function rms(samples: Int16Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i]! / 32768;
    sum += x * x;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 5);
}

const note = (r: Reading, v: number): void => {
  r.v = Math.max(v, r.v * 0.6);
  r.t = performance.now();
};
export const noteMic = (samples: Int16Array): void => note(mic, rms(samples));
export const noteSpeaker = (samples: Int16Array): void => note(out, rms(samples));

/** The reading now. It fades out on its own when no new audio arrives. */
const read = (r: Reading, now: number): number => r.v * Math.exp(-(now - r.t) / 160);
export const micLevel = (now = performance.now()): number => read(mic, now);
export const speakerLevel = (now = performance.now()): number => read(out, now);
