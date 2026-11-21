import type { Customer } from '../ledger/types.js';
import { editDistance, looseKey, nameKey } from './translit.js';

/**
 * Pure customer search across name, nickname, aliases and phone digits.
 *
 * Ranking:
 * - Tier 1: Prefix matches on raw text, transliterated nameKey, or phone digits.
 * - Tier 2: Substring / contains matches on raw text, nameKey, or phone digits.
 * - Tier 3: 1-edit distance fuzzy matches on looseKey (for query length >= 4).
 *
 * Empty query returns all customers in original order.
 */
export function searchCustomers(query: string, customers: Customer[]): Customer[] {
  const raw = query.trim();
  if (!raw) return [...customers];

  const qLower = raw.toLowerCase();
  const qKey = nameKey(raw);
  const qLoose = looseKey(raw);
  const qDigits = raw.replace(/\D/g, '');

  const tier1: Customer[] = [];
  const tier2: Customer[] = [];
  const tier3: Customer[] = [];

  for (const c of customers) {
    const textFields = [c.name, ...(c.nickname ? [c.nickname] : []), ...c.aliases];
    const phoneDigits = (c.phone ?? '').replace(/\D/g, '');

    // Tier 1: Prefix match
    const isPrefix = textFields.some((f) => {
      const fLower = f.toLowerCase();
      if (fLower.startsWith(qLower)) return true;
      if (qKey && nameKey(f).startsWith(qKey)) return true;
      return false;
    }) || (qDigits.length > 0 && phoneDigits.startsWith(qDigits));

    if (isPrefix) {
      tier1.push(c);
      continue;
    }

    // Tier 2: Substring / contains match
    const isContains = textFields.some((f) => {
      const fLower = f.toLowerCase();
      if (fLower.includes(qLower)) return true;
      if (qKey && nameKey(f).includes(qKey)) return true;
      return false;
    }) || (qDigits.length > 0 && phoneDigits.includes(qDigits));

    if (isContains) {
      tier2.push(c);
      continue;
    }

    // Tier 3: 1-edit distance fuzzy match on looseKey
    if (qLoose.length >= 4) {
      const isFuzzy = textFields.some((f) => {
        const fLoose = looseKey(f);
        return fLoose.length >= 4 && editDistance(qLoose, fLoose) <= 1;
      });
      if (isFuzzy) {
        tier3.push(c);
      }
    }
  }

  return [...tier1, ...tier2, ...tier3];
}
