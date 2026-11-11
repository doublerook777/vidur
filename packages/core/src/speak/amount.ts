import { HI_UNITS } from '../numbers/hi-units.js';

/**
 * Money is integer paise. This module speaks whole rupees only.
 *
 * style 'digits': `₹` + Indian (3,2,2) grouping — read correctly by Timbre in hi, kn and English
 *                 (see docs/DECISIONS.md "How Timbre reads amounts").
 * style 'words':  number words. hi/hinglish in Devanagari per DECISIONS (सौ/हज़ार/लाख/करोड़),
 *                 en in English Indian style. No fractional words, no 'and'. kn not supported.
 */
export type SpeakLang = 'hi' | 'en' | 'kn' | 'hinglish';

const MIN_PAISE = 100; // ₹1
const MAX_PAISE = 999_999_900; // ₹9,999,999

const HI_NATIVE: readonly string[] = HI_UNITS.map((u) => u.words[0] ?? '?');
const HI_SAU = 'सौ';
const HI_HAZAAR = 'हज़ार';
const HI_LAKH = 'लाख';
const HI_CRORE = 'करोड़';

const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'] as const;
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const;

/** ₹ digits with Indian grouping: 340 -> 340, 2500 -> 2,500, 120000 -> 1,20,000, 340000000 -> 3,40,00,000 */
export function indianGrouping(rupees: number): string {
  const s = String(rupees);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

function hiGroupWords(v: number): string[] {
  const parts: string[] = [];
  const h = Math.floor(v / 100);
  const r = v % 100;
  if (h > 0) parts.push(HI_NATIVE[h]!, HI_SAU);
  if (r > 0) parts.push(HI_NATIVE[r]!);
  return parts;
}

function hiWords(n: number): string {
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rem = n % 1e3;
  if (crore > 0) parts.push(...hiGroupWords(crore), HI_CRORE);
  if (lakh > 0) parts.push(...hiGroupWords(lakh), HI_LAKH);
  if (thousand > 0) parts.push(...hiGroupWords(thousand), HI_HAZAAR);
  if (rem > 0) parts.push(...hiGroupWords(rem));
  return parts.join(' ');
}

function enUnderHundred(r: number): string[] {
  if (r < 20) return [EN_ONES[r]!];
  const t = Math.floor(r / 10);
  const o = r % 10;
  const parts: string[] = [EN_TENS[t]!];
  if (o > 0) parts.push(EN_ONES[o]!);
  return parts;
}

function enGroupWords(v: number): string[] {
  const parts: string[] = [];
  const h = Math.floor(v / 100);
  const r = v % 100;
  if (h > 0) parts.push(EN_ONES[h]!, 'hundred');
  if (r > 0) parts.push(...enUnderHundred(r));
  return parts;
}

function enWords(n: number): string {
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rem = n % 1e3;
  if (crore > 0) parts.push(...enGroupWords(crore), 'crore');
  if (lakh > 0) parts.push(...enGroupWords(lakh), 'lakh');
  if (thousand > 0) parts.push(...enGroupWords(thousand), 'thousand');
  if (rem > 0) parts.push(...enGroupWords(rem));
  return parts.join(' ');
}

export function amountToSpoken(paise: number, lang: SpeakLang, style: 'digits' | 'words' = 'digits'): string {
  if (!Number.isInteger(paise) || paise % 100 !== 0 || paise < MIN_PAISE || paise > MAX_PAISE) {
    throw new RangeError(
      `amountToSpoken: whole rupees only — integer paise divisible by 100, ${MIN_PAISE}..${MAX_PAISE}; got ${String(paise)}`,
    );
  }
  const rupees = paise / 100;

  if (style === 'digits') {
    return `₹${indianGrouping(rupees)}`;
  }

  if (lang === 'kn') {
    throw new Error('kn words not supported');
  }
  if (lang === 'hi' || lang === 'hinglish') {
    return hiWords(rupees);
  }
  // The parser deliberately never emits a match for the bare word "one" (NEEDS_CONTEXT,
  // ambiguous with English "one"), so ₹1 is spoken with its currency word to stay parseable.
  if (rupees === 1) return 'one rupee';
  return enWords(rupees);
}
