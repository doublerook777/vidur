import { Ledger, MemoryStore } from '@vidur/core';
import { describe, expect, it } from 'vitest';

import { customerDetail } from './viewmodels.js';

async function ledger() {
  let n = 0;
  return Ledger.load(new MemoryStore(), () => 1_000, () => `i${++n}`);
}

describe('customer detail: nicknames already taken by namesakes', () => {
  it('lists the nicknames of other customers with the same name, and no one else\'s', async () => {
    const l = await ledger();
    const a = await l.createCustomer('Ramesh', [], { nickname: 'dairy' });
    const b = await l.createCustomer('Ramesh');
    await l.createCustomer('Ramesh Kumar', [], { nickname: 'auto' });
    await l.createCustomer('Sunita', [], { nickname: 'school' });
    expect(customerDetail(l, b.id, 2_000)!.takenNicknames).toEqual(['dairy']);
    expect(customerDetail(l, a.id, 2_000)!.takenNicknames).toEqual([]);
  });

  it('a nickname set through updateCustomer shows on the detail, and clears with an empty string', async () => {
    const l = await ledger();
    const c = await l.createCustomer('Ramesh');
    await l.updateCustomer(c.id, { nickname: 'school' });
    expect(customerDetail(l, c.id, 2_000)!.customer.nickname).toBe('school');
    await l.updateCustomer(c.id, { nickname: '' });
    expect(customerDetail(l, c.id, 2_000)!.customer.nickname).toBeUndefined();
  });
});

describe('customer detail: renaming', () => {
  it('lists the other customers, never the one being shown', async () => {
    const l = await ledger();
    const a = await l.createCustomer('Ramesh', [], { nickname: 'dairy' });
    await l.createCustomer('Sunita');
    expect(customerDetail(l, a.id, 2_000)!.otherCustomers).toEqual([{ name: 'Sunita' }]);
  });

  it('a new name shows everywhere the customer is shown: detail, entries and balance stay with the same customer', async () => {
    const l = await ledger();
    const c = await l.createCustomer('Ramseh');
    await l.postEntry({ customerId: c.id, kind: 'credit', paise: 12_300 });
    await l.updateCustomer(c.id, { name: '  Ramesh  ' });
    const d = customerDetail(l, c.id, 2_000)!;
    expect(d.customer.name).toBe('Ramesh');
    expect(d.customer.balancePaise).toBe(12_300);
    expect(d.entries).toHaveLength(1);
  });

  it('an empty name is ignored, the old one stays', async () => {
    const l = await ledger();
    const c = await l.createCustomer('Ramesh');
    await l.updateCustomer(c.id, { name: '   ' });
    expect(customerDetail(l, c.id, 2_000)!.customer.name).toBe('Ramesh');
  });
});

