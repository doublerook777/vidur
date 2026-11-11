/**
 * Speech-to-text often glues spoken words together: "saudhar" (sau udhar), "paanchsau" (paanch sau), "teensau".
 * This puts the spaces back, so the amount and the direction are read as they were said.
 * It only splits a number word from a hundred/thousand word, and a hundred/thousand word from udhaar/jama.
 */
const NUM = 'ek|do|teen|tin|char|chaar|paanch|panch|chhe|chhah|cheh|saat|aath|nau|das|gyarah|barah|terah|chaudah|pandrah|solah|satrah|atharah|unnis|bees|tees|chalis|pachas|pachaas|saath|sattar|assi|nabbe|dhai|dedh|sawa|saade|paune';
const MULT = 'sau|hazaar|hazar|lakh';
const DIR = 'udhaar|udhar|udar|uddhar|jama|jamaa';
const L = '(?<![\\p{L}\\p{M}])';
const R = '(?![\\p{L}\\p{M}])';

const HI_NUM = 'एक|दो|तीन|चार|पाँच|पांच|छह|छः|सात|आठ|नौ|दस|बीस|तीस|चालीस|पचास|साठ|सत्तर|अस्सी|नब्बे|ढाई|डेढ़|डेढ|सवा|साढ़े|साढे|पौने';
const HI_MULT = 'सौ|हज़ार|हजार|लाख';
const HI_DIR = 'उधार|उदार|उद्धार|जमा';

const RULES: [RegExp, string][] = [
  // "saudhar" is "sau udhar" said fast: the two u sounds become one.
  [new RegExp(`${L}(${NUM})?sau(dhaar|dhar|dar)${R}`, 'giu'), '$1 sau u$2'],
  [new RegExp(`${L}(${NUM})?(${MULT})(${DIR})${R}`, 'giu'), '$1 $2 $3'],
  [new RegExp(`${L}(${NUM})(${MULT})${R}`, 'giu'), '$1 $2'],
  [new RegExp(`${L}(${HI_NUM})?(${HI_MULT})(${HI_DIR})${R}`, 'gu'), '$1 $2 $3'],
  [new RegExp(`${L}(${HI_NUM})(${HI_MULT})${R}`, 'gu'), '$1 $2'],
];

export function unglue(text: string): string {
  let s = text;
  for (const [re, to] of RULES) s = s.replace(re, to);
  return s === text ? text : s.replace(/ {2,}/g, ' ').trim();
}
