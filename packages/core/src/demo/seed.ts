/**
 * Synthetic demo data seed. ALL names are invented; no real people, no phone
 * numbers. Money is integer paise. Deterministic: no Math.random, no Date.now;
 * everything derives from the injected `nowMs`.
 */
import type { Ledger } from '../ledger/index.js';

const DAY_MS = 86_400_000;
const r = (rupees: number): number => rupees * 100;

export const DEMO_EXPECTED_BALANCES: Record<string, number> = {
  ramesh_milk: r(1000), // 340 + 260 + 500 credit, 100 payment
  ramesh_auto: r(120), // 200 credit, 80 payment
  sunita: 0, // 1250 + 750 credit, 2000 payment (fully paid)
  kavita: r(450), // 275 + 175 credit
  mohan: r(500), // 900 credit, 400 payment (plus a future-promise note)
  suresh: 0, // 100 credit, 100 payment (fully paid)
  anil: r(2500), // 3500 credit, 1000 payment
  geeta: 0, // 480 credit, 480 payment (fully paid)
  pooja: -r(200), // 300 credit, 500 payment (overpayment)
  vijay: r(1700), // 2200 credit, 500 payment
  neha: r(100), // 60 + 40 credit
  dinesh: r(2000), // 3200 credit, 1200 payment
};

interface SeedSpec {
  key: string;
  name: string;
  aliases: string[];
  entries: Array<{ kind: 'credit' | 'payment'; rupees: number; daysAgo: number; item?: string }>;
}

const SPECS: SeedSpec[] = [
  {
    key: 'ramesh_milk',
    name: 'Ramesh',
    aliases: ['doodh wale'],
    entries: [
      { kind: 'credit', rupees: 340, daysAgo: 1, item: 'doodh' },
      { kind: 'credit', rupees: 260, daysAgo: 4, item: 'doodh' },
      { kind: 'payment', rupees: 100, daysAgo: 2 },
      { kind: 'credit', rupees: 500, daysAgo: 10, item: 'ghee' },
    ],
  },
  {
    key: 'ramesh_auto',
    name: 'Ramesh',
    aliases: ['auto wale'],
    entries: [
      { kind: 'credit', rupees: 200, daysAgo: 3, item: 'chai' },
      { kind: 'payment', rupees: 80, daysAgo: 1 },
    ],
  },
  {
    key: 'sunita',
    name: 'Sunita',
    aliases: [],
    entries: [
      { kind: 'credit', rupees: 1250, daysAgo: 5, item: 'atta' },
      { kind: 'credit', rupees: 750, daysAgo: 12, item: 'chawal' },
      { kind: 'payment', rupees: 2000, daysAgo: 6 },
    ],
  },
  {
    key: 'kavita',
    name: 'Kavita',
    aliases: [],
    entries: [
      { kind: 'credit', rupees: 275, daysAgo: 2, item: 'sabzi' },
      { kind: 'credit', rupees: 175, daysAgo: 8, item: 'atta' },
    ],
  },
  {
    key: 'mohan',
    name: 'Mohan',
    aliases: [],
    entries: [
      { kind: 'credit', rupees: 900, daysAgo: 6, item: 'ghee' },
      { kind: 'payment', rupees: 400, daysAgo: 1 },
    ],
  },
  {
    key: 'suresh',
    name: 'Suresh',
    aliases: [],
    entries: [
      { kind: 'credit', rupees: 100, daysAgo: 7, item: 'chai' },
      { kind: 'payment', rupees: 100, daysAgo: 3 },
    ],
  },
  {
    key: 'anil',
    name: 'Anil',
    aliases: [],
    entries: [
      { kind: 'credit', rupees: 3500, daysAgo: 9, item: 'rice sac' },
      { kind: 'payment', rupees: 1000, daysAgo: 3 },
    ],
  },
  {
    key: 'geeta',
    name: 'Geeta',
    aliases: [],
    entries: [
      { kind: 'credit', rupees: 480, daysAgo: 1, item: 'doodh' },
      { kind: 'payment', rupees: 480, daysAgo: 1 },
    ],
  },
  {
    key: 'pooja',
    name: 'Pooja',
    aliases: [],
    entries: [
      { kind: 'credit', rupees: 300, daysAgo: 15, item: 'aloo' },
      { kind: 'payment', rupees: 500, daysAgo: 2 },
    ],
  },
  {
    key: 'vijay',
    name: 'Vijay',
    aliases: [],
    entries: [
      { kind: 'credit', rupees: 2200, daysAgo: 13, item: 'tel' },
      { kind: 'payment', rupees: 500, daysAgo: 4 },
    ],
  },
  {
    key: 'neha',
    name: 'Neha',
    aliases: [],
    entries: [
      { kind: 'credit', rupees: 60, daysAgo: 4, item: 'chai' },
      { kind: 'credit', rupees: 40, daysAgo: 1, item: 'chai' },
    ],
  },
  {
    key: 'dinesh',
    name: 'Dinesh',
    aliases: [],
    entries: [
      { kind: 'credit', rupees: 3200, daysAgo: 17, item: 'chawal' },
      { kind: 'payment', rupees: 1200, daysAgo: 6 },
    ],
  },
];

/** Exactly two customers opt in to reminders. */
const CONSENT_TRUE = new Set(['ramesh_milk', 'sunita']);

/**
 * Create the 12 synthetic customers and their history through the Ledger API
 * only. `nowMs` is the reference clock; entry `at` values are in the past.
 */
export async function seedDemoLedger(
  ledger: Ledger,
  nowMs: number,
): Promise<{ customerIds: Record<string, string> }> {
  const customerIds: Record<string, string> = {};

  for (const spec of SPECS) {
    const customer = await ledger.createCustomer(spec.name, spec.aliases);
    customerIds[spec.key] = customer.id;

    for (const e of spec.entries) {
      const at = nowMs - e.daysAgo * DAY_MS;
      await ledger.postEntry({
        customerId: customer.id,
        kind: e.kind,
        paise: r(e.rupees),
        at,
        ...(e.item !== undefined ? { item: e.item } : {}),
      });
    }

    await ledger.setConsent(customer.id, CONSENT_TRUE.has(spec.key));
  }

  // Future-promise note for Mohan (never posted as a payment).
  const mohanId = customerIds['mohan'];
  if (mohanId !== undefined) {
    await ledger.addNote(mohanId, 'kal 500 dega', nowMs + DAY_MS);
  }
  // A couple of plain context notes.
  const kavitaId = customerIds['kavita'];
  if (kavitaId !== undefined) {
    await ledger.addNote(kavitaId, 'har shanivar atta leti hai');
  }

  return { customerIds };
}
