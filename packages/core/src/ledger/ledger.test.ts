import { describe, expect, it } from 'vitest';

import { Ledger } from './ledger.js';
import { MemoryStore, type LedgerEvent } from './types.js';

let tick = 0;
const clock = () => (tick += 1) * 1000;

let idCounter = 0;
const newId = () => `id-${++idCounter}`;

function freshStore(): MemoryStore {
  return new MemoryStore();
}

async function load(store = freshStore()): Promise<Ledger> {
  tick = 0;
  idCounter = 0;
  return Ledger.load(store, clock, newId);
}

/** Independent oracle: recursive parity definition over raw events. */
function oracleActivePosted(events: LedgerEvent[]): LedgerEvent[] {
  const memo = new Map<number, boolean>();
  const active = (i: number): boolean => {
    const hit = memo.get(i);
    if (hit !== undefined) return hit;
    const id = events[i]?.id;
    let flips = 0;
    events.forEach((e, j) => {
      if (e.type === 'entry_reversed' && e.targetId === id) {
        if (active(j)) flips += 1;
      }
    });
    const result = flips % 2 === 0;
    memo.set(i, result);
    return result;
  };
  return events.filter((e, i) => e.type === 'entry_posted' && active(i));
}

function oracleBalance(events: LedgerEvent[], customerId: string): number {
  let total = 0;
  for (const e of oracleActivePosted(events)) {
    if (e.type !== 'entry_posted' || e.customerId !== customerId) continue;
    total += e.kind === 'credit' ? e.paise : -e.paise;
  }
  return total;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Ledger', () => {
  it('posts entries and computes balance as credits minus payments', async () => {
    const ledger = await load();
    const c = await ledger.createCustomer('Ramesh');
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 34000 });
    await ledger.postEntry({ customerId: c.id, kind: 'payment', paise: 10000 });
    expect(ledger.balance(c.id)).toBe(24000);
  });

  it('undo of an undo restores the entry', async () => {
    const ledger = await load();
    const c = await ledger.createCustomer('Suresh');
    const store = (ledger as unknown as { store: MemoryStore }).store;
    const entry = await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 50000 });
    expect(ledger.balance(c.id)).toBe(50000);

    // reverse the entry -> balance drops to 0
    await ledger.reverse(entry.id);
    expect(ledger.balance(c.id)).toBe(0);
    expect(ledger.activeEntries()).toHaveLength(0);

    // reverse the reversal -> entry restored
    const all = await store.all();
    const reversal = all.find((e) => e.type === 'entry_reversed' && e.targetId === entry.id);
    expect(reversal).toBeDefined();
    await ledger.reverse(reversal!.id);
    expect(ledger.balance(c.id)).toBe(50000);
    expect(ledger.lastEntry()?.id).toBe(entry.id);
  });

  it('matches the raw-event oracle after a seeded 200-operation sequence', async () => {
    const rand = mulberry32(1234567);
    const store = freshStore();
    const ledger = await load(store);
    const pick = <T,>(arr: T[]): T | undefined => arr[Math.floor(rand() * arr.length)];

    const customerIds: string[] = [];
    const postedIds: string[] = [];
    const reversalIds: string[] = [];

    for (let op = 0; op < 200; op++) {
      const roll = rand();
      if (roll < 0.15 || customerIds.length === 0) {
        const c = await ledger.createCustomer(`Customer ${op}`);
        customerIds.push(c.id);
      } else if (roll < 0.6) {
        const paise = 1 + Math.floor(rand() * 100000);
        const kind = rand() < 0.6 ? 'credit' : 'payment';
        const e = await ledger.postEntry({
          customerId: pick(customerIds)!,
          kind,
          paise,
          at: Math.floor(rand() * 1e12),
        });
        postedIds.push(e.id);
      } else if (roll < 0.75 && (postedIds.length > 0 || reversalIds.length > 0)) {
        const pool = [...postedIds, ...reversalIds];
        const target = pick(pool)!;
        await ledger.reverse(target);
        const allAfter = await store.all();
        const last = allAfter.filter((e) => e.type === 'entry_reversed').at(-1);
        if (last) reversalIds.push(last.id);
      } else if (roll < 0.85) {
        await ledger.addNote(pick(customerIds)!, `note ${op}`, rand() < 0.5 ? Math.floor(rand() * 1e12) : undefined);
      } else if (roll < 0.92) {
        await ledger.setConsent(pick(customerIds)!, rand() < 0.5);
      } else {
        await ledger.recordReminder(pick(customerIds)!);
      }
    }

    const raw = await store.all();
    for (const id of customerIds) {
      expect(ledger.balance(id)).toBe(oracleBalance(raw, id));
    }
  });

  it('supports negative balances (customer overpaid / owes nothing)', async () => {
    const ledger = await load();
    const c = await ledger.createCustomer('Lakshmi');
    await ledger.postEntry({ customerId: c.id, kind: 'payment', paise: 5000 });
    expect(ledger.balance(c.id)).toBe(-5000);
  });

  it('rejects invalid paise', async () => {
    const ledger = await load();
    const c = await ledger.createCustomer('Bad');
    await expect(ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 0 })).rejects.toThrow();
    await expect(ledger.postEntry({ customerId: c.id, kind: 'credit', paise: -1 })).rejects.toThrow();
    await expect(ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 1.5 })).rejects.toThrow();
    await expect(ledger.postEntry({ customerId: c.id, kind: 'credit', paise: Number.NaN })).rejects.toThrow();
  });

  it('deleteAll empties the store and the projection', async () => {
    const store = freshStore();
    const ledger = await load(store);
    const c = await ledger.createCustomer('Gone');
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 1234 });
    await ledger.addNote(c.id, 'note');
    await ledger.deleteAll();
    expect(await store.all()).toEqual([]);
    expect(ledger.customers()).toEqual([]);
    expect(ledger.balance(c.id)).toBe(0);
    expect(ledger.activeEntries()).toEqual([]);
    expect(ledger.lastEntry()).toBeNull();
    expect(ledger.notes(c.id)).toEqual([]);
    expect(ledger.consent(c.id)).toBe(false);
    expect(ledger.lastReminderAt(c.id)).toBeNull();
  });

  it('totalsBetween is inclusive of both boundaries and counts active entries only', async () => {
    const ledger = await load();
    const a = await ledger.createCustomer('A');
    const b = await ledger.createCustomer('B');
    const e1 = await ledger.postEntry({ customerId: a.id, kind: 'credit', paise: 100, at: 1000 });
    await ledger.postEntry({ customerId: a.id, kind: 'credit', paise: 200, at: 2000 });
    await ledger.postEntry({ customerId: b.id, kind: 'payment', paise: 300, at: 3000 });
    await ledger.postEntry({ customerId: b.id, kind: 'credit', paise: 999, at: 5000 });

    // boundaries inclusive
    expect(ledger.totalsBetween(1000, 3000)).toEqual({ creditPaise: 300, paymentPaise: 300, customerCount: 2 });
    expect(ledger.totalsBetween(1001, 2999)).toEqual({ creditPaise: 200, paymentPaise: 0, customerCount: 1 });
    expect(ledger.totalsBetween(3000, 3000)).toEqual({ creditPaise: 0, paymentPaise: 300, customerCount: 1 });

    // reversed entries excluded
    await ledger.reverse(e1.id);
    expect(ledger.totalsBetween(0, 10_000)).toEqual({ creditPaise: 200 + 999, paymentPaise: 300, customerCount: 2 });
  });

  it('lastEntry returns the most recent active entry and skips reversed ones', async () => {
    const ledger = await load();
    const c = await ledger.createCustomer('Last');
    const e1 = await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 100 });
    const e2 = await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 200 });
    expect(ledger.lastEntry()?.id).toBe(e2.id);
    await ledger.reverse(e2.id);
    expect(ledger.lastEntry()?.id).toBe(e1.id);
  });

  it('reverse rejects unknown ids and non-reversible events', async () => {
    const ledger = await load();
    const c = await ledger.createCustomer('Rev');
    await expect(ledger.reverse('nope')).rejects.toThrow();
    await expect(ledger.reverse(c.id)).rejects.toThrow();
  });

  it('tracks aliases, consent (latest wins), and reminders', async () => {
    const ledger = await load();
    const c = await ledger.createCustomer('Karthik', ['karthik']);
    await ledger.addAlias(c.id, 'karthi');
    expect(ledger.customer(c.id)?.aliases).toEqual(['karthik', 'karthi']);

    expect(ledger.consent(c.id)).toBe(false);
    await ledger.setConsent(c.id, true);
    expect(ledger.consent(c.id)).toBe(true);
    await ledger.setConsent(c.id, false);
    expect(ledger.consent(c.id)).toBe(false);

    expect(ledger.lastReminderAt(c.id)).toBeNull();
    await ledger.recordReminder(c.id);
    const t = ledger.lastReminderAt(c.id);
    expect(t).not.toBeNull();
  });

  it('topBalances sorts by descending balance', async () => {
    const ledger = await load();
    const a = await ledger.createCustomer('Alpha');
    const b = await ledger.createCustomer('Beta');
    const c = await ledger.createCustomer('Gamma');
    await ledger.postEntry({ customerId: a.id, kind: 'credit', paise: 100 });
    await ledger.postEntry({ customerId: b.id, kind: 'credit', paise: 900 });
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 400 });
    const top = ledger.topBalances(2);
    expect(top.map((x) => x.name)).toEqual(['Beta', 'Gamma']);
    expect(top[0]?.balancePaise).toBe(900);
  });
});

describe('reversing returns an id that can itself be reversed (a removal can be taken back)', () => {
  it('reverse then reverse-the-reversal restores the entry and the balance', async () => {
    let t = 1_000;
    let n = 0;
    const l = await Ledger.load(new MemoryStore(), () => (t += 10), () => `e${++n}`);
    const c = await l.createCustomer('Mohan');
    const e = await l.postEntry({ customerId: c.id, kind: 'credit', paise: 34000 });
    const removal = await l.reverse(e.id);
    expect(typeof removal).toBe('string');
    expect(l.balance(c.id)).toBe(0);
    await l.reverse(removal);
    expect(l.balance(c.id)).toBe(34000);
    expect(l.activeEntries(c.id).map((x) => x.id)).toEqual([e.id]);
  });
});
