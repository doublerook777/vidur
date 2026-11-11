import { describe, expect, it } from 'vitest';

import { brown, pink, shopHum, babble, NOISE_LICENCES, SAMPLE_RATE } from './noise.js';
import { mixAtSnr, measureSnr } from './mix.js';
import { buildPlan, readGolden } from './generate.js';

/** Speech-like signal: amplitude-modulated tone bursts separated by silence. */
function speechLike(seconds: number, seed: number): Int16Array {
  const n = Math.floor(seconds * SAMPLE_RATE);
  const out = new Int16Array(n);
  let a = seed >>> 0;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let i = 0;
  while (i < n) {
    const burst = Math.floor((0.1 + rng() * 0.25) * SAMPLE_RATE);
    const gap = Math.floor((0.05 + rng() * 0.15) * SAMPLE_RATE);
    const freq = 180 + rng() * 700;
    const amplitude = 0.2 + rng() * 0.4;
    for (let j = 0; j < burst && i < n; j++, i++) {
      const t = j / SAMPLE_RATE;
      const envelope = Math.sin((Math.PI * j) / Math.max(1, burst)) ** 2; // smooth attack/decay
      out[i] = Math.round(Math.sin(2 * Math.PI * freq * t) * envelope * amplitude * 32767);
    }
    i += gap;
  }
  return out;
}

describe('mixAtSnr', () => {
  const speech = speechLike(1.5, 42);
  const noise = pink(1.5, 1234);

  it.each([15, 10, 5])('hits SNR %i dB within 0.5 dB', (snrDb) => {
    const mixed = mixAtSnr(speech, noise, snrDb);
    expect(Math.abs(measureSnr(speech, mixed) - snrDb)).toBeLessThanOrEqual(0.5);
  });

  it('clips, never wraps', () => {
    const loudSpeech = new Int16Array(1000).fill(30_000);
    const loudNoise = new Int16Array(1000).fill(30_000);
    const mixed = mixAtSnr(loudSpeech, loudNoise, 5);
    for (const s of mixed) {
      expect(s).toBeLessThanOrEqual(32767);
      expect(s).toBeGreaterThanOrEqual(-32768);
    }
    // saturated, not wrapped: a huge positive input must not become negative
    expect(Math.max(...mixed)).toBe(32767);
  });
});

describe('noise generators', () => {
  it('are deterministic for a seed and different across seeds', () => {
    expect(Array.from(pink(0.2, 7).slice(0, 64))).toEqual(Array.from(pink(0.2, 7).slice(0, 64)));
    expect(Array.from(brown(0.2, 7).slice(0, 64))).toEqual(Array.from(brown(0.2, 7).slice(0, 64)));
    expect(Array.from(shopHum(0.2, 7).slice(0, 64))).toEqual(Array.from(shopHum(0.2, 7).slice(0, 64)));
    expect(Array.from(babble([pink(0.5, 3), pink(0.5, 4)], 0.2, 7).slice(0, 64))).toEqual(
      Array.from(babble([pink(0.5, 3), pink(0.5, 4)], 0.2, 7).slice(0, 64)),
    );
    expect(Array.from(pink(0.2, 7).slice(0, 64))).not.toEqual(Array.from(pink(0.2, 8).slice(0, 64)));
    expect(Array.from(brown(0.2, 7).slice(0, 64))).not.toEqual(Array.from(brown(0.2, 8).slice(0, 64)));
    expect(Array.from(shopHum(0.2, 7).slice(0, 64))).not.toEqual(Array.from(shopHum(0.2, 8).slice(0, 64)));
  });

  it('produce the requested length at 16 kHz', () => {
    expect(pink(0.5, 1).length).toBe(8000);
    expect(brown(0.5, 1).length).toBe(8000);
    expect(shopHum(0.5, 1).length).toBe(8000);
    expect(babble([pink(0.5, 1)], 0.5, 1).length).toBe(8000);
  });

  it('ships licences for every synthetic noise type', () => {
    for (const name of ['pink', 'brown', 'shopHum', 'babble']) {
      expect(NOISE_LICENCES[name]).toMatch(/synthetic/);
      expect(NOISE_LICENCES[name]).toMatch(/no licence restrictions/);
    }
  });
});

describe('corpus plan', () => {
  const plan = buildPlan(readGolden());

  it('plans 60 items x 4 variants = 240 entries with 15 per language', () => {
    expect(plan.counts.items).toBe(60);
    expect(plan.counts.variants).toBe(240);
    expect(plan.variants).toHaveLength(240);
    expect(plan.counts.perLang).toEqual({ hi: 60, hinglish: 60, en: 60, kn: 60 });
    expect(plan.counts.perSnr).toEqual({ clean: 60, '15': 60, '10': 60, '5': 60 });
    const uniqueItems = new Set(plan.variants.map((v) => v.itemId));
    expect(uniqueItems.size).toBe(60);
  });

  it('prefers amount-bearing credit/payment items (at most 8 refusals)', () => {
    const items = new Map<string, { intent: string; amount?: number }>();
    for (const v of plan.variants) items.set(v.itemId, v.expected);
    const refusals = [...items.values()].filter((e) => e.intent === 'refusal');
    expect(refusals.length).toBeLessThanOrEqual(8);
    const withAmount = [...items.values()].filter((e) => e.amount !== undefined);
    expect(withAmount.length).toBeGreaterThanOrEqual(48);
  });

  it('assigns voices Avinash/Shivani alternating by item index', () => {
    const voiceByItem = new Map<string, string>();
    for (const v of plan.variants) voiceByItem.set(v.itemId, v.voice);
    const voices = [...voiceByItem.values()];
    expect(voices.filter((v) => v === 'Avinash')).toHaveLength(30);
    expect(voices.filter((v) => v === 'Shivani')).toHaveLength(30);
  });

  it('manifest has the licences and no audio payload', () => {
    expect(plan.noiseLicences).toBeDefined();
    for (const [name, licence] of Object.entries(plan.noiseLicences)) {
      expect(licence).toMatch(/synthetic/);
      expect(NOISE_LICENCES[name]).toBeDefined();
    }
    const forbiddenKeys = new Set(['audio', 'pcm', 'buffer', 'bytes', 'samples', 'data']);
    const walk = (node: unknown, path: string): void => {
      if (node === null || typeof node !== 'object') {
        if (typeof node === 'string') expect(node.length, path).toBeLessThan(2000);
        return;
      }
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        expect(forbiddenKeys.has(key.toLowerCase()), `forbidden key ${path}.${key}`).toBe(false);
        walk(value, `${path}.${key}`);
      }
    };
    walk(plan, 'manifest');
    // and no Buffer leakage in file paths beyond names
    for (const v of plan.variants) {
      expect(v.file.endsWith('.pcm')).toBe(true);
      expect(v.file.startsWith('eval/audio/corpus/')).toBe(true);
    }
  });
});
