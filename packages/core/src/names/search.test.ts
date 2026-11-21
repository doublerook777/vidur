import { describe, expect, it } from 'vitest';
import type { Customer } from '../ledger/types.js';
import { searchCustomers } from './search.js';

const sampleCustomers: Customer[] = [
  { id: 'c1', name: 'Ramesh', aliases: ['doodh wale'], nickname: 'dairy', phone: '9876543210' },
  { id: 'c2', name: 'सुरेश', aliases: ['darzi'], nickname: 'tailor', phone: '+91 9123456789' },
  { id: 'c3', name: 'ರಮೇಶ್', aliases: ['auto'], nickname: 'school', phone: '9845012345' },
  { id: 'c4', name: 'Sunita Sharma', aliases: ['teacher'], phone: '9000011111' },
  { id: 'c5', name: 'Mohan Lal', aliases: ['dukaan wale'], phone: '9888877777' },
];

describe('searchCustomers (pure)', () => {
  it('returns all customers when query is empty or whitespace', () => {
    expect(searchCustomers('', sampleCustomers)).toEqual(sampleCustomers);
    expect(searchCustomers('   ', sampleCustomers)).toEqual(sampleCustomers);
  });

  it('matches prefix across Latin, Devanagari and Kannada scripts', () => {
    // Cross-script: "ramesh" should match Ramesh (c1) and ರಮೇಶ್ (c3)
    const hits = searchCustomers('ramesh', sampleCustomers);
    const ids = hits.map((c) => c.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c3');

    // Devanagari query matching Devanagari customer
    const sureshHits = searchCustomers('सुरेश', sampleCustomers);
    expect(sureshHits[0]?.id).toBe('c2');

    // Latin query matching Devanagari customer via nameKey transliteration
    const sureshLatin = searchCustomers('suresh', sampleCustomers);
    expect(sureshLatin.map((c) => c.id)).toContain('c2');
  });

  it('matches by nickname', () => {
    const hits = searchCustomers('dairy', sampleCustomers);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe('c1');

    const hitsTailor = searchCustomers('tailor', sampleCustomers);
    expect(hitsTailor).toHaveLength(1);
    expect(hitsTailor[0]?.id).toBe('c2');
  });

  it('matches by aliases', () => {
    const hits = searchCustomers('doodh', sampleCustomers);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe('c1');

    const hitsAuto = searchCustomers('auto', sampleCustomers);
    expect(hitsAuto).toHaveLength(1);
    expect(hitsAuto[0]?.id).toBe('c3');
  });

  it('matches by phone digits ignoring spaces and country codes', () => {
    // Prefix
    const prefixHits = searchCustomers('9876', sampleCustomers);
    expect(prefixHits[0]?.id).toBe('c1');

    // Contains / substring
    const middleHits = searchCustomers('456789', sampleCustomers);
    expect(middleHits[0]?.id).toBe('c2');

    // Formatted query with non-digits
    const formattedQueryHits = searchCustomers('9123-456', sampleCustomers);
    expect(formattedQueryHits[0]?.id).toBe('c2');
  });

  it('ranks prefix matches before contains matches, and contains before fuzzy matches', () => {
    const pool: Customer[] = [
      { id: '1', name: 'Anirudh', aliases: [] }, // prefix of "ani"
      { id: '2', name: 'Manikandan', aliases: [] }, // contains "ani"
      { id: '3', name: 'Anil', aliases: [] }, // prefix of "ani"
    ];

    const result = searchCustomers('ani', pool);
    expect(result.map((c) => c.id)).toEqual(['1', '3', '2']);
  });

  it('matches 1-edit distance typos for queries of length >= 4', () => {
    // "sunita" typo: "sunitaa" or "sunia"
    const hits = searchCustomers('sunitaa', sampleCustomers);
    expect(hits.map((c) => c.id)).toContain('c4');

    // Short typos (< 4 chars) do not trigger fuzzy matching
    const shortHits = searchCustomers('sux', sampleCustomers);
    expect(shortHits).toHaveLength(0);
  });
});
