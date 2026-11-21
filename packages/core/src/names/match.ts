import { editDistance, looseKey, nameKey } from './translit.js';

export interface KnownCustomer {
  id: string;
  name: string;
  aliases: string[];
  nickname?: string;
}

export type NameMatch =
  | { kind: 'exact'; customerId: string }
  | { kind: 'ambiguous'; customerIds: string[] }
  | { kind: 'near'; customerIds: string[] } // spelled almost like a known name: ask before using it
  | { kind: 'new' }
  | { kind: 'none' };

/** Titles that come before a name. "Dr Sharma" is still found when someone says "Sharma". */
const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'doctor', 'shri', 'shree', 'sri', 'smt', 'sir', 'madam', 'श्री', 'श्रीमती', 'डॉ', 'डॉक्टर', 'मिस्टर', 'श्रीमान'].map((w) => w.toLowerCase()));
const isTitle = (w: string): boolean => TITLES.has(w.toLowerCase().replace(/\.$/, ''));

/** The first word of a name that is not a title. */
function firstWord(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return words.find((w) => !isTitle(w)) ?? words[0] ?? name;
}

/** The words of a customer that tell it apart from a namesake: the rest of the name, the nickname, the aliases. */
function distinguishingWords(c: KnownCustomer): string[] {
  const words = c.name.split(/\s+/).filter(Boolean);
  const rest = words.slice(words.indexOf(firstWord(c.name)) + 1);
  return [...rest, ...(c.nickname ? tokensOf(c.nickname) : []), ...c.aliases.flatMap(tokensOf)];
}

const tokensOf = (s: string): string[] => s.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);

/** All word windows of 1 to 3 tokens, as spoken text. */
function windows(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 1; n <= 3 && i + n <= tokens.length; n++) out.push(tokens.slice(i, i + n).join(' '));
  }
  return out;
}

/**
 * Matches a spoken name against known customers.
 * - "exact": exactly one customer's name key equals it, across scripts.
 * - "ambiguous": more than one does (two Rameshes), and the rest of the utterance doesn't pick one by alias.
 * - "near": no exact match but a known name is one edit away.
 * - "new": nothing close, so it is a new customer.
 * `context` is the rest of the utterance, used to look for an alias such as "doodh wale".
 */
export function matchName(spoken: string, customers: KnownCustomer[], context = ''): NameMatch {
  const key = nameKey(spoken);
  if (!key) return { kind: 'none' };
  const first = (c: KnownCustomer): string => nameKey(firstWord(c.name));
  let hits = customers.filter(
    (c) =>
      nameKey(c.name) === key ||
      first(c) === key ||
      (c.nickname ? nameKey(c.nickname) === key : false) ||
      c.aliases.some((a) => nameKey(a) === key),
  );
  if (hits.length > 1) {
    // Try to pick one with an alias or nickname said anywhere in the utterance.
    const ctxKeys = new Set(windows(tokensOf(context + ' ' + spoken)).map(nameKey));
    const byAlias = hits.filter(
      (c) =>
        c.aliases.some((a) => ctxKeys.has(nameKey(a))) ||
        (c.nickname ? ctxKeys.has(nameKey(c.nickname)) || ctxKeys.has(nameKey(`${c.name} ${c.nickname}`)) : false),
    );
    if (byAlias.length === 1) hits = byAlias;
  }
  if (hits.length === 1) return { kind: 'exact', customerId: hits[0]!.id };
  if (hits.length > 1) return { kind: 'ambiguous', customerIds: hits.map((c) => c.id) };
  const lk = looseKey(spoken);
  const near = customers.filter((c) => {
    const k = looseKey(firstWord(c.name));
    return k === lk || (lk.length >= 5 && k.length >= 5 && editDistance(k, lk) <= 1);
  });
  if (near.length) return { kind: 'near', customerIds: near.map((c) => c.id) };
  return { kind: 'new' };
}

/** Finds a customer by an alias said in free text ("doodh wale ke 200"), when no name was said. */
export function findByAlias(text: string, customers: KnownCustomer[]): KnownCustomer[] {
  const ws = windows(tokensOf(text));
  const exact = new Set(ws.map(nameKey));
  const hits = customers.filter(
    (c) =>
      c.aliases.some((a) => exact.has(nameKey(a))) ||
      (c.nickname ? exact.has(nameKey(c.nickname)) || exact.has(nameKey(`${c.name} ${c.nickname}`)) : false),
  );
  if (hits.length) return hits;
  // Speech-to-text spells the same words differently in each script ("दूध वाले", "ದೂದ್ ವಾಲೆ", "doodh valle"), so allow one slip.
  const loose = ws.map(looseKey).filter((k) => k.length >= 5);
  return customers.filter(
    (c) =>
      c.aliases.some((a) => {
        const k = looseKey(a);
        return k.length >= 5 && loose.some((l) => l === k || editDistance(l, k) <= 1);
      }) ||
      (c.nickname
        ? ((): boolean => {
            const k = looseKey(c.nickname!);
            return k.length >= 5 && loose.some((l) => l === k || editDistance(l, k) <= 1);
          })()
        : false),
  );
}

type Script = 'latin' | 'devanagari' | 'kannada';
const scriptOf = (s: string): Script => (/[\u0900-\u097F]/.test(s) ? 'devanagari' : /[\u0C80-\u0CFF]/.test(s) ? 'kannada' : 'latin');
const WANT: Record<string, Script> = { en: 'latin', hi: 'devanagari', kn: 'kannada' };

/** The aliases written in the script of the language being spoken (all of them if none are). */
export function aliasesFor(aliases: string[], lang: string): string[] {
  const want = WANT[lang];
  const mine = aliases.filter((a) => scriptOf(a) === want);
  return mine.length ? mine : aliases;
}

/**
 * Picks the customer a short answer names ("auto wala", "Kumar") among namesakes, by the part of the name or the
 * nickname or alias that tells them apart. Returns every customer that fits.
 */
export function findByDistinguishingWords(text: string, customers: KnownCustomer[]): KnownCustomer[] {
  const said = windows(tokensOf(text)).map(nameKey).filter(Boolean);
  if (!said.length) return [];
  const saidSet = new Set(said);
  const withWords = customers.map((c) => ({ c, words: distinguishingWords(c) })).filter((x) => x.words.length);
  // The whole of what tells a customer apart ("doodh wala") beats a single shared word ("wala").
  const whole = withWords.filter((x) => saidSet.has(nameKey(x.words.join(' '))));
  if (whole.length) return whole.map((x) => x.c);
  return withWords.filter((x) => x.words.some((w) => nameKey(w).length >= 3 && saidSet.has(nameKey(w)))).map((x) => x.c);
}

/** True when `word` is one of the words that already belong to the customer (name, nickname, alias). */
export function belongsTo(word: string, c: KnownCustomer): boolean {
  const k = looseKey(word);
  if (!k) return false;
  return [...c.name.split(/\s+/), ...distinguishingWords(c)].some((w) => {
    const wk = looseKey(w);
    return wk === k || (k.length >= 4 && wk.length >= 4 && editDistance(wk, k) <= 1);
  });
}
