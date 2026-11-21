import { editDistance, looseKey, nameKey } from './translit.js';

export interface SearchableCustomer {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  aliases: string[];
}

const digitsOnly = (s: string): string => s.replace(/\D/g, '');

const tokensOf = (s: string): string[] =>
  s.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);

/**
 * Returns the match rank for a query against a text field across scripts:
 * 1 = Whole-field prefix (e.g. "Kumar Sanu" for query "kumar")
 * 2 = Word-boundary prefix (e.g. "Arun Kumar" for query "kumar")
 * 3 = Substring / contains
 * 4 = One-edit distance match
 * Infinity = No match
 */
function matchFieldRank(qRaw: string, qKey: string, qLoose: string, field: string): number {
  if (!field) return Infinity;

  const fRaw = field.toLowerCase();
  const fKey = nameKey(field);
  const fLoose = looseKey(field);

  // 1. Whole-string prefix match
  if (fRaw.startsWith(qRaw)) return 1;
  if (qKey && fKey.startsWith(qKey)) return 1;
  if (qLoose && fLoose.startsWith(qLoose)) return 1;

  // 2. Word-boundary prefix match (second or later token)
  const fTokens = tokensOf(field);
  if (fTokens.some((tok) => tok.startsWith(qRaw))) return 2;
  const keyTokens = fTokens.map(nameKey).filter(Boolean);
  if (qKey && keyTokens.some((tokKey) => tokKey.startsWith(qKey))) return 2;
  const looseTokens = fTokens.map(looseKey).filter(Boolean);
  if (qLoose && looseTokens.some((tokLoose) => tokLoose.startsWith(qLoose))) return 2;

  // 3. Substring / contains match
  if (fRaw.includes(qRaw)) return 3;
  if (qKey && qKey.length >= 2 && fKey.includes(qKey)) return 3;
  if (qLoose && qLoose.length >= 2 && fLoose.includes(qLoose)) return 3;

  // 4. One-edit distance match
  if (qKey && qKey.length >= 4 && fKey.length >= 4) {
    if (editDistance(qKey, fKey) <= 1) return 4;
    if (keyTokens.some((tokKey) => tokKey.length >= 4 && editDistance(qKey, tokKey) <= 1)) return 4;
  }
  if (qLoose && qLoose.length >= 4 && fLoose.length >= 4) {
    if (editDistance(qLoose, fLoose) <= 1) return 4;
    if (looseTokens.some((tokLoose) => tokLoose.length >= 4 && editDistance(qLoose, tokLoose) <= 1)) return 4;
  }

  return Infinity;
}

/**
 * Pure search across all customers. Matches name, nickname, aliases, and phone digits.
 * Works across scripts (Devanagari, Kannada, Latin) and handles typos and phone digits.
 *
 * Ranks prefix matches first, then contains, then one-edit matches.
 * Empty query returns all customers in original order.
 */
export function searchCustomers<T extends SearchableCustomer>(
  query: string,
  customers: T[],
): T[] {
  const trimmed = query.trim();
  if (!trimmed) return [...customers];

  const qDigits = digitsOnly(trimmed);
  const qRaw = trimmed.toLowerCase();
  const qKey = nameKey(trimmed);
  const qLoose = looseKey(trimmed);

  interface ScoredCustomer {
    customer: T;
    rank: number;
    index: number;
  }

  const scored: ScoredCustomer[] = [];

  customers.forEach((customer, index) => {
    let bestRank = Infinity;

    // Check phone digits if query has digits
    if (qDigits && customer.phone) {
      const cDigits = digitsOnly(customer.phone);
      if (cDigits.startsWith(qDigits)) {
        bestRank = Math.min(bestRank, 1);
      } else if (cDigits.includes(qDigits)) {
        bestRank = Math.min(bestRank, 3);
      }
    }

    // Check name
    bestRank = Math.min(bestRank, matchFieldRank(qRaw, qKey, qLoose, customer.name));

    // Check nickname
    if (customer.nickname) {
      bestRank = Math.min(bestRank, matchFieldRank(qRaw, qKey, qLoose, customer.nickname));
    }

    // Check aliases
    for (const alias of customer.aliases) {
      bestRank = Math.min(bestRank, matchFieldRank(qRaw, qKey, qLoose, alias));
    }

    if (bestRank < Infinity) {
      scored.push({ customer, rank: bestRank, index });
    }
  });

  // Sort by rank ascending (1 whole prefix, 2 word prefix, 3 contains, 4 one-edit), then stable index
  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.index - b.index;
  });

  return scored.map((s) => s.customer);
}
