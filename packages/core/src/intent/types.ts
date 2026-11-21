import type { KnownCustomer } from '../names/index.js';

export const INTENTS = ['credit_entry', 'payment', 'balance_query', 'customer_summary', 'correction', 'reminder_opt_in', 'note', 'refusal', 'out_of_scope'] as const;
/**
 * `INTENTS` is the list a language model may answer with. `edit_entry` is only ever produced by the deterministic
 * parser: an edit needs a named customer and a ledger lookup, so a model result is never allowed to start one.
 */
export type Intent = (typeof INTENTS)[number] | 'edit_entry';
export type RefusalKind = 'threat' | 'interest' | 'lending' | 'judgment';
export type EventTense = 'past' | 'future' | 'unknown';
/**
 * F8: change an older entry or a customer's total by voice. The customer is in `customerSpoken`, a day in `dateToken`,
 * and the new amount (or the target total) in `amountPaise`. All amounts come from the deterministic parser.
 */
export interface EditSpec {
  op: 'set_amount' | 'set_total' | 'remove' | 'flip' | 'refuse';
  /** Pick the entry that has this amount. */
  oldPaise?: number;
  /** Pick entries of this kind only. */
  kind?: 'credit' | 'payment';
  /** For `flip`: the kind the entry should become. Missing means the opposite of what it is. */
  to?: 'credit' | 'payment';
  /** Not said as an edit ("Mohan ka 500 nahi 300"): the engine reads it back before changing anything. */
  implicit?: boolean;
  /** Why an edit was refused, when the reason has its own spoken line. */
  reason?: 'advance';
}

export type Need = 'direction' | 'amount' | 'amount_confirm' | 'customer';

export interface ParsedEvent {
  intent: Intent;
  /** Integer paise, from the deterministic number parser. */
  amountPaise?: number;
  amountConfidence?: number;
  /** The name as spoken (any script). Resolved against the ledger later. */
  customerSpoken?: string;
  /** today, yesterday, tomorrow, day_before_yesterday, day_after_tomorrow, last_week, weekday:<name> */
  dateToken?: string;
  tense: EventTense;
  /** What the dialogue must ask before this event can be saved. Empty means it can be saved. */
  needs: Need[];
  refusal?: RefusalKind;
  /** "nahi nahi 430" inside the same utterance replaced the earlier amount. */
  selfCorrected?: boolean;
  /** For intent 'correction': what the shopkeeper asked to change. */
  correction?: { kind: 'undo' } | { kind: 'amount' } | { kind: 'customer' };
  /** For intent 'edit_entry'. */
  edit?: EditSpec;
  /** When an amount replaced an earlier one in the same sentence ("500 nahi 300"), the amount that was replaced. */
  priorAmountPaise?: number;
  /** For a correction that repeats the direction word ("nahi nahi 1500 udhaar hain"). */
  directionHint?: 'credit' | 'payment';
  /** True when the customer is a person already named earlier in this utterance. */
  customerInherited?: boolean;
  /** True when the utterance explicitly requests creating a new customer/khata. */
  isNewCustomer?: boolean;
  text: string;
}

export interface Interpretation {
  text: string;
  events: ParsedEvent[];
  /** The deterministic parser could not decide. Ask the LLM, or ask the shopkeeper to rephrase. */
  needsLlm: boolean;
}

export interface InterpretContext {
  customers?: KnownCustomer[];
  nowMs?: number;
}
