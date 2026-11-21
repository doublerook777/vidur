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
  | { kind: 'fusedHundred'; value: number } // Kannada ಮುನ್ನೂರು = 300, Tamil ஐநூறு = 500
  | { kind: 'fusedThousand'; value: number } // Tamil இரண்டாயிரம் = 2000
  | { kind: 'mult'; value: 100 | 1000 | 100000 | 10000000 }
  | { kind: 'frac'; word: 'dedh' | 'dhai' | 'sawa' | 'paune' | 'saade' }
  | { kind: 'half'; value: number }; // Kannada ಮೂರೂವರೆ = 3.5, used before ನೂರು or ಸಾವಿರ

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
load(ta as Table);
load(te as Table);
load(mr as Table);
load(gu as Table);

for (const t of [pa, bn, ml]) {
  // Remaining draft languages (F13, P1): digits only for now, so their numerals at least convert.
  for (const [d, v] of Object.entries((t as Table).digits)) digitMap.set(d, v);
}

// ---- Kannada extras ----
const KN_TENS: [string, number][] = [
  ['ಇಪ್ಪತ್ತ', 20], ['ಮೂವತ್ತ', 30], ['ನಲವತ್ತ', 40], ['ಐವತ್ತ', 50],
  ['ಅರವತ್ತ', 60], ['ಎಪ್ಪತ್ತ', 70], ['ಎಂಬತ್ತ', 80], ['ತೊಂಬತ್ತ', 90], ['ನಾಲ್ವತ್ತ', 40],
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
  add(w.replace(/ು$/, 'ಾ'), { kind: 'fusedHundred', value: n * 100 }); // ಮುನ್ನೂರಾ, a spelling seen in text
}
// pi's kn table maps ಮೂರೂವರೆ (three and a half) to "saade", which is wrong. Replace it and add the other halves.
lexicon.delete(norm('ಮೂರೂವರೆ'));
lexicon.delete(norm('muruvare'));
for (const [w, v] of [['ಮೂರೂವರೆ', 3.5], ['ನಾಲ್ಕೂವರೆ', 4.5], ['ಐದೂವರೆ', 5.5], ['ಆರೂವರೆ', 6.5], ['ಏಳೂವರೆ', 7.5], ['ಎಂಟೂವರೆ', 8.5], ['ಒಂಬತ್ತೂವರೆ', 9.5], ['ಹತ್ತೂವರೆ', 10.5]] as const) {
  add(w, { kind: 'half', value: v });
}
add('ಸಾಡೆ', { kind: 'frac', word: 'saade' });
add('ಸವಾ', { kind: 'frac', word: 'sawa' });
add('ಪೌನೆ', { kind: 'frac', word: 'paune' });
add('ಸಾವಿರದ', { kind: 'mult', value: 1000 });
add('ನಾಲ್ವತ್ತು', { kind: 'unit', value: 40 });
add('ಲಕ್ಷದ', { kind: 'mult', value: 100000 });
for (const [w, n] of [['nuru', 1], ['innuru', 2], ['munnuru', 3], ['nanuru', 4], ['ainuru', 5], ['arunuru', 6], ['elunuru', 7], ['entunuru', 8], ['ombainuru', 9]] as const) {
  add(w, { kind: 'fusedHundred', value: n * 100 });
}

// How the recognizer spells English number words in Devanagari ("थ्री फ़ॉर्टी" for "three forty"). Seen in real output.
const DEV_EN: [string[], number][] = [
  [['वन'], 1], [['टू'], 2], [['थ्री'], 3], [['फोर', 'फ़ोर'], 4], [['फाइव', 'फ़ाइव'], 5], [['सिक्स'], 6], [['सेवन'], 7], [['एट'], 8], [['नाइन'], 9], [['टेन'], 10],
  [['इलेवन'], 11], [['ट्वेल्व'], 12], [['थर्टीन'], 13], [['फोर्टीन', 'फॉर्टीन'], 14], [['फिफ्टीन'], 15], [['सिक्सटीन'], 16], [['सेवेंटीन'], 17], [['एटीन'], 18], [['नाइनटीन'], 19],
  [['ट्वेंटी'], 20], [['थर्टी'], 30], [['फोर्टी', 'फॉर्टी', 'फ़ोर्टी'], 40], [['फिफ्टी'], 50], [['सिक्स्टी', 'सिक्सटी'], 60], [['सेवेंटी'], 70], [['एटी'], 80], [['नाइंटी'], 90],
];
for (const [words, v] of DEV_EN) for (const w of words) add(w, { kind: 'unit', value: v });
add('हंड्रेड', { kind: 'mult', value: 100 });
add('थाउजेंड', { kind: 'mult', value: 1000 });
add('थाऊजेंड', { kind: 'mult', value: 1000 });
// Spellings of the Hindi fractions that Prisma produces.
add('सावा', { kind: 'frac', word: 'sawa' });
add('साडे', { kind: 'frac', word: 'saade' });
add('डेड', { kind: 'frac', word: 'dedh' });

// ---- Tamil extras ----
// Standard and variant forms of fused hundreds (including both ஐநூறு and ஐந்நூறு)
const TA_HUNDREDS: [string, number][] = [
  ['நூறு', 100], ['நூற்று', 100], ['நூற்றி', 100],
  ['இருநூறு', 200], ['இருநூற்று', 200], ['இருநூற்றி', 200],
  ['முன்னூறு', 300], ['முன்னூற்று', 300], ['முன்னூற்றி', 300], ['முந்நூறு', 300], ['முந்நூற்று', 300], ['முந்நூற்றி', 300],
  ['நானூறு', 400], ['நானூற்று', 400], ['நானூற்றி', 400],
  ['ஐநூறு', 500], ['ஐந்நூறு', 500], ['ஐநூற்று', 500], ['ஐநூற்றி', 500], ['ஐந்நூற்று', 500], ['ஐந்நூற்றி', 500],
  ['அறுநூறு', 600], ['அறுநூற்று', 600], ['அறுநூற்றி', 600],
  ['எழுநூறு', 700], ['எழுநூற்று', 700], ['எழுநூற்றி', 700],
  ['எண்நூறு', 800], ['எண்ணூறு', 800], ['எண்நூற்று', 800], ['எண்நூற்றி', 800], ['எண்ணூற்று', 800], ['எண்ணூற்றி', 800],
  ['தொள்ளாயிரம்', 900], ['தொள்ளாயிரத்து', 900], ['தொள்ளாயிரத்தி', 900],
];
for (const [w, n] of TA_HUNDREDS) add(w, { kind: 'fusedHundred', value: n });

const TA_THOUSANDS: [string, number][] = [
  ['இரண்டாயிரம்', 2], ['இரண்டாயிரத்து', 2], ['இரண்டாயிரத்தி', 2],
  ['மூவாயிரம்', 3], ['மூவாயிரத்து', 3], ['மூவாயிரத்தி', 3],
  ['மூன்றாயிரம்', 3], ['மூன்றாயிரத்து', 3], ['மூன்றாயிரத்தி', 3],
  ['நாலாயிரம்', 4], ['நாலாயிரத்து', 4], ['நாலாயிரத்தி', 4],
  ['நான்காயிரம்', 4], ['நான்காயிரத்து', 4], ['நான்காயிரத்தி', 4],
  ['ஐயாயிரம்', 5], ['ஐயாயிரத்து', 5], ['ஐயாயிரத்தி', 5],
  ['ஐந்தாயிரம்', 5], ['ஐந்தாயிரத்து', 5], ['ஐந்தாயிரத்தி', 5],
  ['ஆறாயிரம்', 6], ['ஆறாயிரத்து', 6], ['ஆறாயிரத்தி', 6],
  ['ஏழாயிரம்', 7], ['ஏழாயிரத்து', 7], ['ஏழாயிரத்தி', 7],
  ['எட்டாயிரம்', 8], ['எட்டாயிரத்து', 8], ['எட்டாயிரத்தி', 8],
  ['ஒன்பதாயிரம்', 9], ['ஒன்பதாயிரத்து', 9], ['ஒன்பதாயிரத்தி', 9],
];
for (const [w, n] of TA_THOUSANDS) add(w, { kind: 'fusedThousand', value: n * 1000 });
add('ஆயிரம்', { kind: 'mult', value: 1000 });
add('ஆயிரத்து', { kind: 'mult', value: 1000 });
add('ஆயிரத்தி', { kind: 'mult', value: 1000 });
add('லட்சம்', { kind: 'mult', value: 100000 });
add('லட்சத்து', { kind: 'mult', value: 100000 });
add('லட்சத்தி', { kind: 'mult', value: 100000 });
add('இலட்சம்', { kind: 'mult', value: 100000 });
add('இலட்சத்து', { kind: 'mult', value: 100000 });
add('இலட்சத்தி', { kind: 'mult', value: 100000 });
add('கோடி', { kind: 'mult', value: 10000000 });

const TA_TENS: [string, number][] = [
  ['இருபத்தி', 20], ['இருபத்து', 20],
  ['முப்பத்தி', 30], ['முப்பத்து', 30],
  ['நாற்பத்தி', 40], ['நாற்பத்து', 40],
  ['ஐம்பத்தி', 50], ['ஐம்பத்து', 50],
  ['அறுபத்தி', 60], ['அறுபத்து', 60],
  ['எழுபத்தி', 70], ['எழுபத்து', 70],
  ['எண்பத்தி', 80], ['எண்பத்து', 80],
  ['தொண்ணூத்தி', 90], ['தொண்ணூத்து', 90],
];
for (const [w, n] of TA_TENS) add(w, { kind: 'unit', value: n });

// ---- Telugu extras ----
add('వంద', { kind: 'mult', value: 100 });
add('వందల', { kind: 'mult', value: 100 });
add('వందలు', { kind: 'mult', value: 100 });
add('నూరు', { kind: 'fusedHundred', value: 100 });
add('నూట', { kind: 'fusedHundred', value: 100 });
add('ఇన్నూరు', { kind: 'fusedHundred', value: 200 });
add('మున్నూరు', { kind: 'fusedHundred', value: 300 });
add('వేల', { kind: 'mult', value: 1000 });
add('వేలు', { kind: 'mult', value: 1000 });
add('లక్షల', { kind: 'mult', value: 100000 });
add('కోట్ల', { kind: 'mult', value: 10000000 });

// ---- Marathi extras ----
const MR_HUNDREDS: [string, number][] = [
  ['शंभर', 100], ['एकशे', 100], ['दोनशे', 200], ['तीनशे', 300], ['चारशे', 400], ['पाचशे', 500],
  ['सहाशे', 600], ['सातशे', 700], ['आठशे', 800], ['नऊशे', 900],
];
for (const [w, n] of MR_HUNDREDS) add(w, { kind: 'fusedHundred', value: n });
add('दीडशे', { kind: 'fusedHundred', value: 150 });
add('अडीचशे', { kind: 'fusedHundred', value: 250 });

// ---- Gujarati extras ----
const GU_HUNDREDS: [string, number][] = [
  ['સો', 100], ['એકસો', 100], ['બસો', 200], ['ત્રણસો', 300], ['ચારસો', 400], ['પાંચસો', 500], ['પાચસો', 500],
  ['છસો', 600], ['સાતસો', 700], ['આઠસો', 800], ['નવસો', 900],
];
for (const [w, n] of GU_HUNDREDS) add(w, { kind: 'fusedHundred', value: n });
add('દોઢસો', { kind: 'fusedHundred', value: 150 });
add('અઢીસો', { kind: 'fusedHundred', value: 250 });
// Prisma spellings of 40-48 with "લ" instead of "ળ"
for (const [w, v] of [
  ['ચાલીસ', 40], ['એકતાલીસ', 41], ['બેતાલીસ', 42], ['તેતાલીસ', 43], ['ચુંમાલીસ', 44],
  ['પિસ્તાલીસ', 45], ['છેતાલીસ', 46], ['સુડતાલીસ', 47], ['અડતાલીસ', 48],
] as const) {
  add(w, { kind: 'unit', value: v });
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
export const NEEDS_CONTEXT = new Set(['do', 'ek', 'one', 'sat', 'sath', 'दो', 'एक', 'ಒಂದು', 'वन', 'टू', 'एट', 'ఒకటి', 'ఒక', 'ஒன்று', 'ஒரு', 'બે', 'એક'].map(norm));

export const CURRENCY = new Set(
  [
    'rupaye', 'rupaya', 'rupiya', 'rupiye', 'rupees', 'rupee', 'rs', 'inr', '₹',
    'रुपये', 'रुपया', 'रुपए', 'रुपैया', 'रू',
    'ರೂಪಾಯಿ', 'ರೂ',
    'ரூபாய்', 'ரூபா', 'ரூ',
    'రూపాయలు', 'రూపాయి', 'రూ',
    'રૂપિયા', 'રૂપિયો', 'રૂ',
  ].map(norm),
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
