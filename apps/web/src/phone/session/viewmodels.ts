import { canRemind, startOfDayIst, type Ledger } from '@vidur/core';

import type { CustomerDetailVM, CustomerRow, FeedItem } from '../contract.js';

export const UNDO_MS = 10_000;

export function customerRows(ledger: Ledger): CustomerRow[] {
  const last = new Map<string, number>();
  for (const e of ledger.activeEntries()) last.set(e.customerId, Math.max(last.get(e.customerId) ?? 0, e.at));
  return ledger.customers().map((c) => ({
    id: c.id, name: c.name, aliases: c.aliases, balancePaise: ledger.balance(c.id), lastActivityAt: last.get(c.id) ?? null, reminderOptIn: ledger.consent(c.id),
  })).sort((a, b) => b.balancePaise - a.balancePaise || a.name.localeCompare(b.name));
}

export function todayTotals(ledger: Ledger, now: number): { credit: number; payment: number; people: number } {
  const from = startOfDayIst(now);
  const t = ledger.totalsBetween(from, from + 24 * 3600 * 1000 - 1);
  return { credit: t.creditPaise, payment: t.paymentPaise, people: t.customerCount };
}

/** Everything ever given on credit and everything ever paid back, over all customers. */
export function ledgerTotals(ledger: Ledger): { credit: number; payment: number } {
  let credit = 0;
  let payment = 0;
  for (const e of ledger.activeEntries()) {
    if (e.kind === 'credit') credit += e.paise;
    else payment += e.paise;
  }
  return { credit, payment };
}

/** Newest first by when the entry was recorded. `limit` caps how many; the history screen asks for many. */
export function feed(ledger: Ledger, now: number, limit = 20): FeedItem[] {
  const names = new Map(ledger.customers().map((c) => [c.id, c.name]));
  const entries = [...ledger.activeEntries()].sort((a, b) => b.recordedAt - a.recordedAt || (a.id < b.id ? 1 : -1)).slice(0, limit);
  return entries.map((e, i) => ({
    id: e.id, customerName: names.get(e.customerId) ?? '', kind: e.kind, paise: e.paise, at: e.at, recordedAt: e.recordedAt,
    undoableUntil: i === 0 && now - e.recordedAt < UNDO_MS ? e.recordedAt + UNDO_MS : null,
  }));
}

export function customerDetail(ledger: Ledger, id: string, now: number): CustomerDetailVM | null {
  const row = customerRows(ledger).find((c) => c.id === id);
  if (!row) return null;
  const gate = canRemind(ledger, id, now);
  const newest = ledger.lastEntry();
  return {
    customer: row,
    entries: ledger.activeEntries(id).sort((a, b) => b.at - a.at).map((e) => ({
      id: e.id, kind: e.kind, paise: e.paise, at: e.at, recordedAt: e.recordedAt, undoableUntil: newest?.id === e.id && now - e.recordedAt < UNDO_MS ? e.recordedAt + UNDO_MS : null,
    })),
    notes: ledger.notes(id).map((n) => ({ id: n.id, text: n.text, dueAt: n.dueAt ?? null })),
    canRemind: gate.ok,
    reminderBlockedReason: gate.ok ? null : gate.reason === 'unknown_customer' ? null : gate.reason,
  };
}
