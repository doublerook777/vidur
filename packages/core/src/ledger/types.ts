/**
 * Event-sourced ledger types. Money is always integer paise. No floats, ever.
 *
 * `at`        = epoch ms when the money moved (client/shopkeeper time; may be backdated).
 * `recordedAt`= epoch ms when the entry was logged (from the injected clock).
 */

export type LedgerEventType =
  | 'customer_created'
  | 'entry_posted'
  | 'entry_reversed'
  | 'note_added'
  | 'consent_set'
  | 'reminder_sent'
  | 'customer_alias_added'
  | 'customer_updated';

export interface CustomerCreatedEvent {
  type: 'customer_created';
  id: string;
  customerId: string;
  name: string;
  aliases: string[];
  /** Tells two customers with the same name apart, for example "dairy" in "Ramesh (dairy)". Optional so old events replay unchanged. */
  nickname?: string;
  /** Digits only, as the shopkeeper typed them (country code optional). Optional so old events replay unchanged. */
  phone?: string;
  recordedAt: number;
}

export type EntryKind = 'credit' | 'payment';
export type EntryReason = 'balance_set';

export interface EntryPostedEvent {
  type: 'entry_posted';
  id: string;
  customerId: string;
  kind: EntryKind;
  paise: number;
  /** epoch ms when the money moved */
  at: number;
  recordedAt: number;
  item?: string;
  /**
   * Set on the one entry that "set Anil's total to 1000" adds, so a balance adjustment is never mistaken for a
   * real sale or payment. Optional, so old events replay unchanged.
   */
  reason?: EntryReason;
}

/**
 * targetId may reference an `entry_posted` OR an earlier `entry_reversed`.
 * Reversing a reversal restores the entry it had reversed (undo of undo).
 */
export interface EntryReversedEvent {
  type: 'entry_reversed';
  id: string;
  targetId: string;
  recordedAt: number;
}

export interface NoteAddedEvent {
  type: 'note_added';
  id: string;
  customerId: string;
  text: string;
  dueAt?: number;
  recordedAt: number;
}

export interface ConsentSetEvent {
  type: 'consent_set';
  id: string;
  customerId: string;
  optIn: boolean;
  recordedAt: number;
}

export interface ReminderSentEvent {
  type: 'reminder_sent';
  id: string;
  customerId: string;
  recordedAt: number;
}

export interface CustomerAliasAddedEvent {
  type: 'customer_alias_added';
  id: string;
  customerId: string;
  alias: string;
  recordedAt: number;
}

/**
 * Edits a customer after creation. Only the fields present change; the latest event wins.
 * An empty string clears `nickname` or `phone`. `name` is never cleared.
 */
export interface CustomerUpdatedEvent {
  type: 'customer_updated';
  id: string;
  customerId: string;
  name?: string;
  nickname?: string;
  phone?: string;
  recordedAt: number;
}

export type LedgerEvent =
  | CustomerCreatedEvent
  | EntryPostedEvent
  | EntryReversedEvent
  | NoteAddedEvent
  | ConsentSetEvent
  | ReminderSentEvent
  | CustomerAliasAddedEvent
  | CustomerUpdatedEvent;

export interface LedgerStore {
  append(event: LedgerEvent): Promise<void>;
  all(): Promise<LedgerEvent[]>;
  clear(): Promise<void>;
}

export class MemoryStore implements LedgerStore {
  private events: LedgerEvent[] = [];

  async append(event: LedgerEvent): Promise<void> {
    this.events.push(event);
  }

  async all(): Promise<LedgerEvent[]> {
    return [...this.events];
  }

  async clear(): Promise<void> {
    this.events = [];
  }
}

export interface Customer {
  id: string;
  name: string;
  aliases: string[];
  nickname?: string;
  phone?: string;
}

export interface ActiveEntry {
  id: string;
  customerId: string;
  kind: EntryKind;
  paise: number;
  at: number;
  recordedAt: number;
  item?: string;
  reason?: EntryReason;
}

export interface Note {
  id: string;
  text: string;
  dueAt?: number;
  recordedAt: number;
}

export interface TotalsBetween {
  creditPaise: number;
  paymentPaise: number;
  /** distinct customers with at least one active entry whose `at` is in [fromMs, toMs] */
  customerCount: number;
}
