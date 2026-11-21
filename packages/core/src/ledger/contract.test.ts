import { describe, expect, it } from 'vitest';

import { Ledger } from './ledger.js';
import { MemoryStore, type LedgerEvent } from './types.js';

/**
 * F0 contract: events written before `nickname`, `phone` and `customer_updated` existed
 * must replay with identical customers and balances. This fixture is frozen on purpose:
 * never edit it to make a test pass, and never add the new fields to it.
 */
const OLD_EVENTS = [
  { type: 'customer_created', id: 'e1', customerId: 'c1', name: 'Ramesh', aliases: ['doodh wale'], recordedAt: 1000 },
  { type: 'customer_created', id: 'e2', customerId: 'c2', name: 'Sunita', aliases: [], recordedAt: 2000 },
  { type: 'entry_posted', id: 'e3', customerId: 'c1', kind: 'credit', paise: 34000, at: 3000, recordedAt: 3000 },
  { type: 'entry_posted', id: 'e4', customerId: 'c1', kind: 'payment', paise: 10000, at: 4000, recordedAt: 4000 },
  { type: 'entry_posted', id: 'e5', customerId: 'c2', kind: 'credit', paise: 5000, at: 5000, recordedAt: 5000 },
  { type: 'entry_reversed', id: 'e6', targetId: 'e5', recordedAt: 6000 },
  { type: 'note_added', id: 'e7', customerId: 'c2', text: 'pay on Friday', recordedAt: 7000 },
  { type: 'consent_set', id: 'e8', customerId: 'c1', optIn: true, recordedAt: 8000 },
  { type: 'reminder_sent', id: 'e9', customerId: 'c1', recordedAt: 9000 },
  { type: 'customer_alias_added', id: 'e10', customerId: 'c2', alias: 'sunita devi', recordedAt: 10000 },
] as unknown as LedgerEvent[];

let n = 0;
const load = async (events: LedgerEvent[] = []) => {
  const store = new MemoryStore();
  for (const e of events) await store.append(e);
  n = 0;
  return Ledger.load(store, () => 20000 + n * 1000, () => `new-${++n}`);
};

describe('F0 ledger contract', () => {
  it('replays old events with identical customers and balances', async () => {
    const ledger = await load(OLD_EVENTS);
    expect(ledger.customers()).toEqual([
      { id: 'c1', name: 'Ramesh', aliases: ['doodh wale'] },
      { id: 'c2', name: 'Sunita', aliases: ['sunita devi'] },
    ]);
    expect(ledger.balance('c1')).toBe(24000);
    expect(ledger.balance('c2')).toBe(0);
    expect(ledger.consent('c1')).toBe(true);
    expect(ledger.customer('c1')?.nickname).toBeUndefined();
    expect(ledger.customer('c1')?.phone).toBeUndefined();
  });

  it('stores a nickname and a phone given at creation, and trims them', async () => {
    const ledger = await load();
    const c = await ledger.createCustomer('Ramesh', [], { nickname: ' dairy ', phone: ' 9876543210 ' });
    expect(c.nickname).toBe('dairy');
    expect(c.phone).toBe('9876543210');
    expect(ledger.customer(c.id)).toEqual(c);
  });

  it('leaves the fields out, not undefined, when they are blank', async () => {
    const ledger = await load();
    const c = await ledger.createCustomer('Ramesh', [], { nickname: '  ', phone: '' });
    expect('nickname' in c).toBe(false);
    expect('phone' in ledger.customers()[0]!).toBe(false);
  });

  it('updates only the fields given; the latest update wins', async () => {
    const ledger = await load(OLD_EVENTS);
    await ledger.updateCustomer('c1', { nickname: 'dairy' });
    await ledger.updateCustomer('c1', { phone: '9876543210' });
    await ledger.updateCustomer('c1', { nickname: 'milk' });
    expect(ledger.customer('c1')).toEqual({ id: 'c1', name: 'Ramesh', aliases: ['doodh wale'], nickname: 'milk', phone: '9876543210' });
    expect(ledger.customer('c2')).toEqual({ id: 'c2', name: 'Sunita', aliases: ['sunita devi'] });
  });

  it('an empty string clears a nickname or phone; a blank name is ignored', async () => {
    const ledger = await load();
    const c = await ledger.createCustomer('Ramesh', [], { nickname: 'dairy', phone: '9876543210' });
    await ledger.updateCustomer(c.id, { nickname: '', phone: '', name: '   ' });
    expect(ledger.customer(c.id)).toEqual({ id: c.id, name: 'Ramesh', aliases: [] });
    await ledger.updateCustomer(c.id, { name: 'Ramesh Kumar' });
    expect(ledger.customer(c.id)?.name).toBe('Ramesh Kumar');
  });

  it('ignores an update for an unknown customer and never changes balances', async () => {
    const ledger = await load(OLD_EVENTS);
    const before = (await ledger['store'].all()).length;
    await ledger.updateCustomer('nobody', { nickname: 'x' });
    expect((await ledger['store'].all()).length).toBe(before);
    await ledger.updateCustomer('c1', { name: 'Ramesh K', nickname: 'dairy', phone: '1' });
    expect(ledger.balance('c1')).toBe(24000);
  });

  it('two customers with the same name stay separate and keep their own nicknames', async () => {
    const ledger = await load();
    const a = await ledger.createCustomer('Ramesh', [], { nickname: 'dairy' });
    const b = await ledger.createCustomer('Ramesh', [], { nickname: 'school' });
    await ledger.postEntry({ customerId: a.id, kind: 'credit', paise: 100 });
    expect(ledger.balance(a.id)).toBe(100);
    expect(ledger.balance(b.id)).toBe(0);
    expect(ledger.customers().map((c) => c.nickname)).toEqual(['dairy', 'school']);
  });
});
