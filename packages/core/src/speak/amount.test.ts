import { describe, expect, it } from 'vitest';

import { parseAmount } from '../numbers/parse.js';
import { amountToSpoken, indianGrouping } from './amount.js';

const BOUNDARIES_RUPEES = [99, 100, 101, 999, 1000, 1001, 99_999, 100_000, 100_001, 9_999_999];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectRoundTrips(rupees: number): void {
  const paise = rupees * 100;
  for (const lang of ['hi', 'en'] as const) {
    for (const style of ['digits', 'words'] as const) {
      const text = amountToSpoken(paise, lang, style);
      const matches = parseAmount(text, lang);
      expect(matches, `${lang}/${style}: ${JSON.stringify(text)}`).toHaveLength(1);
      expect(matches[0]?.paise).toBe(paise);
    }
  }
}

describe('amountToSpoken', () => {
  it('formats digits with Indian grouping (same for every language)', () => {
    expect(indianGrouping(340)).toBe('340');
    expect(indianGrouping(2500)).toBe('2,500');
    expect(indianGrouping(120000)).toBe('1,20,000');
    expect(indianGrouping(340000000)).toBe('34,00,00,000');
    expect(indianGrouping(34000000)).toBe('3,40,00,000');
    for (const lang of ['hi', 'en', 'kn', 'hinglish'] as const) {
      expect(amountToSpoken(34000, lang, 'digits')).toBe('₹340');
      expect(amountToSpoken(250000, lang, 'digits')).toBe('₹2,500');
      expect(amountToSpoken(999_999_900, lang, 'digits')).toBe('₹99,99,999');
    }
  });

  it('renders Hindi words with Devanagari units and सौ/हज़ार/लाख/करोड़', () => {
    expect(amountToSpoken(34000, 'hi', 'words')).toBe('तीन सौ चालीस');
    expect(amountToSpoken(12_000_000, 'hi', 'words')).toBe('एक लाख बीस हज़ार');
    expect(amountToSpoken(250000, 'hi', 'words')).toBe('दो हज़ार पाँच सौ');
    expect(amountToSpoken(10000, 'hi', 'words')).toBe('एक सौ');
    expect(amountToSpoken(10_000_000, 'hi', 'words')).toBe('एक लाख');
    expect(amountToSpoken(15_000, 'hi', 'words')).toBe('एक सौ पचास');
    expect(amountToSpoken(15_000, 'hinglish', 'words')).toBe('एक सौ पचास');
    expect(amountToSpoken(15_000, 'hi', 'words')).not.toContain('डेढ़');
  });

  it('renders English words in Indian style', () => {
    expect(amountToSpoken(34000, 'en', 'words')).toBe('three hundred forty');
    expect(amountToSpoken(12_000_000, 'en', 'words')).toBe('one lakh twenty thousand');
    expect(amountToSpoken(25_000_000, 'en', 'words')).toBe('two lakh fifty thousand'); // ₹2,50,000
    expect(amountToSpoken(10_000_000, 'en', 'words')).toBe('one lakh');
    expect(amountToSpoken(100, 'en', 'words')).toBe('one rupee'); // bare "one" is not parseable
  });

  it('kn words throw', () => {
    expect(() => amountToSpoken(34000, 'kn', 'words')).toThrow('kn words not supported');
  });

  it('rejects non-whole-rupee or out-of-range inputs with RangeError', () => {
    expect(() => amountToSpoken(99, 'hi')).toThrow(RangeError); // 99 paise < 1 rupee
    expect(() => amountToSpoken(150, 'hi')).toThrow(RangeError); // ₹1.50
    expect(() => amountToSpoken(0, 'hi')).toThrow(RangeError);
    expect(() => amountToSpoken(-10_000, 'hi')).toThrow(RangeError);
    expect(() => amountToSpoken(1_234_567_890, 'hi')).toThrow(RangeError);
    expect(() => amountToSpoken(Number.NaN, 'hi')).toThrow(RangeError);
    expect(() => amountToSpoken(100.5, 'hi')).toThrow(RangeError);
  });

  it('round-trips every rupee value 1..30000 in both styles', { timeout: 120_000 }, () => {
    for (let rupees = 1; rupees <= 30_000; rupees++) {
      expectRoundTrips(rupees);
    }
  });

  it('round-trips 20000 seeded-random values up to 9,999,999', { timeout: 120_000 }, () => {
    const rand = mulberry32(20261111);
    for (let i = 0; i < 20_000; i++) {
      const rupees = 1 + Math.floor(rand() * 9_999_999);
      expectRoundTrips(rupees);
    }
  });

  it('round-trips every power-of-ten boundary and its neighbours', () => {
    for (const rupees of BOUNDARIES_RUPEES) {
      expectRoundTrips(rupees);
    }
  });
});
