import { describe, expect, it } from 'vitest';

import { Ledger, MemoryStore } from '../ledger/index.js';
import type { LedgerEvent } from '../ledger/index.js';
import { DEMO_EXPECTED_BALANCES, seedDemoLedger } from './seed.js';

const NOW = Date.UTC(2026, 10, 11, 6, 30); // fixed clock for determinism
const DAY_MS = 86_400_000;

function counterId(): () => string {
  let n = 0;
  return () => `id-${++n}`;
}

async function freshLedger(): Promise<{ ledger: Ledger; store: MemoryStore }> {
  const store = new MemoryStore();
  const ledger = await Ledger.load(store, () => NOW, counterId());
  return { ledger, store };
}

/** Strip id-like fields so two seeded ledgers can be compared structurally. */
function stripIds(events: LedgerEvent[]): unknown[] {
  return events.map((e) => {
    const clone = { ...e } as Record<string, unknown>;
    delete clone['id'];
    delete clone['customerId'];
    if (e.type === 'entry_reversed') delete clone['targetId'];
    return clone;
  });
}

describe('seedDemoLedger', () => {
  it('creates exactly 12 customers', async () => {
    const { ledger } = await freshLedger();
    await seedDemoLedger(ledger, NOW);
    expect(ledger.customers()).toHaveLength(12);
  });

  it('creates two customers named Ramesh with distinct aliases', async () => {
    const { ledger } = await freshLedger();
    await seedDemoLedger(ledger, NOW);
    const rameshes = ledger.customers().filter((c) => c.name === 'Ramesh');
    expect(rameshes).toHaveLength(2);
    const aliases = rameshes.flatMap((c) => c.aliases);
    expect(aliases).toContain('doodh wale');
    expect(aliases).toContain('auto wale');
  });

  it('balances match DEMO_EXPECTED_BALANCES', async () => {
    const { ledger } = await freshLedger();
    const { customerIds } = await seedDemoLedger(ledger, NOW);
    for (const [key, expected] of Object.entries(DEMO_EXPECTED_BALANCES)) {
      const id = customerIds[key];
      expect(id, key).toBeDefined();
      expect(ledger.balance(id as string), key).toBe(expected);
    }
  });

  it('seeds two fresh ledgers with identical event lists apart from ids', async () => {
    const a = await freshLedger();
    const b = await freshLedger();
    await seedDemoLedger(a.ledger, NOW);
    await seedDemoLedger(b.ledger, NOW);
    expect(stripIds(await a.store.all())).toEqual(stripIds(await b.store.all()));
  });

  it('has no entry in the future, and all entries are within the past 20 days', async () => {
    const { ledger } = await freshLedger();
    await seedDemoLedger(ledger, NOW);
    for (const e of ledger.activeEntries()) {
      expect(e.at).toBeLessThanOrEqual(NOW);
      expect(NOW - e.at).toBeLessThanOrEqual(20 * DAY_MS);
    }
  });

  it('uses whole-rupee amounts within 20..3500 rupees', async () => {
    const { ledger } = await freshLedger();
    await seedDemoLedger(ledger, NOW);
    for (const e of ledger.activeEntries()) {
      expect(e.paise % 100).toBe(0);
      const rupees = e.paise / 100;
      expect(rupees).toBeGreaterThanOrEqual(20);
      expect(rupees).toBeLessThanOrEqual(3500);
    }
  });

  it('sets reminder consent true for exactly two customers', async () => {
    const { ledger } = await freshLedger();
    const { customerIds } = await seedDemoLedger(ledger, NOW);
    const optedIn = Object.entries(customerIds)
      .filter(([, id]) => ledger.consent(id))
      .map(([key]) => key)
      .sort();
    expect(optedIn).toEqual(['ramesh_milk', 'sunita']);
  });

  it('has at least one fully-paid customer, one overpayment, and one future-promise note', async () => {
    const { ledger } = await freshLedger();
    const { customerIds } = await seedDemoLedger(ledger, NOW);
    const balances = Object.values(DEMO_EXPECTED_BALANCES);
    expect(balances.some((v) => v === 0)).toBe(true);
    expect(balances.some((v) => v < 0)).toBe(true);

    const mohanNotes = ledger.notes(customerIds['mohan'] as string);
    expect(mohanNotes.some((n) => n.dueAt !== undefined && n.dueAt > NOW)).toBe(true);
  });
});
