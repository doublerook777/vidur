import {
  type ActiveEntry,
  type Customer,
  type CustomerCreatedEvent,
  type EntryKind,
  type EntryPostedEvent,
  type LedgerEvent,
  type LedgerStore,
  type Note,
  type TotalsBetween,
} from './types.js';

/**
 * Event-sourced ledger. All state is a projection folded from the raw event log;
 * nothing is cached in a way that can drift. Every query recomputes from events.
 */

/**
 * Compute the active flag of every event via a backwards parity pass.
 * An entry_reversed toggles the active state of its target (posted entry OR earlier
 * reversal). Since a reversal always targets an EARLIER event, processing from the end
 * lets us decide each reversal's effectiveness before propagating it to its target.
 */
function computeActiveFlags(events: LedgerEvent[]): boolean[] {
  const indexById = new Map<string, number>();
  events.forEach((e, i) => indexById.set(e.id, i));

  const flipParity = new Array<number>(events.length).fill(0);
  const active = new Array<boolean>(events.length).fill(true);

  for (let i = events.length - 1; i >= 0; i--) {
    const isActive = (flipParity[i] ?? 0) % 2 === 0;
    // An event targeted by an odd number of ACTIVE reversals is inactive.
    active[i] = isActive;
    const e = events[i];
    if (e && e.type === 'entry_reversed') {
      const targetIndex = indexById.get(e.targetId);
      if (targetIndex !== undefined && isActive) {
        flipParity[targetIndex] = (flipParity[targetIndex] ?? 0) + 1;
      } else if (targetIndex !== undefined && !isActive) {
        // An inactive reversal applies zero toggles; parity unchanged.
      }
    }
  }
  return active;
}

function toActiveEntry(e: EntryPostedEvent): ActiveEntry {
  const entry: ActiveEntry = {
    id: e.id,
    customerId: e.customerId,
    kind: e.kind,
    paise: e.paise,
    at: e.at,
    recordedAt: e.recordedAt,
  };
  if (e.item !== undefined) entry.item = e.item;
  return entry;
}

function foldActivePosted(events: LedgerEvent[]): EntryPostedEvent[] {
  const active = computeActiveFlags(events);
  const out: EntryPostedEvent[] = [];
  events.forEach((e, i) => {
    if (e.type === 'entry_posted' && active[i]) out.push(e);
  });
  return out;
}

export class Ledger {
  private constructor(
    private readonly store: LedgerStore,
    private readonly clock: () => number,
    private readonly newId: () => string,
    private events: LedgerEvent[],
  ) {}

  static async load(
    store: LedgerStore,
    clock: () => number,
    newId: () => string,
  ): Promise<Ledger> {
    return new Ledger(store, clock, newId, [...(await store.all())]);
  }

  private async append(event: LedgerEvent): Promise<void> {
    await this.store.append(event);
    this.events.push(event);
  }

  async createCustomer(name: string, aliases: string[] = []): Promise<Customer> {
    const customerId = this.newId();
    const event: CustomerCreatedEvent = {
      type: 'customer_created',
      id: this.newId(),
      customerId,
      name,
      aliases: [...aliases],
      recordedAt: this.clock(),
    };
    await this.append(event);
    return { id: customerId, name, aliases: [...aliases] };
  }

  async addAlias(customerId: string, alias: string): Promise<void> {
    await this.append({
      type: 'customer_alias_added',
      id: this.newId(),
      customerId,
      alias,
      recordedAt: this.clock(),
    });
  }

  async postEntry(input: {
    customerId: string;
    kind: EntryKind;
    paise: number;
    at?: number;
    item?: string;
  }): Promise<ActiveEntry> {
    const { customerId, kind, paise, at, item } = input;
    if (!Number.isInteger(paise) || paise <= 0) {
      throw new Error(`paise must be a positive integer, got ${String(paise)}`);
    }
    const now = this.clock();
    const event: EntryPostedEvent = {
      type: 'entry_posted',
      id: this.newId(),
      customerId,
      kind,
      paise,
      at: at ?? now,
      recordedAt: now,
      ...(item !== undefined ? { item } : {}),
    };
    await this.append(event);
    return toActiveEntry(event);
  }

  async reverse(eventId: string): Promise<void> {
    const target = this.events.find((e) => e.id === eventId);
    if (!target) {
      throw new Error(`reverse: no event with id ${eventId}`);
    }
    if (target.type !== 'entry_posted' && target.type !== 'entry_reversed') {
      throw new Error(`reverse: event ${eventId} of type ${target.type} cannot be reversed`);
    }
    await this.append({
      type: 'entry_reversed',
      id: this.newId(),
      targetId: eventId,
      recordedAt: this.clock(),
    });
  }

  /** Most recent ACTIVE posted entry (by recordedAt; ties broken by log order). */
  lastEntry(): ActiveEntry | null {
    const active = foldActivePosted(this.events);
    let best: EntryPostedEvent | null = null;
    for (const e of active) {
      if (!best || e.recordedAt >= best.recordedAt) best = e;
    }
    if (!best) return null;
    return toActiveEntry(best);
  }

  activeEntries(customerId?: string): ActiveEntry[] {
    return foldActivePosted(this.events)
      .filter((e) => (customerId === undefined ? true : e.customerId === customerId))
      .map(toActiveEntry);
  }

  /** Credits minus payments, in integer paise. May be negative. */
  balance(customerId: string): number {
    let total = 0;
    for (const e of foldActivePosted(this.events)) {
      if (e.customerId !== customerId) continue;
      total += e.kind === 'credit' ? e.paise : -e.paise;
    }
    return total;
  }

  customers(): Customer[] {
    const byId = new Map<string, Customer>();
    for (const e of this.events) {
      if (e.type === 'customer_created') {
        byId.set(e.customerId, { id: e.customerId, name: e.name, aliases: [...e.aliases] });
      } else if (e.type === 'customer_alias_added') {
        const c = byId.get(e.customerId);
        if (c && !c.aliases.includes(e.alias)) c.aliases.push(e.alias);
      }
    }
    return [...byId.values()];
  }

  customer(id: string): Customer | null {
    return this.customers().find((c) => c.id === id) ?? null;
  }

  /** Top n customers by outstanding balance (descending). Ties broken by name. */
  topBalances(n: number): Array<Customer & { balancePaise: number }> {
    return this.customers()
      .map((c) => ({ ...c, balancePaise: this.balance(c.id) }))
      .sort((a, b) => b.balancePaise - a.balancePaise || a.name.localeCompare(b.name))
      .slice(0, Math.max(0, n));
  }

  /** Totals over ACTIVE entries, filtered by `at` (inclusive bounds). */
  totalsBetween(fromMs: number, toMs: number): TotalsBetween {
    let creditPaise = 0;
    let paymentPaise = 0;
    const customerIds = new Set<string>();
    for (const e of foldActivePosted(this.events)) {
      if (e.at < fromMs || e.at > toMs) continue;
      if (e.kind === 'credit') creditPaise += e.paise;
      else paymentPaise += e.paise;
      customerIds.add(e.customerId);
    }
    return { creditPaise, paymentPaise, customerCount: customerIds.size };
  }

  notes(customerId: string): Note[] {
    const out: Note[] = [];
    for (const e of this.events) {
      if (e.type === 'note_added' && e.customerId === customerId) {
        const note: Note = { id: e.id, text: e.text, recordedAt: e.recordedAt };
        if (e.dueAt !== undefined) note.dueAt = e.dueAt;
        out.push(note);
      }
    }
    return out;
  }

  async addNote(customerId: string, text: string, dueAt?: number): Promise<Note> {
    const note: Note = { id: this.newId(), text, recordedAt: this.clock() };
    if (dueAt !== undefined) note.dueAt = dueAt;
    await this.append({
      type: 'note_added',
      id: note.id,
      customerId,
      text,
      ...(dueAt !== undefined ? { dueAt } : {}),
      recordedAt: note.recordedAt,
    });
    return note;
  }

  async setConsent(customerId: string, optIn: boolean): Promise<void> {
    await this.append({
      type: 'consent_set',
      id: this.newId(),
      customerId,
      optIn,
      recordedAt: this.clock(),
    });
  }

  /** Latest consent wins; default false when never set. */
  consent(customerId: string): boolean {
    let optIn = false;
    for (const e of this.events) {
      if (e.type === 'consent_set' && e.customerId === customerId) optIn = e.optIn;
    }
    return optIn;
  }

  async recordReminder(customerId: string): Promise<void> {
    await this.append({
      type: 'reminder_sent',
      id: this.newId(),
      customerId,
      recordedAt: this.clock(),
    });
  }

  /** Epoch ms of the last reminder, or null if none was ever recorded. */
  lastReminderAt(customerId: string): number | null {
    let last: number | null = null;
    for (const e of this.events) {
      if (e.type === 'reminder_sent' && e.customerId === customerId) last = e.recordedAt;
    }
    return last;
  }

  /** Clears the store AND the in-memory projection. */
  async deleteAll(): Promise<void> {
    await this.store.clear();
    this.events = [];
  }
}
