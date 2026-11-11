/**
 * Schema for the golden utterance set (eval/golden/utterances.jsonl).
 *
 * Each line is one JSON object:
 *   { id, lang, text, expected: { intent, amount?, customer?, item?, date?, clarify? } }
 *
 * Conventions:
 * - amount: integer RUPEES (e.g. 340 = ₹340). Optional; omit when the utterance
 *   carries no amount or the amount is undetermined.
 * - customer: synthetic display name only (e.g. "Ramesh", "Sunita", "Kavya").
 *   Never a real person, never a phone number.
 * - item: free-text goods mentioned (e.g. "atta", "rice", "sugar").
 * - date: relative token, one of "today" | "yesterday" | "tomorrow" |
 *   "day_after_tomorrow" | "last_week" | "weekday:<lowercase-english-weekday>".
 * - clarify: true when the utterance is ambiguous and a short spoken
 *   clarification question is the CORRECT outcome (e.g. two same-name
 *   customers, missing direction, very low confidence amount).
 * - intent names follow docs/PLAN.md section 1.4 (conversation behaviour) and
 *   the F2–F11 feature list. The plan has no closed intent enum; these names
 *   are the canonical ones used by the golden set:
 *     credit_entry     – udhaar/baaki/"X ko diya", goods taken on credit
 *     payment          – jama/wapas/chukaya/paid, "X ne diya"
 *     balance_query    – "Aaj kitna udhaar gaya?", "Ramesh ka total?"
 *     correction       – replacement/undo of the last entry ("Nahi, 430", "Galat")
 *     reminder_opt_in  – opt-in polite reminder request
 *     note             – future promise, saved as a note, never posted ("kal 500 dega")
 *     refusal          – threats, lending, interest, credit judgments
 *     out_of_scope     – anything the product does not do
 */

export const LANGS = ['hi', 'en', 'kn', 'hinglish'] as const;
export type Lang = (typeof LANGS)[number];

export const INTENTS = [
  'credit_entry',
  'payment',
  'balance_query',
  'correction',
  'reminder_opt_in',
  'note',
  'refusal',
  'out_of_scope',
] as const;
export type Intent = (typeof INTENTS)[number];

export const DATE_TOKENS = [
  'today',
  'yesterday',
  'tomorrow',
  'day_after_tomorrow',
  'last_week',
] as const;

export interface Expected {
  intent: Intent;
  amount?: number;
  customer?: string;
  item?: string;
  date?: string;
  clarify?: boolean;
}

export interface GoldenUtterance {
  id: string;
  lang: Lang;
  text: string;
  expected: Expected;
}

const ID_RE = /^G-(HI|EN|KN|HL)-\d{3}$/;
const WEEKDAY_RE = /^weekday:(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateUtterance(value: unknown, lineNo?: number): ValidationResult {
  const errors: string[] = [];
  const where = lineNo !== undefined ? `line ${lineNo}: ` : '';
  const fail = (msg: string) => errors.push(where + msg);

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, errors: [where + 'entry must be a JSON object'] };
  }
  const e = value as Record<string, unknown>;

  // top-level keys
  for (const key of Object.keys(e)) {
    if (!['id', 'lang', 'text', 'expected'].includes(key)) fail(`unknown top-level key "${key}"`);
  }

  // id
  if (typeof e.id !== 'string' || !ID_RE.test(e.id)) {
    fail(`id must match ${ID_RE}, got ${JSON.stringify(e.id)}`);
  }

  // lang
  if (typeof e.lang !== 'string' || !(LANGS as readonly string[]).includes(e.lang)) {
    fail(`lang must be one of ${LANGS.join('|')}, got ${JSON.stringify(e.lang)}`);
  }

  // text
  if (typeof e.text !== 'string' || e.text.trim().length === 0) {
    fail('text must be a non-empty string');
  } else {
    if (/\d{6,}/.test(e.text.replace(/[,\s]/g, ''))) {
      // allow amounts up to lakhs; a bare 10+ digit run looks like a phone number
      if (/(?:\+?91[\s-]?)?[6-9]\d{9}/.test(e.text)) fail('text appears to contain a phone number');
    }
  }

  // expected
  if (typeof e.expected !== 'object' || e.expected === null || Array.isArray(e.expected)) {
    fail('expected must be an object');
  } else {
    const x = e.expected as Record<string, unknown>;
    for (const key of Object.keys(x)) {
      if (!['intent', 'amount', 'customer', 'item', 'date', 'clarify'].includes(key)) {
        fail(`unknown expected key "${key}"`);
      }
    }
    if (typeof x.intent !== 'string' || !(INTENTS as readonly string[]).includes(x.intent)) {
      fail(`intent must be one of ${INTENTS.join('|')}, got ${JSON.stringify(x.intent)}`);
    }
    if (x.amount !== undefined) {
      if (typeof x.amount !== 'number' || !Number.isInteger(x.amount) || x.amount < 0) {
        fail(`amount must be a non-negative integer (rupees), got ${JSON.stringify(x.amount)}`);
      }
    }
    if (x.customer !== undefined && (typeof x.customer !== 'string' || x.customer.trim().length === 0)) {
      fail('customer must be a non-empty string');
    }
    if (typeof x.customer === 'string' && /\d{6,}/.test(x.customer)) {
      fail('customer must not contain digits');
    }
    if (x.item !== undefined && (typeof x.item !== 'string' || x.item.trim().length === 0)) {
      fail('item must be a non-empty string');
    }
    if (x.date !== undefined) {
      const ok =
        typeof x.date === 'string' &&
        ((DATE_TOKENS as readonly string[]).includes(x.date) || WEEKDAY_RE.test(x.date));
      if (!ok) fail(`date must be a relative token (${DATE_TOKENS.join('|')}|weekday:<name>), got ${JSON.stringify(x.date)}`);
    }
    if (x.clarify !== undefined && typeof x.clarify !== 'boolean') {
      fail('clarify must be a boolean');
    }
    // cross-field sanity: refusals and out_of_scope carry no amount
    if ((x.intent === 'refusal' || x.intent === 'out_of_scope') && x.amount !== undefined) {
      fail(`${String(x.intent)} must not carry an amount`);
    }
  }

  return { ok: errors.length === 0, errors };
}
