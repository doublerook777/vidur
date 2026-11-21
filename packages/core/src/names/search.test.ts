import { describe, expect, it } from 'vitest';

import { searchCustomers, type SearchableCustomer } from './search.js';

const c = (
  id: string,
  name: string,
  aliases: string[] = [],
  nickname?: string,
  phone?: string,
): SearchableCustomer => ({
  id,
  name,
  aliases,
  ...(nickname !== undefined ? { nickname } : {}),
  ...(phone !== undefined ? { phone } : {}),
});

describe('searchCustomers', () => {
  const customers: SearchableCustomer[] = [
    c('1', 'Ramesh Kumar', ['doodh wale'], 'Dairy', '9876543210'),
    c('2', 'रमेश शर्मा', ['auto wale'], 'School', '9123456789'),
    c('3', 'ರಮೇಶ್ ಗೌಡ', ['shop'], undefined, '9988776655'),
    c('4', 'Sunita Devi', ['behenji'], 'Tailor', '8877665544'),
    c('5', 'ಸುನಿತಾ', [], undefined, '7766554433'),
    c('6', 'Mahesh Verma', ['painter'], 'Contractor', '9811223344'),
    c('7', 'Kavita', [], undefined, '9822334455'),
  ];

  it('empty or whitespace query returns all customers unchanged', () => {
    expect(searchCustomers('', customers)).toEqual(customers);
    expect(searchCustomers('   ', customers)).toEqual(customers);
  });

  it('matches across scripts: Latin query finds Devanagari and Kannada', () => {
    const results = searchCustomers('ramesh', customers);
    const ids = results.map((x) => x.id);
    expect(ids).toContain('1'); // Ramesh Kumar
    expect(ids).toContain('2'); // रमेश शर्मा
    expect(ids).toContain('3'); // ರಮೇಶ್ ಗೌಡ
  });

  it('matches across scripts: Devanagari query finds Latin and Kannada', () => {
    const results = searchCustomers('रमेश', customers);
    const ids = results.map((x) => x.id);
    expect(ids).toContain('1');
    expect(ids).toContain('2');
    expect(ids).toContain('3');
  });

  it('matches across scripts: Kannada query finds Latin and Devanagari', () => {
    const results = searchCustomers('ರಮೇಶ್', customers);
    const ids = results.map((x) => x.id);
    expect(ids).toContain('1');
    expect(ids).toContain('2');
    expect(ids).toContain('3');
  });

  it('matches by nickname across scripts', () => {
    const dairyResults = searchCustomers('dairy', customers);
    expect(dairyResults.map((x) => x.id)).toEqual(['1']);

    const tailorResults = searchCustomers('tailor', customers);
    expect(tailorResults.map((x) => x.id)).toEqual(['4']);

    const schoolResults = searchCustomers('school', customers);
    expect(schoolResults.map((x) => x.id)).toEqual(['2']);
  });

  it('matches by alias across scripts', () => {
    const results = searchCustomers('doodh wale', customers);
    expect(results.map((x) => x.id)).toEqual(['1']);

    const painterResults = searchCustomers('painter', customers);
    expect(painterResults.map((x) => x.id)).toEqual(['6']);
  });

  it('matches by phone digits: prefix and contains', () => {
    // Prefix
    const prefixResults = searchCustomers('9876', customers);
    expect(prefixResults[0]?.id).toBe('1');

    // Contains
    const containsResults = searchCustomers('543210', customers);
    expect(containsResults[0]?.id).toBe('1');
  });

  it('ranks prefix matches before contains matches', () => {
    // "Kumar" is a contains match on "Ramesh Kumar"
    // If a customer named "Kumar Sanu" existed, they would rank first
    const listWithPrefix = [
      c('10', 'Arun Kumar'),
      c('11', 'Kumar Sanu'),
    ];
    const res = searchCustomers('kumar', listWithPrefix);
    expect(res[0]?.id).toBe('11'); // prefix on Kumar Sanu
    expect(res[1]?.id).toBe('10'); // contains on Arun Kumar
  });

  it('handles typos via one-edit distance matching', () => {
    // Typo: "kavitha" or "kavitaa" -> Kavita
    const typoResults = searchCustomers('kavitaa', customers);
    expect(typoResults.map((x) => x.id)).toContain('7');

    const maheshTypo = searchCustomers('maheesh', customers);
    expect(maheshTypo.map((x) => x.id)).toContain('6');
  });

  it('is case-insensitive', () => {
    expect(searchCustomers('SUNITA', customers).map((x) => x.id)).toEqual(
      searchCustomers('sunita', customers).map((x) => x.id),
    );
  });

  it('preserves purity: does not mutate the input array', () => {
    const original = [...customers];
    searchCustomers('ramesh', customers);
    expect(customers).toEqual(original);
  });
});
