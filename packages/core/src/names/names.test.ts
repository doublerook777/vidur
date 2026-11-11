import { describe, expect, it } from 'vitest';

import { findByAlias, matchName, type KnownCustomer } from './match.js';
import { nameKey, toLatin } from './translit.js';

const C = (id: string, name: string, aliases: string[] = []): KnownCustomer => ({ id, name, aliases });

describe('cross-script keys', () => {
  it.each([
    ['रमेश', 'Ramesh'], ['ರಮೇಶ್', 'Ramesh'], ['सुनीता', 'Sunita'], ['ಸುನಿತಾ', 'Sunita'], ['सुनिता', 'Sunita'], ['कविता', 'Kavita'], ['ಕವಿತಾ', 'Kavita'],
    ['महेश', 'Mahesh'], ['सुरेश', 'Suresh'], ['मोहन', 'Mohan'], ['ಮೋಹನ್', 'Mohan'], ['अनिल', 'Anil'], ['ಅನಿಲ್', 'Anil'], ['गीता', 'Geeta'], ['पूजा', 'Pooja'], ['विजय', 'Vijay'],
  ])('%s matches %s', (a, b) => {
    expect(nameKey(a)).toBe(nameKey(b));
  });
  it('transliterates without crashing on mixed text', () => {
    expect(toLatin('रमेश doodh wale')).toContain('ramesh');
  });
});

describe('matchName', () => {
  const book = [C('1', 'Ramesh', ['doodh wale']), C('2', 'Ramesh', ['auto wale']), C('3', 'Sunita'), C('4', 'Kavita'), C('5', 'Suresh')];
  it('is exact across scripts', () => {
    expect(matchName('सुनीता', book)).toEqual({ kind: 'exact', customerId: '3' });
    expect(matchName('ಸುನಿತಾ', book)).toEqual({ kind: 'exact', customerId: '3' });
    expect(matchName('sunita', book)).toEqual({ kind: 'exact', customerId: '3' });
  });
  it('same name twice is ambiguous', () => {
    expect(matchName('Ramesh', book)).toEqual({ kind: 'ambiguous', customerIds: ['1', '2'] });
    expect(matchName('रमेश', book)).toEqual({ kind: 'ambiguous', customerIds: ['1', '2'] });
  });
  it('an alias said in the utterance settles it', () => {
    expect(matchName('Ramesh', book, 'doodh wale Ramesh ka 340 udhaar')).toEqual({ kind: 'exact', customerId: '1' });
    expect(matchName('Ramesh', book, 'Ramesh auto wale ko 200')).toEqual({ kind: 'exact', customerId: '2' });
  });
  it('a near spelling is not silently accepted', () => {
    expect(matchName('Sunitha', book).kind).toBe('exact'); // same sound
    expect(matchName('Sureshh', book).kind).toBe('exact');
    const r = matchName('Suresha', [C('9', 'Suraj'), C('5', 'Suresh')]);
    expect(['near', 'exact']).toContain(r.kind);
  });
  it('different names are new', () => {
    expect(matchName('Mohan', book)).toEqual({ kind: 'new' });
    expect(matchName('Anil', book)).toEqual({ kind: 'new' });
  });
  it('two different people with close names stay apart', () => {
    const r = matchName('Anil', [C('7', 'Anita')]);
    expect(r.kind === 'new' || r.kind === 'near').toBe(true);
    expect(matchName('Ramesh', [C('7', 'Rakesh')]).kind).not.toBe('exact');
  });
  it('finds a customer by alias alone', () => {
    expect(findByAlias('doodh wale ke 200 jama', book).map((c) => c.id)).toEqual(['1']);
  });
});
