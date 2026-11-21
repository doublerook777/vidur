import { describe, expect, it } from 'vitest';

import { Ledger, MemoryStore } from '../ledger/index.js';
import { Dialogue, type Reply } from './engine.js';

/** Names of more than one word, titles, and asking which of two namesakes by what tells them apart. */

const T0 = Date.UTC(2026, 10, 11, 6, 30);
const paise = (n: number): number => n * 100;
const keys = (rs: Reply[]): string[] => rs.map((r) => r.key);

async function setup(lang: 'en' | 'hi' | 'kn' = 'en') {
  let n = 0;
  const ledger = await Ledger.load(new MemoryStore(), () => T0, () => `id${++n}`);
  const d = new Dialogue({ ledger, lang, clock: () => T0 });
  d.start();
  return { ledger, say1: (t: string) => d.handle(t) };
}

describe('two customers with the same first name, told apart by the rest of the name', () => {
  it('asks "Ramesh auto wala or Ramesh doodh wala", not "first or second"', async () => {
    const { ledger, say1 } = await setup();
    await ledger.createCustomer('Ramesh auto wala');
    await ledger.createCustomer('Ramesh doodh wala');
    const rs = await say1('Ramesh deposited 100 rupees');
    expect(keys(rs)).toEqual(['ask_which']);
    expect(rs[0]!.text).toContain('Ramesh auto wala');
    expect(rs[0]!.text).toContain('Ramesh doodh wala');
  });

  it('the answer "doodh wala" picks that one and saves the payment there', async () => {
    const { ledger, say1 } = await setup();
    const a = await ledger.createCustomer('Ramesh auto wala');
    const b = await ledger.createCustomer('Ramesh doodh wala');
    await say1('Ramesh deposited 100 rupees');
    const rs = await say1('doodh wala');
    expect(keys(rs)).toEqual(['payment_advance']);
    expect(ledger.balance(b.id)).toBe(-paise(100));
    expect(ledger.balance(a.id)).toBe(0);
  });

  it('a nickname still wins over the full name', async () => {
    const { ledger, say1 } = await setup();
    await ledger.createCustomer('Ramesh', ['dairy'], { nickname: 'dairy' });
    await ledger.createCustomer('Ramesh', ['school'], { nickname: 'school' });
    const rs = await say1('Ramesh deposited 100 rupees');
    expect(rs[0]!.text).toContain('Ramesh dairy');
    expect(rs[0]!.text).toContain('Ramesh school');
  });

  it('one with a nickname and one with none: both are named, the plain one by its name', async () => {
    const { ledger, say1 } = await setup();
    await ledger.createCustomer('Ramesh Kumar');
    await ledger.createCustomer('Ramesh', [], { nickname: 'dairy' });
    const rs = await say1('Ramesh deposited 100 rupees');
    expect(keys(rs)).toEqual(['ask_which']);
    expect(rs[0]!.text).toContain('Ramesh Kumar');
    expect(rs[0]!.text).toContain('Ramesh dairy');
  });

  it('identical names with nothing to tell them apart still fall back to first or second', async () => {
    const { ledger, say1 } = await setup();
    await ledger.createCustomer('Ramesh');
    await ledger.createCustomer('Ramesh');
    const rs = await say1('Ramesh deposited 100 rupees');
    expect(keys(rs)).toEqual(['ask_which_ordinal']);
    expect(rs[0]!.text).toMatch(/first/);
  });
});

describe('names of more than one word', () => {
  it('"ayush aditya deposited 1000/-" keeps both words for a new customer', async () => {
    const { ledger, say1 } = await setup();
    let rs = await say1('ayush aditya deposited 1000/-');
    expect(keys(rs)).toEqual(['confirm_new_customer']);
    expect(rs[0]!.text).toContain('ayush aditya');
    rs = await say1('yes');
    expect(ledger.customers().map((c) => c.name)).toEqual(['ayush aditya']);
    expect(keys(rs)).toContain('new_customer');
    expect(ledger.balance(ledger.customers()[0]!.id)).toBe(-paise(1000));
  });

  it('an existing "Ayush Aditya" is found by the full name', async () => {
    const { ledger, say1 } = await setup();
    const c = await ledger.createCustomer('Ayush Aditya');
    const rs = await say1('ayush aditya deposited 1000/-');
    expect(keys(rs)).toEqual(['payment_advance']);
    expect(ledger.customers()).toHaveLength(1);
    expect(ledger.balance(c.id)).toBe(-paise(1000));
  });

  it('and still by the first name alone', async () => {
    const { ledger, say1 } = await setup();
    const c = await ledger.createCustomer('Ayush Aditya');
    await say1('ayush deposited 200');
    expect(ledger.balance(c.id)).toBe(-paise(200));
  });

  it('a different surname is asked about, never filed under the other Ayush', async () => {
    const { ledger, say1 } = await setup();
    const c = await ledger.createCustomer('Ayush Aditya');
    const rs = await say1('Ayush Kumar deposited 300');
    expect(keys(rs)).toEqual(['confirm_new_customer']);
    expect(rs[0]!.text).toContain('Ayush Kumar');
    expect(ledger.balance(c.id)).toBe(0);
  });

  it('Hindi: "Sunita Devi ka 200 udhaar" is one name', async () => {
    const { ledger, say1 } = await setup('hi');
    const rs = await say1('Sunita Devi ka 200 udhaar');
    expect(keys(rs)).toEqual(['confirm_new_customer']);
    expect(rs[0]!.text).toContain('Sunita Devi');
    await say1('haan');
    expect(ledger.customers().map((c) => c.name)).toEqual(['Sunita Devi']);
  });

  it('"Ramesh ji ka 200 udhaar": the honorific is not part of the name', async () => {
    const { ledger, say1 } = await setup('hi');
    const c = await ledger.createCustomer('Ramesh');
    await say1('Ramesh ji ka 200 udhaar');
    expect(ledger.balance(c.id)).toBe(paise(200));
  });

  it('a title before the name is kept: "Dr Sharma ne 500 diya", later found as "Sharma"', async () => {
    const { ledger, say1 } = await setup('hi');
    let rs = await say1('Dr Sharma ne 500 diya');
    expect(keys(rs)).toEqual(['confirm_new_customer']);
    expect(rs[0]!.text).toContain('Dr Sharma');
    await say1('haan');
    const id = ledger.customers()[0]!.id;
    expect(ledger.customers()[0]!.name).toBe('Dr Sharma');
    rs = await say1('Sharma ne 100 diya');
    expect(keys(rs)).toEqual(['payment_advance']);
    expect(ledger.balance(id)).toBe(-paise(600));
  });

  it('the direction of "X Y ne 100 diya" still works with a two-word name', async () => {
    const { ledger, say1 } = await setup('hi');
    const c = await ledger.createCustomer('Ayush Aditya');
    await say1('Ayush Aditya ne 100 diya');
    expect(ledger.activeEntries(c.id)[0]!.kind).toBe('payment');
    await say1('Ayush Aditya ko 100 diya');
    expect(ledger.activeEntries(c.id)[1]!.kind).toBe('credit');
  });
});

describe('after a customer is renamed', () => {
  it('the voice finds the new name, and the old spelling no longer matches', async () => {
    const { ledger, say1 } = await setup();
    const c = await ledger.createCustomer('Ramseh');
    await ledger.updateCustomer(c.id, { name: 'Ramesh' });
    await say1('Ramesh ka 200 udhaar');
    expect(ledger.balance(c.id)).toBe(paise(200));
    expect(ledger.customers()).toHaveLength(1);
  });

  it('a multi-word new name is found by its full name', async () => {
    const { ledger, say1 } = await setup();
    const c = await ledger.createCustomer('Ayush');
    await ledger.updateCustomer(c.id, { name: 'Ayush Aditya' });
    const rs = await say1('ayush aditya deposited 1000/-');
    expect(keys(rs)).toEqual(['payment_advance']);
    expect(ledger.customers()).toHaveLength(1);
  });
});

describe('amounts written as 2.5k', () => {
  it('"Rajest deposited 2.5k" saves a payment of 2,500 for the confirmed new customer', async () => {
    const { ledger, say1 } = await setup();
    let rs = await say1('Rajest deposited 2.5k');
    expect(keys(rs)).toEqual(['confirm_new_customer']);
    rs = await say1('yes');
    const c = ledger.customers()[0]!;
    expect(c.name).toBe('Rajest');
    expect(ledger.activeEntries(c.id).map((e) => [e.kind, e.paise])).toEqual([['payment', paise(2500)]]);
    expect(rs.map((r) => r.text).join(' ')).toContain('₹2,500');
  });

  it('for an existing customer it saves straight away, with no question about the amount', async () => {
    const { ledger, say1 } = await setup();
    const c = await ledger.createCustomer('Rajesh');
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(4000) });
    const rs = await say1('Rajesh deposited 2.5k');
    expect(keys(rs)).toEqual(['payment_saved']);
    expect(ledger.balance(c.id)).toBe(paise(1500));
  });

  it('"Rajesh ka 2k udhaar" in Hinglish, and 10k is still read back because it is large', async () => {
    const { ledger, say1 } = await setup('hi');
    const c = await ledger.createCustomer('Rajesh');
    let rs = await say1('Rajesh ka 2k udhaar');
    expect(keys(rs)).toEqual(['credit_saved']);
    expect(ledger.balance(c.id)).toBe(paise(2000));
    rs = await say1('Rajesh ka 10k udhaar');
    expect(keys(rs)).toEqual(['confirm_amount']);
    expect(ledger.balance(c.id)).toBe(paise(2000));
  });

  it('a spoken answer to "how much?" can be 2.5k too', async () => {
    const { ledger, say1 } = await setup();
    const c = await ledger.createCustomer('Rajesh');
    await say1('Rajesh deposited');
    const rs = await say1('2.5k');
    expect(keys(rs)[0]).toMatch(/payment/);
    expect(ledger.balance(c.id)).toBe(-paise(2500));
  });
});

