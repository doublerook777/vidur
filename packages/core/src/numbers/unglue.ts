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

const TA_THOUSANDS: [RegExp, string][] = [
  [new RegExp(`${L}ஓராயிரத்(து|தி)?${R}`, 'gu'), 'ஒரு ஆயிரத்$1'],
  [new RegExp(`${L}ஓராயிரம்${R}`, 'gu'), 'ஒரு ஆயிரம்'],
  [new RegExp(`${L}இரண்டாயிரத்(து|தி)?${R}`, 'gu'), 'இரண்டு ஆயிரத்$1'],
  [new RegExp(`${L}இரண்டாயிரம்${R}`, 'gu'), 'இரண்டு ஆயிரம்'],
  [new RegExp(`${L}(மூவாயிர|மூன்றாயிர)த்(து|தி)?${R}`, 'gu'), 'மூன்று ஆயிரத்$2'],
  [new RegExp(`${L}(மூவாயிரம்|மூன்றாயிரம்)${R}`, 'gu'), 'மூன்று ஆயிரம்'],
  [new RegExp(`${L}(நாலாயிர|நான்காயிர)த்(து|தி)?${R}`, 'gu'), 'நான்கு ஆயிரத்$2'],
  [new RegExp(`${L}(நாலாயிரம்|நான்காயிரம்)${R}`, 'gu'), 'நான்கு ஆயிரம்'],
  [new RegExp(`${L}(ஐயாயிர|ஐந்தாயிர)த்(து|தி)?${R}`, 'gu'), 'ஐந்து ஆயிரத்$2'],
  [new RegExp(`${L}(ஐயாயிரம்|ஐந்தாயிரம்)${R}`, 'gu'), 'ஐந்து ஆயிரம்'],
  [new RegExp(`${L}ஆறாயிரத்(து|தி)?${R}`, 'gu'), 'ஆறு ஆயிரத்$1'],
  [new RegExp(`${L}ஆறாயிரம்${R}`, 'gu'), 'ஆறு ஆயிரம்'],
  [new RegExp(`${L}ஏழாயிரத்(து|தி)?${R}`, 'gu'), 'ஏழு ஆயிரத்$1'],
  [new RegExp(`${L}ஏழாயிரம்${R}`, 'gu'), 'ஏழு ஆயிரம்'],
  [new RegExp(`${L}எட்டாயிரத்(து|தி)?${R}`, 'gu'), 'எட்டு ஆயிரத்$1'],
  [new RegExp(`${L}எட்டாயிரம்${R}`, 'gu'), 'எட்டு ஆயிரம்'],
  [new RegExp(`${L}ஒன்பதாயிரத்(து|தி)?${R}`, 'gu'), 'ஒன்பது ஆயிரத்$1'],
  [new RegExp(`${L}ஒன்பதாயிரம்${R}`, 'gu'), 'ஒன்பது ஆயிரம்'],
];

const MR_HALF_NUM = 'तीन|चार|पाच|सहा|सात|आठ|नऊ|दहा|अकरा|बारा';
const GU_HALF_NUM = 'ત્રણ|ચાર|પાંચ|છ|સાત|આઠ|નવ|દસ|અગિયાર|બાર';

const RULES: [RegExp, string][] = [
  ...TA_THOUSANDS,
  // "saudhar" is "sau udhar" said fast: the two u sounds become one.
  [new RegExp(`${L}(${NUM})?sau(dhaar|dhar|dar)${R}`, 'giu'), '$1 sau u$2'],
  [new RegExp(`${L}(${NUM})?(${MULT})(${DIR})${R}`, 'giu'), '$1 $2 $3'],
  [new RegExp(`${L}(${NUM})(${MULT})${R}`, 'giu'), '$1 $2'],
  [new RegExp(`${L}(${HI_NUM})?(${HI_MULT})(${HI_DIR})${R}`, 'gu'), '$1 $2 $3'],
  [new RegExp(`${L}(${HI_NUM})(${HI_MULT})${R}`, 'gu'), '$1 $2'],
  // Marathi and Gujarati say "three and a half" as one word: Prisma writes साडेतीन, સાડાત્રણ. Put the space back.
  [new RegExp(`${L}साडे(${MR_HALF_NUM})${R}`, 'gu'), 'साडे $1'],
  [new RegExp(`${L}સાડા(${GU_HALF_NUM})${R}`, 'gu'), 'સાડા $1'],
];

export function unglue(text: string): string {
  let s = text;
  for (const [re, to] of RULES) s = s.replace(re, to);
  return s === text ? text : s.replace(/ {2,}/g, ' ').trim();
}
