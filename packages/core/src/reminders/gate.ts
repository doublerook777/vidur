import type { Ledger } from '../ledger/index.js';

export const REMINDER_MIN_GAP_MS = 7 * 24 * 60 * 60 * 1000;

export type RemindDecision =
  | { ok: true }
  | { ok: false; reason: 'no_consent' | 'too_soon' | 'nothing_due' | 'unknown_customer' };

/**
 * The only place that decides whether a reminder may be prepared. A reminder needs:
 * the customer's opt-in recorded by the shopkeeper, a balance that is actually due, and at least 7 days
 * since the last one. Nothing is ever sent automatically: the shopkeeper shares the text themselves.
 */
export function canRemind(ledger: Ledger, customerId: string, nowMs: number): RemindDecision {
  if (!ledger.customer(customerId)) return { ok: false, reason: 'unknown_customer' };
  if (!ledger.consent(customerId)) return { ok: false, reason: 'no_consent' };
  if (ledger.balance(customerId) <= 0) return { ok: false, reason: 'nothing_due' };
  const last = ledger.lastReminderAt(customerId);
  if (last !== null && nowMs - last < REMINDER_MIN_GAP_MS) return { ok: false, reason: 'too_soon' };
  return { ok: true };
}
