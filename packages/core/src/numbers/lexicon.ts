import { HI_UNITS } from './hi-units.js';
import en from './tables/en.json' with { type: 'json' };
import hi from './tables/hi.json' with { type: 'json' };
import kn from './tables/kn.json' with { type: 'json' };
import bn from './tables/bn.json' with { type: 'json' };
import gu from './tables/gu.json' with { type: 'json' };
import ml from './tables/ml.json' with { type: 'json' };
import mr from './tables/mr.json' with { type: 'json' };
import pa from './tables/pa.json' with { type: 'json' };
import ta from './tables/ta.json' with { type: 'json' };
import te from './tables/te.json' with { type: 'json' };

/** What a single word means inside a number. */
export type Entry =
  | { kind: 'unit'; value: number } // 0..99
  | { kind: 'fusedHundred'; value: number } // Kannada ಮುನ್ನೂರು = 300
  | { kind: 'mult'; value: 100 | 1000 | 100000 | 10000000 }
  | { kind: 'frac'; word: 'dedh' | 'dhai' | 'sawa' | 'paune' | 'saade' };

/**
 * Folds spelling variants together so that table rows and STT output meet:
 * lowercase, NFC, nukta removed, chandrabindu as anusvara, doubled Latin vowels collapsed.
 */
export function norm(word: string): string {
  let s = word.normalize('NFD').toLowerCase();
  s = s.replace(/़/g, '').replace(/ँ/g, 'ं').replace(/[​-‍]/g, '');
  s = s.normalize('NFC');
  if (/^[a-z]+$/.test(s)) {
    s = s.replace(/aa/g, 'a').replace(/ee|ii/g, 'i').replace(/oo|uu/g, 'u').replace(/chh/g, 'ch');
  }
  return s;
}

interface Row {
  native: string[];
  roman: string[];
}
interface Table {
  units: Record<string, Row>;
  multipliers: Record<string, Row>;
  fractions: Record<string, Row & { value: number }>;
  digits: Record<string, string>;
}

const MULT_VALUE = { hundred: 100, thousand: 1000, lakh: 100000, crore: 10000000 } as const;
const FRAC_WORDS = ['dedh', 'dhai', 'sawa', 'paune', 'saade'] as const;

const lexicon = new Map<string, Entry>();
const digitMap = new Map<string, string>();

function add(word: string, entry: Entry): void {
  const key = norm(word.trim());
  if (!key || /\s/.test(key)) return;
  if (!lexicon.has(key)) lexicon.set(key, entry);
}

function load(t: Table, opts: { skipUnits?: boolean } = {}): void {
  for (const [k, row] of Object.entries(opts.skipUnits ? {} : t.units)) {
    const n = Number(k);
    if (n < 0 || n > 99) continue;
    for (const w of [...row.native, ...row.roman]) add(w, { kind: 'unit', value: n });
  }
  for (const [name, row] of Object.entries(t.multipliers)) {
    const v = MULT_VALUE[name as keyof typeof MULT_VALUE];
    if (v) for (const w of [...row.native, ...row.roman]) add(w, { kind: 'mult', value: v });
  }
  for (const f of FRAC_WORDS) {
    const row = t.fractions[f];
    if (row) for (const w of [...row.native, ...row.roman]) add(w, { kind: 'frac', word: f });
  }
  for (const [d, v] of Object.entries(t.digits)) digitMap.set(d, v);
}

// English and Hindi first, so they win over later languages on a clash.
load(en as Table);
for (const { value, words } of HI_UNITS) for (const w of words) add(w, { kind: 'unit', value });
load(hi as Table, { skipUnits: true });
// pi's Kannada rows for 21 to 99 are two words with the unit first ("ondu ippattu"), which is not how Kannada
// is spoken. Multi-word rows are skipped by add(), so only the single-word rows count (0 to 20 and the tens).
// The fused forms (ಇಪ್ಪತ್ತೊಂದು) are generated below.
load(kn as Table);
for (const t of [mr, gu, pa, bn, ta, te, ml]) {
  // Draft languages (F13, P1): digits only for now, so their numerals at least convert.
  for (const [d, v] of Object.entries((t as Table).digits)) digitMap.set(d, v);
}

// ---- Kannada extras ----
const KN_TENS: [string, number][] = [
  ['ಇಪ್ಪತ್ತ', 20], ['ಮೂವತ್ತ', 30], ['ನಲವತ್ತ', 40], ['ಐವತ್ತ', 50],
  ['ಅರವತ್ತ', 60], ['ಎಪ್ಪತ್ತ', 70], ['ಎಂಬತ್ತ', 80], ['ತೊಂಬತ್ತ', 90],
];
const KN_JOIN: [string, number][] = [
  ['ೊಂದು', 1], ['ೆರಡು', 2], ['್ಮೂರು', 3], ['ಮೂರು', 3], ['ನಾಲ್ಕು', 4], ['ೈದು', 5],
  ['ಾರು', 6], ['ೇಳು', 7], ['ೆಂಟು', 8], ['ೊಂಬತ್ತು', 9],
];
for (const [stem, tens] of KN_TENS) {
  for (const [tail, u] of KN_JOIN) add(stem + tail, { kind: 'unit', value: tens + u });
}
const KN_HUNDREDS: [string, number][] = [
  ['ನೂರು', 1], ['ಇನ್ನೂರು', 2], ['ಮುನ್ನೂರು', 3], ['ನಾನೂರು', 4], ['ಐನೂರು', 5],
  ['ಆರುನೂರು', 6], ['ಏಳುನೂರು', 7], ['ಎಂಟುನೂರು', 8], ['ಒಂಬೈನೂರು', 9],
];
for (const [w, n] of KN_HUNDREDS) {
  add(w, { kind: 'fusedHundred', value: n * 100 });
  add(w.replace(/ು$/, ''), { kind: 'fusedHundred', value: n * 100 }); // ಮುನ್ನೂರ before another number
}
add('ಸಾವಿರದ', { kind: 'mult', value: 1000 });
add('ಲಕ್ಷದ', { kind: 'mult', value: 100000 });
for (const [w, n] of [['nuru', 1], ['innuru', 2], ['munnuru', 3], ['nanuru', 4], ['ainuru', 5], ['arunuru', 6], ['elunuru', 7], ['entunuru', 8], ['ombainuru', 9]] as const) {
  add(w, { kind: 'fusedHundred', value: n * 100 });
}

export function lookup(word: string): Entry | undefined {
  return lexicon.get(norm(word));
}

/** Converts any supported native digit to ASCII. */
export function asciiDigits(s: string): string {
  let out = '';
  for (const ch of s) out += digitMap.get(ch) ?? ch;
  return out;
}

export function lexiconSize(): number {
  return lexicon.size;
}

/** Words that look like numbers but must not count on their own. */
export const NEEDS_CONTEXT = new Set(['do', 'ek', 'one', 'sat', 'sath']);

export const CURRENCY = new Set(
  ['rupaye', 'rupaya', 'rupiya', 'rupiye', 'rupees', 'rupee', 'rs', 'inr', '₹', 'रुपये', 'रुपया', 'रुपए', 'रुपैया', 'रू', 'ರೂಪಾಯಿ', 'ರೂ'].map(norm),
);

/** A number followed by one of these is a quantity, date or time, not money. */
export const NOT_MONEY_AFTER = new Set(
  [
    'kilo', 'kg', 'kgs', 'gram', 'grams', 'gm', 'litre', 'liter', 'ltr', 'piece', 'pieces', 'pcs', 'packet', 'packets',
    'dozen', 'meter', 'metre', 'box', 'bottle', 'bottles', 'bag', 'bori', 'tareekh', 'tarikh', 'date', 'baje', 'bajkar',
    'oclock', 'am', 'pm', 'percent', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december', 'din', 'days', 'day', 'hafte', 'weeks', 'saal', 'years', 'mahine', 'months',
    'किलो', 'ग्राम', 'लीटर', 'पैकेट', 'दर्जन', 'बोतल', 'तारीख', 'बजे', 'प्रतिशत', 'दिन', 'हफ्ते', 'साल', 'महीने', 'जनवरी', 'फरवरी',
    'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर', 'ಕಿಲೋ', 'ಗ್ರಾಂ', 'ಲೀಟರ್', 'ಪ್ಯಾಕೆಟ್', 'ತಾರೀಖು', 'ಗಂಟೆ', 'ದಿನ',
  ].map(norm),
);
