import { describe, expect, it } from 'vitest';

import { CONFIRM_BELOW, parseAmount } from './parse.js';
import { NEEDS_CONTEXT, norm } from './lexicon.js';

// Words that are also ordinary words (Hindi "do" and English "do") only count next to a currency word.
const solo = (w: string): string => (NEEDS_CONTEXT.has(norm(w)) ? `${w} rupaye` : w);
import en from './tables/en.json' with { type: 'json' };
import { HI_UNITS } from './hi-units.js';
import kn from './tables/kn.json' with { type: 'json' };

const rupees = (t: string): number[] => parseAmount(t).map((a) => a.paise / 100);

// [text, expected rupees]. One amount unless an array is given.
const SINGLE: [string, number][] = [
  // digits and grouping
  ['Ramesh ka 340 udhaar', 340], ['₹340', 340], ['₹ 340', 340], ['340 rupaye', 340], ['Rs. 340', 340], ['rs 340', 340],
  ['रमेश का ३४० उधार', 340], ['ರಮೇಶ್ ಅವರ ೩೪೦ ರೂಪಾಯಿ', 340], ['सुरेश ₹3,40,000 बाकी', 340000], ['1,500 rupees', 1500], ['₹1,20,000', 120000],
  ['2500 jama', 2500], ['१५०० रुपये', 1500],
  // Hindi, Devanagari
  ['रमेश का तीन सौ चालीस रुपये उधार', 340], ['सुनीता ने डेढ़ सौ रुपये जमा किए', 150], ['कविता का ढाई हज़ार उधार', 2500], ['महेश को सवा दो सौ रुपये', 225],
  ['अनिल का पौने तीन सौ बाकी है', 275], ['गीता ने साढ़े तीन सौ वापस दिए', 350], ['सुरेश का एक लाख बीस हज़ार', 120000], ['पूजा का सात सौ पचास', 750],
  ['विजय ने चार सौ निन्यानवे रुपये दिए', 499], ['नेहा का बारह सौ उधार', 1200], ['दिनेश का आठ सौ पैंतीस', 835], ['राधा ने पंद्रह सौ चुकाए', 1500],
  ['सवा सौ रुपये', 125], ['पौने दो सौ', 175], ['डेढ़ हज़ार', 1500], ['ढाई सौ', 250], ['साढ़े चार सौ', 450], ['दो हज़ार पाँच सौ', 2500], ['एक हज़ार', 1000],
  ['पाँच सौ', 500], ['दस हज़ार', 10000], ['पच्चीस रुपये', 25], ['सौ रुपये', 100], ['दो लाख', 200000], ['ढाई लाख', 250000], ['सवा लाख', 125000],
  // Hindi, romanized and spelling variants
  ['Ramesh ka teen sau chalis rupaye', 340], ['teen sau chaalis', 340], ['teen sau chalees', 340], ['dedh sau', 150], ['dhai sau', 250], ['dhai hazaar', 2500], ['dhai hazar', 2500],
  ['sawa do sau', 225], ['sawa sau', 125], ['paune do sau', 175], ['paune teen sau', 275], ['saade teen sau', 350], ['saade char sau', 450], ['dedh hazaar', 1500],
  ['ek lakh bees hazaar', 120000], ['do lakh', 200000], ['paanch sau', 500], ['panch sau', 500], ['sau rupaye', 100], ['ek hazaar do sau', 1200], ['barah sau', 1200],
  ['nau sau ninyanve', 999], ['chaar sau unchaas', 449],
  // colloquial and English
  ['teen chaalis', 340], ['do pachaas', 250], ['char sau chalis', 440], ['three-forty', 340], ['one fifty', 150], ['two fifty rupees', 250], ['three forty five', 345],
  ['three hundred forty', 340], ['three hundred and forty', 340], ['one thousand five hundred', 1500], ['two lakh', 200000], ['five hundred', 500], ['twenty five', 25],
  ['ninety nine', 99], ['one hundred', 100], ['fifty thousand', 50000], ['two lakh fifty thousand', 250000], ['twelve hundred', 1200], ['a hundred rupees', 100],
  // mixed
  ['2 hazaar 500', 2500], ['do thousand', 2000], ['2 lakh', 200000], ['5 sau', 500], ['3 hazaar 5 sau', 3500], ['ek lakh 20 hazaar', 120000], ['2.5 lakh', 250000],
  // Kannada, from real Prisma output (spikes/kn-numbers.mjs)
  ['ರಮೇಶ್ ಅವರ ಇಪ್ಪತ್ತಮೂರು ರೂಪಾಯಿ ಉದಾರ.', 23], ['ರಮೇಶ್ ಅವರ ನಲವತ್ತೈದು ರೂಪಾಯಿ ಉದಾರ.', 45], ['ರಮೇಶ್ ಅವರ ತೊಂಬತ್ತೊಂಬತ್ತು ರೂಪಾಯಿ ಉದಾರ.', 99],
  ['ರಮೇಶ್ ಅವರ ನೂರ ಐವತ್ತು ರೂಪಾಯಿ ಉದಾರ.', 150], ['ರಮೇಶ್ ಅವರ ಇನ್ನೂರ ಎಪ್ಪತ್ತೈದು ರೂಪಾಯಿ ಉದಾರ.', 275], ['ರಮೇಶ್ ಅವರ ಮುನ್ನೂರ ನಲವತ್ತು ರೂಪಾಯಿ ಉದಾರ.', 340],
  ['ರಮೇಶ್ ಅವರ ಒಂದು ಸಾವಿರದ ಐನೂರು ರೂಪಾಯಿ ಉದಾರ.', 1500], ['ರಮೇಶ್ ಅವರ ಎರಡು ಸಾವಿರದ ಐನೂರು ರೂಪಾಯಿ ಉದಾರ.', 2500], ['ರಮೇಶ್ ಅವರ ಹನ್ನೆರಡು ಸಾವಿರ ರೂಪಾಯಿ ಉದಾರ.', 12000],
  ['ರಮೇಶ್ ಅವರ ಒಂದು ಲಕ್ಷ ಇಪ್ಪತ್ತು ಸಾವಿರ ರೂಪಾಯಿ ಉದಾರ.', 120000], ['ರಮೇಶ್ ಅವರ ಎರಡು ಲಕ್ಷ ರೂಪಾಯಿ ಉದಾರ.', 200000],
  ['ಐನೂರು ರೂಪಾಯಿ', 500], ['ಇಪ್ಪತ್ತೊಂದು ರೂಪಾಯಿ', 21], ['ನಾನೂರ ಐವತ್ತು', 450], ['ಒಂಬೈನೂರ ತೊಂಬತ್ತೊಂಬತ್ತು', 999],
  // Hinglish sentences with Latin and Devanagari mixed
  ['रमेश took three hundred forty rupees on credit', 340], ['Total ₹340 hai', 340], ['सुनीता paid back 1,500 rupees', 1500],
];

describe('parseAmount: one amount', () => {
  it.each(SINGLE)('%s', (text, expected) => {
    expect(rupees(text)).toEqual([expected]);
  });
});

describe('parseAmount: several amounts', () => {
  it('splits an utterance into separate entries', () => {
    expect(rupees('Ramesh ka 340 udhaar, kal 200 diya tha')).toEqual([340, 200]);
    expect(rupees('Ramesh ka teen sau chalis udhaar aur Sunita ne dedh sau diye')).toEqual([340, 150]);
    expect(rupees('340 200')).toEqual([340, 200]);
    expect(rupees('रमेश का ३४० और सुनीता का २००')).toEqual([340, 200]);
  });
  it('keeps the span and currency word', () => {
    const [a] = parseAmount('Ramesh ka ₹340 udhaar');
    expect(a!.text).toBe('₹340');
    const [b] = parseAmount('Ramesh ka 340 rupaye udhaar');
    expect(b!.text).toBe('340 rupaye');
  });
});

describe('parseAmount: STT artifacts need a confirmation', () => {
  it.each([['3:40', 340], ['3.40', 340], ['Ramesh 3.40 udhaar', 340]])('%s', (text, expected) => {
    const [a] = parseAmount(text);
    expect(a!.paise).toBe(expected * 100);
    expect(a!.source).toBe('artifact');
    expect(a!.confidence).toBeLessThan(CONFIRM_BELOW);
  });
  it('a real decimal is also low confidence', () => {
    const [a] = parseAmount('12.5 rupaye');
    expect(a!.paise).toBe(1250);
    expect(a!.confidence).toBeLessThan(CONFIRM_BELOW);
  });
  it('colloquial forms are accepted without a question', () => {
    expect(parseAmount('teen chaalis')[0]!.confidence).toBeGreaterThanOrEqual(CONFIRM_BELOW);
  });
});

describe('parseAmount: things that are not money', () => {
  it.each([
    'do kilo atta', '2 kilo chawal', '5 packet', '15 tareekh ko', '15 तारीख', 'dopahar 3 baje', 'hum do hamare do', 'do log aaye',
    '9876543210', 'call 98765 43210', 'Ramesh ko dhamki do', 'do', 'ek', '10 percent', '3 din', '2 din baad', 'ek dozen anda',
  ])('%s', (text) => {
    expect(parseAmount(text)).toEqual([]);
  });
  it('keeps the money next to a quantity', () => {
    expect(rupees('2 kilo atta 80 rupaye')).toEqual([80]);
    expect(rupees('5 packet, 40 rupaye')).toEqual([40]);
  });
  it('a currency mark makes a small word an amount', () => {
    expect(rupees('Ramesh do rupaye')).toEqual([2]);
    expect(rupees('Ramesh ₹5')).toEqual([5]);
  });
  it('lone small number words are low confidence', () => {
    expect(parseAmount('paanch')[0]!.confidence).toBeLessThan(CONFIRM_BELOW);
  });
});

describe('parseAmount: integer paise only', () => {
  it('never returns a fraction of a paisa', () => {
    for (const [t] of SINGLE) {
      for (const a of parseAmount(t)) expect(Number.isInteger(a.paise)).toBe(true);
    }
  });
  it('very large amounts are flagged', () => {
    expect(parseAmount('20 crore')[0]!.confidence).toBeLessThan(CONFIRM_BELOW);
  });
});

// Spot check of the tables: every single-word spelling of 1 to 99 must parse to its value.
type Row = { native: string[]; roman: string[] };
function tableCheck(name: string, units: Record<string, Row>, from = 1, to = 99): void {
  describe(`table rows: ${name}`, () => {
    for (let n = from; n <= to; n++) {
      const row = units[String(n)];
      if (!row) continue;
      for (const w of [...row.native, ...row.roman]) {
        if (/\s/.test(w)) continue;
        it(`${n} = ${w}`, () => {
          const got = parseAmount(solo(w)).map((a) => a.paise / 100);
          expect(got).toEqual([n]);
        });
      }
    }
  });
}
tableCheck('hi (hand-written list)', Object.fromEntries(HI_UNITS.map(({ value, words }) => [String(value), { native: words.filter((w) => /[^\x00-\x7f]/.test(w)), roman: words.filter((w) => /^[\x00-\x7f]+$/.test(w)) }])) as Record<string, Row>);
tableCheck('en', en.units as Record<string, Row>);
tableCheck('kn (single-word rows only)', kn.units as Record<string, Row>);

// Independent anchors: known words, written separately from the tables they check.
const EN_KNOWN: [string, number][] = [['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10], ['eleven', 11], ['twelve', 12], ['thirteen', 13], ['fourteen', 14], ['fifteen', 15], ['sixteen', 16], ['seventeen', 17], ['eighteen', 18], ['nineteen', 19], ['twenty', 20], ['thirty', 30], ['forty', 40], ['fifty', 50], ['sixty', 60], ['seventy', 70], ['eighty', 80], ['ninety', 90]];
const KN_KNOWN: [string, number][] = [['ಒಂದು', 1], ['ಎರಡು', 2], ['ಮೂರು', 3], ['ನಾಲ್ಕು', 4], ['ಐದು', 5], ['ಆರು', 6], ['ಏಳು', 7], ['ಎಂಟು', 8], ['ಒಂಬತ್ತು', 9], ['ಹತ್ತು', 10], ['ಹನ್ನೊಂದು', 11], ['ಹನ್ನೆರಡು', 12], ['ಹದಿಮೂರು', 13], ['ಹದಿನಾಲ್ಕು', 14], ['ಹದಿನೈದು', 15], ['ಹದಿನಾರು', 16], ['ಹದಿನೇಳು', 17], ['ಹದಿನೆಂಟು', 18], ['ಹತ್ತೊಂಬತ್ತು', 19], ['ಇಪ್ಪತ್ತು', 20], ['ಮೂವತ್ತು', 30], ['ನಲವತ್ತು', 40], ['ಐವತ್ತು', 50], ['ಅರವತ್ತು', 60], ['ಎಪ್ಪತ್ತು', 70], ['ಎಂಬತ್ತು', 80], ['ತೊಂಬತ್ತು', 90]];
const HI_KNOWN: [string, number][] = [['teen', 3], ['chaar', 4], ['paanch', 5], ['chhe', 6], ['saat', 7], ['aath', 8], ['nau', 9], ['das', 10], ['bees', 20], ['pachees', 25], ['tees', 30], ['chalis', 40], ['pachas', 50], ['saath hazaar', 60000], ['sattar', 70], ['assi', 80], ['nabbe', 90], ['ninyanve', 99], ['बीस', 20], ['पच्चीस', 25], ['चालीस', 40], ['पचास', 50], ['सत्तर', 70], ['निन्यानवे', 99]];
describe('independent anchors for the tables', () => {
  it.each([...EN_KNOWN, ...KN_KNOWN, ...HI_KNOWN])('%s = %i', (w, n) => {
    expect(rupees(solo(w))).toEqual([n]);
  });
});

describe('lexicon sanity', () => {
  it('no word means two different numbers across languages', async () => {
    const { lookup } = await import('./lexicon.js');
    const seen = new Map<string, number>();
    for (const t of [en, kn]) {
      for (const [k, row] of Object.entries(t.units as Record<string, Row>)) {
        for (const w of [...row.native, ...row.roman]) {
          if (/\s/.test(w)) continue;
          const e = lookup(w);
          if (e?.kind === 'unit') {
            const prev = seen.get(norm(w));
            if (prev !== undefined && prev !== e.value) throw new Error(`${w} maps to ${prev} and ${e.value}`);
            seen.set(norm(w), e.value);
          }
          void k;
        }
      }
    }
  });
});
