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
  | 'customer_alias_added';

export interface CustomerCreatedEvent {
  type: 'customer_created';
  id: string;
  customerId: string;
  name: string;
  aliases: string[];
  recordedAt: number;
}

export type EntryKind = 'credit' | 'payment';

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

export type LedgerEvent =
  | CustomerCreatedEvent
  | EntryPostedEvent
  | EntryReversedEvent
  | NoteAddedEvent
  | ConsentSetEvent
  | ReminderSentEvent
  | CustomerAliasAddedEvent;

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
}

export interface ActiveEntry {
  id: string;
  customerId: string;
  kind: EntryKind;
  paise: number;
  at: number;
  recordedAt: number;
  item?: string;
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
