import { addDaysIst, resolveDate, startOfDayIst } from '../dates/index.js';
import { say, type Key, type P, type SpeechLang } from '../i18n/index.js';
import { detectDirection, directionByShape, guessCustomerName, interpret, isOptInStatement, residualWords, yesNo } from '../intent/index.js';
import type { Interpretation, ParsedEvent } from '../intent/index.js';
import type { ActiveEntry, Ledger } from '../ledger/index.js';
import { aliasesFor, findByAlias, matchName, nameKey, type KnownCustomer } from '../names/index.js';
import { CONFIRM_BELOW, parseAmount } from '../numbers/index.js';
import { canRemind } from '../reminders/index.js';
import { amountToSpoken } from '../speak/index.js';

export const PENDING_TTL_MS = 60_000;

export interface ShareReminder {
  type: 'share_reminder';
  customerId: string;
  text: string;
}

/** One thing the agent says. `text` is final, fixed wording. */
export interface Reply {
  key: Key;
  text: string;
  lang: SpeechLang;
  /** A reminder for the shopkeeper to share themselves. Nothing is ever sent automatically. */
  action?: ShareReminder;
}

/** Optional fallback for what the deterministic parser can't read. Must return grounded events (see `groundLlmOutput`). */
export type LlmParser = (text: string, ctx: { customerNames: string[] }) => Promise<Interpretation | null>;

export interface DialogueOptions {
  ledger: Ledger;
  lang: SpeechLang;
  clock: () => number;
  llm?: LlmParser;
  /** An unanswered question is dropped after this long. Nothing awaiting an answer is ever saved. */
  pendingTtlMs?: number;
  /** "Galat" only removes an entry newer than this. */
  undoWindowMs?: number;
}

type Mode = 'entry' | 'note' | 'query' | 'summary' | 'reminder' | 'consent' | 'move' | 'replace_amount';

interface Work {
  mode: Mode;
  ev: ParsedEvent;
  rest: ParsedEvent[];
  customerId?: string;
  createName?: string;
  createNickname?: string;
  nearIds?: string[];
  candidates?: string[];
  replaceEntryId?: string;
  amountOk?: boolean;
  /** A correction that changed the direction too ("nahi, 500 jama"): speak the full result, not just "replaced". */
  flipped?: boolean;
  asked: number;
}

export type PendingKind =
  | 'direction'
  | 'amount'
  | 'confirm_amount'
  | 'which'
  | 'near'
  | 'customer'
  | 'consent'
  | 'new_customer'
  | 'nickname';
interface Pending {
  kind: PendingKind;
  expiresAt: number;
  work: Work;
}

const DAY = 24 * 60 * 60 * 1000;
const ORDINAL_FIRST = /^(pehla|pehle|pahla|pahle|first|1|one|पहला|पहले|ಮೊದಲ|ಮೊದಲನೆ)/i;
const ORDINAL_SECOND = /^(doosra|dusra|doosre|dusre|second|2|two|दूसरा|दूसरे|ಎರಡನೆ|ಎರಡನೇ)/i;

const SKIP_WORDS = new Set([
  'skip', 'chhod', 'chhodo', 'chhodie', 'chhod_do', 'chod', 'chodiye', 'bittubidi',
  'छोड़', 'छोड़िए', 'छोड़ो', 'चोड़', 'चोड़दो', 'चोड़ दो', 'छोड़ दो', 'ಬಿಟ್ಟುಬಿಡಿ', 'ಬಿಡು', 'ಬೇಡ',
]);

function isSkip(text: string): boolean {
  const normText = text.trim().toLowerCase();
  if (SKIP_WORDS.has(normText)) return true;
  const words = text.split(/\s+/).map((w) => w.toLowerCase());
  return words.some((w) => SKIP_WORDS.has(w));
}

function extractNickname(text: string, baseName?: string): string | undefined {
  let t = text.trim();
  if (!t) return undefined;
  if (baseName) {
    const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${escaped}\\s+(?:ka\\s+|ki\\s+|ke\\s+)?`, 'iu');
    t = t.replace(re, '').trim();
  }
  t = t.replace(/^(?:nickname|उपनाम|निकनेम)\s+/iu, '').trim();
  return t.length > 0 ? t : undefined;
}

export class Dialogue {
  private disclosed = false;
  private pending: Pending | null = null;
  private readonly o: Required<Pick<DialogueOptions, 'pendingTtlMs' | 'undoWindowMs'>> & DialogueOptions;

  constructor(options: DialogueOptions) {
    this.o = { pendingTtlMs: PENDING_TTL_MS, undoWindowMs: 15 * 60_000, ...options };
  }

  get lang(): SpeechLang {
    return this.o.lang;
  }
  /** Drops the open question without saving anything. Returns what to show. */
  cancelPending(): Reply[] {
    if (!this.pending) return [];
    this.pending = null;
    return [this.r('dropped_pending')];
  }

  hasPending(): boolean {
    return this.pending !== null;
  }
  /** What the open question is about, so a screen can offer Yes and No buttons for the yes/no kinds. */
  pendingKind(): PendingKind | null {
    return this.pending?.kind ?? null;
  }

  pendingExpiresAt(): number | null {
    return this.pending?.expiresAt ?? null;
  }

  pendingWindowMs(): number {
    return this.o.pendingTtlMs;
  }

  /**
   * Called when the TTS audio for the open question has finished playing.
   * Resets the TTL clock from this moment so long speech does not eat the answer window.
   */
  questionSpoken(): void {
    if (this.pending) {
      this.pending.expiresAt = this.o.clock() + this.o.pendingTtlMs;
    }
  }

  /** The first thing the agent says in a session. */
  start(): Reply[] {
    return this.emit([]);
  }

  /**
   * Speaks and returns the customer summary for a given customer id.
   * Programmatic invocation for Member B's "Hear summary" button.
   */
  summaryFor(customerId: string): Reply[] {
    const customer = this.o.ledger.customer(customerId);
    if (!customer) return this.emit([this.r('unknown_customer', { name: customerId })]);
    const w: Work = {
      mode: 'summary',
      customerId,
      ev: { intent: 'customer_summary', text: '', tense: 'unknown', needs: [] },
      rest: [],
      asked: 0,
    };
    return this.emit(this.summaryReply(w));
  }

  /** The shopkeeper talked over the agent. Whatever was being asked stays open until it expires. */
  interrupt(): void {
    // Playback is stopped by the caller. The question, if any, remains pending.
  }

  /**
   * Every reply goes through here, so no path can speak before the AI disclosure has been said.
   */
  private emit(replies: Reply[]): Reply[] {
    if (this.disclosed) return replies;
    this.disclosed = true;
    return [this.r('disclosure'), ...replies];
  }

  private r(key: Key, p: P = {}, action?: ShareReminder): Reply {
    const reply: Reply = { key, text: say(this.o.lang, key, p), lang: this.o.lang };
    if (action) reply.action = action;
    return reply;
  }

  private money(paise: number): string {
    try {
      return amountToSpoken(paise, this.o.lang, 'digits');
    } catch {
      return `₹${(paise / 100).toFixed(2)}`;
    }
  }

  private when(token: string | undefined): string | undefined {
    switch (token) {
      case 'today': return say(this.o.lang, 'when_today');
      case 'yesterday': return say(this.o.lang, 'when_yesterday');
      case 'tomorrow': return say(this.o.lang, 'when_tomorrow');
      case 'day_before_yesterday': return say(this.o.lang, 'when_day_before');
      case 'day_after_tomorrow': return say(this.o.lang, 'when_day_after');
      case 'last_week': return say(this.o.lang, 'when_last_week');
      default: return token?.startsWith('weekday:') ? token.slice(8) : undefined;
    }
  }

  private dayStart(token: string | undefined, now: number): number | undefined {
    const today = startOfDayIst(now);
    switch (token) {
      case 'today': return today;
      case 'yesterday': return addDaysIst(today, -1);
      case 'tomorrow': return addDaysIst(today, 1);
      case 'day_before_yesterday': return addDaysIst(today, -2);
      case 'day_after_tomorrow': return addDaysIst(today, 2);
      case 'last_week': return addDaysIst(today, -7);
      default: {
        if (token?.startsWith('weekday:')) {
          const r = resolveDate(token.slice(8), 'past', now);
          return r.kind === 'resolved' ? r.dayStartMs : undefined;
        }
        return undefined;
      }
    }
  }

  // ---------------------------------------------------------------- entry point

  async handle(text: string): Promise<Reply[]> {
    const now = this.o.clock();
    const t = text.trim();
    const out: Reply[] = [];
    if (this.pending && now > this.pending.expiresAt) {
      this.pending = null;
      out.push(this.r('pending_expired'));
    }
    if (!t) return this.emit([...out, this.r('didnt_catch')]);

    if (this.pending) {
      const answered = await this.tryAnswer(this.pending, t);
      if (answered) return this.emit([...out, ...answered]);
      // Not an answer: a new command. Whatever was being asked is dropped, never saved.
      this.pending = null;
      out.push(this.r('dropped_pending'));
    }
    return this.emit([...out, ...(await this.fresh(t))]);
  }

  private async fresh(text: string): Promise<Reply[]> {
    let it = interpret(text, { nowMs: this.o.clock(), customers: this.o.ledger.customers() });
    if (it.needsLlm && this.o.llm) {
      const viaLlm = await this.o.llm(text, { customerNames: this.o.ledger.customers().map((c) => c.name) }).catch(() => null);
      if (viaLlm && viaLlm.events.length) it = viaLlm;
    }
    if (!it.events.length) return [this.r('didnt_catch')];
    return this.runEvents(it.events);
  }

  private async runEvents(events: ParsedEvent[]): Promise<Reply[]> {
    const out: Reply[] = [];
    const queue = [...events];
    while (queue.length) {
      const ev = queue.shift()!;
      const w = this.workFor(ev, queue.splice(0));
      const rs = await this.step(w);
      out.push(...rs);
      if (this.pending) break; // the rest waits inside the pending work
      queue.push(...w.rest);
    }
    return out;
  }

  private workFor(ev: ParsedEvent, rest: ParsedEvent[]): Work {
    const mode: Mode =
      ev.intent === 'credit_entry' || ev.intent === 'payment'
        ? 'entry'
        : ev.intent === 'note'
          ? 'note'
          : ev.intent === 'balance_query'
            ? 'query'
            : ev.intent === 'customer_summary'
              ? 'summary'
              : ev.intent === 'reminder_opt_in'
                ? isOptInStatement(ev.text)
                  ? 'consent'
                  : 'reminder'
                : 'entry';
    return { mode, ev, rest, asked: 0 };
  }

  // ---------------------------------------------------------------- stepping one event

  /** Advances one event as far as it can go. Either it finishes, or it sets `this.pending` and asks. */
  private async step(w: Work): Promise<Reply[]> {
    const ev = w.ev;
    const L = this.o.ledger;

    switch (ev.intent) {
      case 'refusal':
        return [this.r(ev.refusal === 'threat' ? 'refuse_threat' : ev.refusal === 'judgment' ? 'refuse_judgment' : 'refuse_loan')];
      case 'out_of_scope':
        return [this.r('out_of_scope')];
      case 'correction':
        return this.correction(w);
      default:
        break;
    }

    // Everything below needs a customer, except a day-total query.
    if (w.mode === 'query' && !ev.customerSpoken && !w.customerId) return this.dayTotals(ev);

    const resolved = this.resolveCustomer(w);
    if (resolved) return resolved;

    if (w.mode === 'query') return this.balanceReply(w);
    if (w.mode === 'summary') return this.summaryReply(w);
    if (w.mode === 'consent') {
      await L.setConsent(w.customerId!, true);
      return [this.r('consent_saved', { name: this.nameOf(w) })];
    }
    if (w.mode === 'reminder') return this.reminder(w);

    // Entries and notes
    if (w.mode === 'note') return this.saveNote(w);

    if (ev.needs.includes('direction') && !w.replaceEntryId) {
      if (w.ev.isNewCustomer && ev.amountPaise === undefined) {
        return this.commitCustomerOnly(w);
      }
      return this.ask(w, 'direction', this.r('ask_direction'));
    }
    if (ev.amountPaise === undefined) {
      if (w.ev.isNewCustomer) {
        return this.commitCustomerOnly(w);
      }
      return this.ask(w, 'amount', this.r('ask_amount'));
    }
    if (!w.amountOk && (ev.needs.includes('amount_confirm') || (ev.amountConfidence ?? 1) < CONFIRM_BELOW)) {
      return this.ask(w, 'confirm_amount', this.r('confirm_amount', { amount: this.money(ev.amountPaise) }));
    }
    return this.commitEntry(w);
  }

  private ask(w: Work, kind: PendingKind, reply: Reply): Reply[] {
    this.pending = { kind, expiresAt: this.o.clock() + this.o.pendingTtlMs, work: w };
    return [reply];
  }

  private nameOf(w: Work): string {
    if (w.customerId) return this.o.ledger.customer(w.customerId)?.name ?? w.ev.customerSpoken ?? '';
    return w.createName ?? w.ev.customerSpoken ?? '';
  }

  /** Returns replies when it has to ask or stop; undefined when `w.customerId` or `w.createName` is settled. */
  private resolveCustomer(w: Work): Reply[] | undefined {
    if (w.customerId || w.createName) return undefined;
    const spoken = w.ev.customerSpoken;
    if (!spoken) {
      if (w.mode === 'query' || w.mode === 'summary' || w.mode === 'reminder' || w.mode === 'consent' || w.mode === 'note' || w.mode === 'entry' || w.mode === 'move') return this.ask(w, 'customer', this.r('ask_customer'));
      return undefined;
    }
    const customers = this.o.ledger.customers();
    const m = matchName(spoken, customers, w.ev.text);
    if (m.kind === 'exact') {
      if (w.ev.isNewCustomer) {
        w.createName = spoken;
        return this.ask(w, 'nickname', this.r('ask_nickname', { name: spoken }));
      }
      w.customerId = m.customerId;
      return undefined;
    }
    if (m.kind === 'ambiguous') {
      if (w.ev.isNewCustomer) {
        w.createName = spoken;
        return this.ask(w, 'nickname', this.r('ask_nickname', { name: spoken }));
      }
      w.candidates = m.customerIds;
      const options = this.formatAmbiguousOptions(m.customerIds, customers);
      if (options) {
        return this.ask(w, 'which', this.r('ask_which', { name: spoken, options }));
      }
      return this.ask(w, 'which', this.r('ask_which_ordinal', { name: spoken }));
    }
    if (m.kind === 'near') {
      w.nearIds = m.customerIds;
      const name = customers.find((c) => c.id === m.customerIds[0])?.name ?? spoken;
      return this.ask(w, 'near', this.r('confirm_near', { name }));
    }
    // A new name. Nothing is ever created without the shopkeeper saying yes: a misheard word must not become a khata.
    if (w.mode === 'query' || w.mode === 'summary' || w.mode === 'reminder' || w.mode === 'consent') return [this.r('unknown_customer', { name: spoken })];
    return this.ask(w, 'new_customer', this.r('confirm_new_customer', { name: spoken }));
  }

  private formatAmbiguousOptions(candidateIds: string[], customers: KnownCustomer[]): string | undefined {
    const labels = candidateIds.map((id) => {
      const c = customers.find((cust) => cust.id === id);
      if (!c) return undefined;
      if (c.nickname) return `${c.name} ${c.nickname}`;
      const alias = aliasesFor(c.aliases, this.o.lang)[0];
      return alias ?? undefined;
    });
    if (labels.every((l): l is string => !!l)) {
      const joiner = ` ${say(this.o.lang, 'or')} `;
      return labels.join(joiner);
    }
    return undefined;
  }

  // ---------------------------------------------------------------- actions

  private async commitCustomerOnly(w: Work): Promise<Reply[]> {
    const L = this.o.ledger;
    if (w.createName) {
      const aliases = w.createNickname ? [w.createNickname] : [];
      const c = await L.createCustomer(w.createName, aliases, w.createNickname ? { nickname: w.createNickname } : undefined);
      w.customerId = c.id;
      return [this.r('new_customer', { name: c.nickname ? `${c.name} ${c.nickname}` : c.name })];
    }
    return [this.r('didnt_catch')];
  }

  private async commitEntry(w: Work): Promise<Reply[]> {
    const L = this.o.ledger;
    const ev = w.ev;
    const out: Reply[] = [];
    let customerId = w.customerId;
    if (!customerId && w.createName) {
      const aliases = w.createNickname ? [w.createNickname] : [];
      const c = await L.createCustomer(w.createName, aliases, w.createNickname ? { nickname: w.createNickname } : undefined);
      customerId = c.id;
      out.push(this.r('new_customer', { name: c.nickname ? `${c.name} ${c.nickname}` : c.name }));
    }
    if (!customerId) return [this.r('didnt_catch')];
    const kind = ev.intent === 'payment' ? 'payment' : 'credit';
    const now = this.o.clock();
    const dayStart = this.dayStart(ev.dateToken, now);
    const at = dayStart !== undefined && ev.dateToken !== 'today' ? dayStart + 12 * 60 * 60 * 1000 : now;
    if (w.replaceEntryId) await L.reverse(w.replaceEntryId);
    await L.postEntry({ customerId, kind, paise: ev.amountPaise!, at });
    const name = L.customer(customerId)?.name ?? '';
    const amount = this.money(ev.amountPaise!);
    const when = ev.dateToken && ev.dateToken !== 'today' ? this.when(ev.dateToken) : undefined;
    const bal = L.balance(customerId);
    if (w.replaceEntryId && w.mode === 'move') out.push(this.r('moved', { name }));
    else if (w.replaceEntryId && !w.flipped) out.push(this.r('replaced', { amount }));
    else if (kind === 'credit' && bal === 0) out.push(this.r('credit_saved_even', { name, amount, when: when ?? '' }));
    else if (kind === 'credit' && bal < 0) out.push(this.r('credit_saved_advance', { name, amount, advance: this.money(-bal), when: when ?? '' }));
    else if (kind === 'credit') out.push(this.r(when ? 'credit_saved_dated' : 'credit_saved', { name, amount, balance: this.money(bal), when: when ?? '' }));
    else if (bal === 0) out.push(this.r('payment_cleared', { name, amount }));
    else if (bal < 0) out.push(this.r('payment_advance', { name, amount, advance: this.money(-bal) }));
    else out.push(this.r(when ? 'payment_saved_dated' : 'payment_saved', { name, amount, balance: this.money(bal), when: when ?? '' }));
    return out;
  }

  private async saveNote(w: Work): Promise<Reply[]> {
    const L = this.o.ledger;
    const ev = w.ev;
    const out: Reply[] = [];
    let customerId = w.customerId;
    if (!customerId && w.createName) {
      const aliases = w.createNickname ? [w.createNickname] : [];
      const c = await L.createCustomer(w.createName, aliases, w.createNickname ? { nickname: w.createNickname } : undefined);
      customerId = c.id;
      out.push(this.r('new_customer', { name: c.nickname ? `${c.name} ${c.nickname}` : c.name }));
    }
    if (!customerId) return [this.r('didnt_catch')];
    const due = this.dayStart(ev.dateToken, this.o.clock());
    await L.addNote(customerId, ev.text, due);
    const when = this.when(ev.dateToken);
    if (ev.amountPaise !== undefined && when) out.push(this.r('note_saved', { when, amount: this.money(ev.amountPaise) }));
    else out.push(this.r('note_saved_plain'));
    return out;
  }

  private howLongAgo(entryTime: number, now: number): string {
    const today = startOfDayIst(now);
    const entryDay = startOfDayIst(entryTime);
    const diffDays = Math.max(0, Math.round((today - entryDay) / 86_400_000));
    if (diffDays === 0) return say(this.o.lang, 'when_today');
    if (diffDays === 1) return say(this.o.lang, 'when_yesterday');
    if (diffDays === 2) return say(this.o.lang, 'when_day_before');
    return say(this.o.lang, 'days_ago', { count: String(diffDays) });
  }

  private summaryReply(w: Work): Reply[] {
    const L = this.o.ledger;
    const id = w.customerId!;
    const name = L.customer(id)?.name ?? '';
    const entries = L.activeEntries(id);
    if (!entries.length) {
      return [this.r('customer_summary_none', { name })];
    }
    let last: ActiveEntry | null = null;
    for (const e of entries) {
      if (!last || e.recordedAt >= last.recordedAt) last = e;
    }
    const now = this.o.clock();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const count30 = String(entries.filter((e) => e.at >= thirtyDaysAgo).length);
    const kind = say(this.o.lang, last!.kind === 'credit' ? 'entry_kind_credit' : 'entry_kind_payment');
    const amount = this.money(last!.paise);
    const when = this.howLongAgo(last!.at, now);
    const bal = L.balance(id);

    if (bal > 0) {
      return [this.r('summary_customer', { name, balance: this.money(bal), kind, amount, when, count: count30 })];
    }
    if (bal < 0) {
      return [this.r('summary_advance', { name, advance: this.money(-bal), kind, amount, when, count: count30 })];
    }
    return [this.r('summary_settled', { name, kind, amount, when, count: count30 })];
  }

  private balanceReply(w: Work): Reply[] {
    const L = this.o.ledger;
    const id = w.customerId!;
    const name = L.customer(id)?.name ?? '';
    const bal = L.balance(id);
    return [bal > 0 ? this.r('balance_customer', { name, balance: this.money(bal) }) : bal < 0 ? this.r('balance_advance', { name, advance: this.money(-bal) }) : this.r('balance_zero', { name })];
  }

  private dayTotals(ev: ParsedEvent): Reply[] {
    const now = this.o.clock();
    const token = ev.dateToken ?? 'today';
    const from = this.dayStart(token, now) ?? startOfDayIst(now);
    const t = this.o.ledger.totalsBetween(from, from + DAY - 1);
    const when = this.when(token) ?? say(this.o.lang, 'when_today');
    if (t.creditPaise <= 0) return [this.r('balance_day_none', { when })];
    return [this.r('balance_day', { when, credit: this.money(t.creditPaise), count: String(t.customerCount) })];
  }

  private async reminder(w: Work): Promise<Reply[]> {
    const L = this.o.ledger;
    const id = w.customerId!;
    const name = L.customer(id)?.name ?? '';
    const now = this.o.clock();
    const gate = canRemind(L, id, now);
    if (!gate.ok) {
      if (gate.reason === 'no_consent') return this.ask(w, 'consent', this.r('consent_ask', { name }));
      if (gate.reason === 'too_soon') return [this.r('reminder_too_soon', { name })];
      if (gate.reason === 'nothing_due') return [this.r('balance_zero', { name })];
      return [this.r('unknown_customer', { name })];
    }
    const text = say(this.o.lang, 'reminder_text', { name, amount: this.money(L.balance(id)) });
    await L.recordReminder(id);
    return [this.r('reminder_ready', { name }, { type: 'share_reminder', customerId: id, text })];
  }

  private async correction(w: Work): Promise<Reply[]> {
    const L = this.o.ledger;
    const ev = w.ev;
    const last = L.lastEntry();
    if (!last) return [this.r('nothing_to_undo')];
    if (this.o.clock() - last.recordedAt > this.o.undoWindowMs) return [this.r('undo_too_old')];
    const kind = ev.correction?.kind ?? 'undo';
    if (kind === 'undo') {
      await L.reverse(last.id);
      return [this.r('undone')];
    }
    if (kind === 'amount') {
      if (ev.amountPaise === undefined) return this.ask({ ...w, mode: 'replace_amount' }, 'amount', this.r('ask_amount'));
      const kindNow = ev.directionHint ?? last.kind;
      const nw: Work = {
        mode: 'replace_amount', rest: w.rest, asked: 0, replaceEntryId: last.id, customerId: last.customerId,
        ev: { ...ev, intent: kindNow === 'payment' ? 'payment' : 'credit_entry', needs: [], dateToken: undefined },
        ...(kindNow !== last.kind ? { flipped: true } : {}),
      };
      if ((ev.amountConfidence ?? 1) < CONFIRM_BELOW) return this.ask(nw, 'confirm_amount', this.r('confirm_amount', { amount: this.money(ev.amountPaise) }));
      return this.commitEntry(nw);
    }
    // move to another customer
    const nw: Work = {
      mode: 'move', rest: w.rest, asked: 0, replaceEntryId: last.id,
      ev: { ...ev, intent: last.kind === 'payment' ? 'payment' : 'credit_entry', amountPaise: last.paise, amountConfidence: 1, needs: [], dateToken: undefined },
    };
    const resolved = this.resolveCustomer(nw);
    if (resolved) return resolved;
    return this.commitEntry(nw);
  }

  // ---------------------------------------------------------------- answers to questions

  /** Handles a reply to the open question. Returns undefined when the text is not an answer. */
  private async tryAnswer(p: Pending, text: string): Promise<Reply[] | undefined> {
    const w = p.work;
    const clear = (): void => {
      this.pending = null;
    };
    const proceed = async (): Promise<Reply[]> => {
      clear();
      const rs = await this.step(w);
      if (!this.pending) rs.push(...(await this.runEvents(w.rest)));
      return rs;
    };

    // A complete new entry, or a plain "cancel", is never an answer.
    const peek = interpret(text, { nowMs: this.o.clock(), customers: this.o.ledger.customers() }).events[0];
    if (peek) {
      const full = (peek.intent === 'credit_entry' || peek.intent === 'payment') && peek.customerSpoken && peek.amountPaise !== undefined && !peek.needs.includes('direction') && residualWords(text) >= 2;
      if (full) return undefined;
      const yesNoKind = p.kind === 'confirm_amount' || p.kind === 'near' || p.kind === 'consent' || p.kind === 'new_customer' || p.kind === 'nickname';
      if (!yesNoKind && peek.intent === 'correction' && peek.correction?.kind === 'undo') {
        clear();
        return [this.r('dropped_pending')];
      }
      if (peek.intent === 'refusal') {
        clear();
        return this.step(this.workFor(peek, []));
      }
    }

    switch (p.kind) {
      case 'direction': {
        const d = detectDirection(text) ?? directionByShape(text);
        if (!d) return undefined;
        w.ev = { ...w.ev, intent: d === 'payment' ? 'payment' : 'credit_entry', needs: w.ev.needs.filter((n) => n !== 'direction') };
        return proceed();
      }
      case 'amount': {
        const amounts = parseAmount(text);
        if (amounts.length !== 1 || residualWords(text) > 1) return undefined;
        const a = amounts[0]!;
        w.ev = { ...w.ev, amountPaise: a.paise, amountConfidence: a.confidence, needs: w.ev.needs.filter((n) => n !== 'amount' && n !== 'amount_confirm') };
        // The shopkeeper just said only the number, so a clear one is accepted; an unclear one is read back.
        w.amountOk = a.confidence >= CONFIRM_BELOW;
        return proceed();
      }
      case 'confirm_amount': {
        const yn = yesNo(text);
        const amounts = parseAmount(text);
        if (amounts.length === 1 && residualWords(text) <= 1 && yn !== 'yes') {
          const a = amounts[0]!;
          w.ev = { ...w.ev, amountPaise: a.paise, amountConfidence: a.confidence };
          w.amountOk = a.confidence >= CONFIRM_BELOW;
          return proceed();
        }
        if (yn === 'yes') {
          w.amountOk = true;
          return proceed();
        }
        if (yn === 'no') {
          w.ev = { ...w.ev, amountPaise: undefined };
          clear();
          return this.ask(w, 'amount', this.r('ask_amount'));
        }
        return undefined;
      }
      case 'which': {
        const customers = this.o.ledger.customers();
        const cands = (w.candidates ?? []).map((id) => customers.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
        const byAlias = findByAlias(text, cands);
        let pick = byAlias.length === 1 ? byAlias[0] : undefined;
        const first = text.trim();
        if (!pick && ORDINAL_FIRST.test(first)) pick = cands[0];
        if (!pick && ORDINAL_SECOND.test(first)) pick = cands[1];
        if (!pick) {
          w.asked += 1;
          if (w.asked >= 2) {
            clear();
            return [this.r('didnt_catch'), this.r('dropped_pending')];
          }
          return this.reask(p);
        }
        w.customerId = pick.id;
        return proceed();
      }
      case 'near': {
        const yn = yesNo(text);
        if (yn === 'yes') {
          w.customerId = w.nearIds?.[0];
          return proceed();
        }
        if (yn === 'no') {
          // Not that one: it is a new name. Still asks before creating it.
          return this.askCreate(w);
        }
        return undefined;
      }
      case 'new_customer': {
        const yn = yesNo(text);
        if (yn === 'yes') {
          const createName = w.ev.customerSpoken;
          w.createName = createName;
          const customers = this.o.ledger.customers();
          const alreadyExists = createName && customers.some((c) => nameKey(c.name) === nameKey(createName));
          if (alreadyExists) {
            clear();
            return this.ask(w, 'nickname', this.r('ask_nickname', { name: createName }));
          }
          return proceed();
        }
        if (yn === 'no') {
          // "No, Mohan": the shopkeeper named the right person. Otherwise ask whose account it is. Nothing is saved yet.
          const name = guessCustomerName(text);
          clear();
          if (name && residualWords(text) <= 2) {
            w.ev = { ...w.ev, customerSpoken: name, needs: w.ev.needs.filter((n) => n !== 'customer') };
            return proceed();
          }
          w.ev = { ...w.ev, customerSpoken: undefined, needs: [...w.ev.needs.filter((n) => n !== 'customer'), 'customer'] };
          return this.ask(w, 'customer', this.r('ask_customer'));
        }
        return undefined;
      }
      case 'nickname': {
        const yn = yesNo(text);
        const skip = isSkip(text) || yn === 'no';
        if (skip) {
          w.createNickname = undefined;
          return proceed();
        }
        const nick = extractNickname(text, w.createName);
        if (!nick) {
          w.asked += 1;
          if (w.asked >= 2) {
            clear();
            return [this.r('didnt_catch'), this.r('dropped_pending')];
          }
          return this.reaskNickname(p);
        }
        const createName = w.createName ?? w.ev.customerSpoken ?? '';
        const sameNameCustomers = this.o.ledger.customers().filter((c) => nameKey(c.name) === nameKey(createName));
        const nickKey = nameKey(nick);
        const nickTaken = sameNameCustomers.some((c) => c.nickname && nameKey(c.nickname) === nickKey);
        if (nickTaken) {
          w.asked += 1;
          if (w.asked >= 2) {
            clear();
            return [this.r('didnt_catch'), this.r('dropped_pending')];
          }
          return this.reaskNickname(p);
        }
        w.createNickname = nick;
        return proceed();
      }
      case 'customer': {
        const name = guessCustomerName(text);
        if (!name || residualWords(text) > 2) return undefined;
        w.ev = { ...w.ev, customerSpoken: name, needs: w.ev.needs.filter((n) => n !== 'customer') };
        return proceed();
      }
      case 'consent': {
        const yn = yesNo(text);
        if (yn === 'yes') {
          await this.o.ledger.setConsent(w.customerId!, true);
          return proceed();
        }
        if (yn === 'no') {
          clear();
          return [this.r('consent_declined', { name: this.nameOf(w) })];
        }
        return undefined;
      }
    }
  }

  private askCreate(w: Work): Reply[] {
    this.pending = null;
    return this.ask(w, 'new_customer', this.r('confirm_new_customer', { name: w.ev.customerSpoken ?? '' }));
  }

  private reaskNickname(p: Pending): Reply[] {
    p.expiresAt = this.o.clock() + this.o.pendingTtlMs;
    const name = p.work.createName ?? p.work.ev.customerSpoken ?? '';
    return [this.r('ask_nickname', { name })];
  }

  private reask(p: Pending): Reply[] {
    const w = p.work;
    const customers = this.o.ledger.customers();
    p.expiresAt = this.o.clock() + this.o.pendingTtlMs;
    const options = this.formatAmbiguousOptions(w.candidates ?? [], customers);
    if (options) {
      return [this.r('ask_which', { name: w.ev.customerSpoken ?? '', options })];
    }
    return [this.r('ask_which_ordinal', { name: w.ev.customerSpoken ?? '' })];
  }
}
