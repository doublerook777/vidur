import { editDistance, looseKey, nameKey } from './translit.js';

export interface KnownCustomer {
  id: string;
  name: string;
  aliases: string[];
}

export type NameMatch =
  | { kind: 'exact'; customerId: string }
  | { kind: 'ambiguous'; customerIds: string[] }
  | { kind: 'near'; customerIds: string[] } // spelled almost like a known name: ask before using it
  | { kind: 'new' }
  | { kind: 'none' };

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
  const first = (c: KnownCustomer): string => nameKey(c.name.split(/\s+/)[0] ?? c.name);
  let hits = customers.filter((c) => nameKey(c.name) === key || first(c) === key || c.aliases.some((a) => nameKey(a) === key));
  if (hits.length > 1) {
    // Try to pick one with an alias said anywhere in the utterance.
    const ctxKeys = new Set(windows(tokensOf(context + ' ' + spoken)).map(nameKey));
    const byAlias = hits.filter((c) => c.aliases.some((a) => ctxKeys.has(nameKey(a))));
    if (byAlias.length === 1) hits = byAlias;
  }
  if (hits.length === 1) return { kind: 'exact', customerId: hits[0]!.id };
  if (hits.length > 1) return { kind: 'ambiguous', customerIds: hits.map((c) => c.id) };
  const lk = looseKey(spoken);
  const near = customers.filter((c) => {
    const k = looseKey(c.name.split(/\s+/)[0] ?? c.name);
    return k === lk || (lk.length >= 5 && k.length >= 5 && editDistance(k, lk) <= 1);
  });
  if (near.length) return { kind: 'near', customerIds: near.map((c) => c.id) };
  return { kind: 'new' };
}

/** Finds a customer by an alias said in free text ("doodh wale ke 200"), when no name was said. */
export function findByAlias(text: string, customers: KnownCustomer[]): KnownCustomer[] {
  const ws = new Set(windows(tokensOf(text)).map(nameKey));
  return customers.filter((c) => c.aliases.some((a) => ws.has(nameKey(a))));
}
