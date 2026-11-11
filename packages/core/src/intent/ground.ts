import { nameKey } from '../names/index.js';
import { parseAmount } from '../numbers/index.js';
import type { Interpretation, Intent, Need, ParsedEvent } from './types.js';
import { INTENTS } from './types.js';

const DATE_TOKENS = new Set(['today', 'yesterday', 'tomorrow', 'day_before_yesterday', 'day_after_tomorrow', 'last_week']);

interface RawLlm {
  intent?: unknown;
  amount?: unknown;
  customer?: unknown;
  date?: unknown;
  clarify?: unknown;
}

/**
 * Turns an LLM answer into events the dialogue may act on, treating the model as untrusted.
 * - The intent must be one we know. Anything else is dropped.
 * - **Every amount must be re-derivable from the transcript by `parseAmount`.** An amount the transcript does not
 *   contain is thrown away and the dialogue asks for it. The model can never invent or "fix" a number.
 * - The customer name must sound like a word that was actually said.
 * - Dates must be one of the fixed tokens.
 * Returns null when the answer is unusable.
 */
export function groundLlmOutput(raw: unknown, transcript: string): Interpretation | null {
  const items: unknown[] = Array.isArray(raw) ? raw : [raw];
  const spoken = parseAmount(transcript);
  const words = transcript.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  const events: ParsedEvent[] = [];

  for (const item of items.slice(0, 5)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as RawLlm;
    if (typeof r.intent !== 'string' || !(INTENTS as readonly string[]).includes(r.intent)) continue;
    const intent = r.intent as Intent;
    const ev: ParsedEvent = { intent, tense: 'unknown', needs: [], text: transcript.trim() };

    if (typeof r.amount === 'number' && Number.isFinite(r.amount) && r.amount > 0) {
      const paise = Math.round(r.amount * 100);
      const match = spoken.find((a) => a.paise === paise);
      if (match) {
        ev.amountPaise = paise;
        ev.amountConfidence = match.confidence;
      }
      // else: ungrounded, so no amount at all. The dialogue will ask.
    }
    if (typeof r.customer === 'string' && r.customer.trim()) {
      const key = nameKey(r.customer);
      const said = words.find((w) => nameKey(w) === key);
      if (key && said) ev.customerSpoken = said;
    }
    if (typeof r.date === 'string' && DATE_TOKENS.has(r.date)) ev.dateToken = r.date;
    if (intent === 'credit_entry' || intent === 'payment') {
      const needs: Need[] = [];
      if (ev.amountPaise === undefined) needs.push('amount');
      else if ((ev.amountConfidence ?? 1) < 0.75) needs.push('amount_confirm');
      if (!ev.customerSpoken) needs.push('customer');
      ev.needs = needs;
    }
    if (intent === 'correction') ev.correction = { kind: ev.amountPaise !== undefined ? 'amount' : ev.customerSpoken ? 'customer' : 'undo' };
    if (intent === 'refusal') ev.refusal = 'judgment';
    events.push(ev);
  }
  if (!events.length) return null;
  return { text: transcript, events, needsLlm: false };
}
