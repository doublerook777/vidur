import type { KnownCustomer } from '../names/index.js';

export const INTENTS = ['credit_entry', 'payment', 'balance_query', 'correction', 'reminder_opt_in', 'note', 'refusal', 'out_of_scope'] as const;
export type Intent = (typeof INTENTS)[number];
export type RefusalKind = 'threat' | 'interest' | 'lending' | 'judgment';
export type EventTense = 'past' | 'future' | 'unknown';
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
  /** True when the customer is a person already named earlier in this utterance. */
  customerInherited?: boolean;
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
