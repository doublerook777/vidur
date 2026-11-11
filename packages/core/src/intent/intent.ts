import { resolveDate, type Tense as DateTense } from '../dates/index.js';
import { findByAlias, matchName } from '../names/index.js';
import { CONFIRM_BELOW, parseAmount, type AmountMatch } from '../numbers/index.js';
import { lookup, norm } from '../numbers/lexicon.js';
import { unglue } from '../numbers/unglue.js';
import { detectRefusal } from './guardrails.js';
import type { EventTense as Tense, Interpretation, InterpretContext, Intent, Need, ParsedEvent } from './types.js';

const W = (xs: string): Set<string> => new Set(xs.split(/\s+/).filter(Boolean).map(norm));

// ---- cue words (normalised by norm(), so spelling variants meet) ----
const CREDIT = W(
  'udhaar udhar udhari uddhar baki baaki credit credited khata owes owe owed borrowed took taken balance_due ' +
    'उधार उधारी बाकी बक़ाया उद्धार उद्धरण ಉಧಾರ ಉದಾರ ಉಧಾರ್ ಉದಾರ್ ಸಾಲ ಬಾಕಿ',
);
const PAYMENT = W(
  'jama jamaa wapas vapas wapis chukaya chukaye chukai chuka chukaayi paid repaid returned refund refunded settled deposit deposited lautaya lauta ' +
    'वापसी जमा वापस वापिस चुकाया चुकाए चुकाई चुकता लौटाया लौटाए ಜಮಾ ವಾಪಸ್ ವಾಪಸಿ ಹಿಂತಿರುಗಿಸಿದರು ಕಟ್ಟಿದರು ಕಟ್ಟಿದ ಕಟ್ಟಿದಳು ಕಟ್ಟಿದನು',
);
const GIVE = W('diya diye di dia dee gave give given gives दिया दिए दी दिये');
const GIVE_KN_CUSTOMER = W('ಕೊಟ್ಲು ಕೊಟ್ರು ಕೊಟ್ಟಳು ಕೊಟ್ಟನು ಕೊಟ್ಟರು ಕೊಟ್ಟಿದ್ದಾಳೆ ಕೊಟ್ಟಿದ್ದಾರೆ ಕೊಟ್ಟಿದ್ದಾನೆ ಕೊಟ್ಟಳೆ');
const GIVE_KN_SHOP = W('ಕೊಟ್ಟೆ ಕೊಟ್ಟಿದ್ದೇನೆ ಕೊಟ್ಟೆನು');
const TOOK = W('liya lie le_gaya legaya liye ले गया लिया लिए ಪಡೆದ ಪಡೆದರು ತೆಗೆದುಕೊಂಡ ತೆಗೆದುಕೊಂಡರು ತೆಗೆದುಕೊಂಡಳು');
const FUTURE = W(
  'dega degi denge dunga dungi dunge dene_wala dene_wali will shall tomorrow_pay karega karegi karenge promised promise promises वादा ' +
    'देगा देगी देंगे दूँगा दूंगा दूँगी दूंगी करेगा करेगी करेंगे ಕೊಡ್ತಾರೆ ಕೊಡ್ತಾನೆ ಕೊಡ್ತಾಳೆ ಕೊಡುತ್ತಾರೆ ಕೊಡುತ್ತಾನೆ ಕೊಡುತ್ತಾಳೆ ಕೊಡ್ತೀನಿ ಕೊಡುತ್ತೇನೆ ಕೊಡ್ತಾರೆ ಕಟ್ಟುತ್ತಾರೆ ಕಟ್ಟುತ್ತಾನೆ ಕಟ್ಟುತ್ತಾಳೆ',
);
const PAST = W('tha thi the gaya gayi gaye diya liya kiya paid gave took was had था थी थे गया गयी लिया दिया किया ಆಯ್ತು ಆಗಿತ್ತು');
const QUERY = W(
  'kitna kitni kitne kitna_hai total hisab hisaab hisaabh much many ' +
    'कितना कितनी कितने कुल हिसाब टोटल ಎಷ್ಟು ಎಷ್ಟಿದೆ ಎಷ್ಟಾಗಿದೆ ಎಷ್ಟಾಯ್ತು ಒಟ್ಟು ಲೆಕ್ಕ',
);
const QUERY_EN = W('how what which show tell list who');
const REMINDER = W('reminder reminders remind yaad yaaddilao optin opt consent रिमाइंडर याद ರಿಮೈಂಡರ್ ನೆನಪಿಸಿ ನೆನಪಿನ ನೆನಪು ಜ್ಞಾಪನೆ');
const UNDO = W(
  'cancel undo delete hata hatao hataiye remove rad radd galat wrong mistake ruko ' +
    'रद्द हटा हटाओ हटाइए गलत ग़लत रुको ಗಲತ್ ತಪ್ಪು ತಪ್ಪಾಯ್ತು ರದ್ದು ತೆಗೆ ಅಳಿಸಿ',
);
const CORR_CUE = W('nahi nahin nhi nhin nai no nope sorry matlab i_mean actually नहीं नही नाही मतलब ಇಲ್ಲ ಅಲ್ಲ');
/** Words that open a correction when they start the sentence: the cues above, plus "galat" and friends. */
const LEAD_CUE = W('nahi nahin nhi nhin nai no nope sorry matlab i_mean actually galat wrong mistake नहीं नही नाही मतलब गलत ग़लत ಇಲ್ಲ ಅಲ್ಲ ತಪ್ಪು ಗಲತ್');
const MARK_KO = W('ko को ಗೆ');
const MARK_NE = W('ne ने');
const MARK_POSS = W('ka ki ke का की के ಅವರ ಅವರಿಗೆ ಅವರು');
const SEP = W('aur and phir then aur_phir tatha और फिर ಮತ್ತು ನಂತರ');

const STOP = W(
  'ka ki ke ko ne se me mein pe par ko hai hain ho tha thi the to ye wo woh yeh vo bhi hi bas mera meri mere mujhe hum aap please pls kya kab kaun kuch sab aaj kal parso ' +
    'aaj_ka a an the is are was of on in for with from by and or but that this it he she his her their him them my me i we you ' +
    'likh likho likhna karo kar kardo karna do de dena dedo dijiye diya diye bhejo bhej bhijwa send note ' +
    'rupaye rupaya rupees rupee rupye rupiye rupay rupai ruppee rupyee rs inr paise paisa amount ' +
    'today tomorrow yesterday last week weekend monday tuesday wednesday thursday friday saturday sunday somvar mangalvar budhvar guruvar shukravar shanivar ravivar ' +
    'ko_diya ne_diya pay back give ' +
    'का की के को ने से में पर है हैं था थी थे तो ये वो भी बस मेरा मेरी मुझे क्या आज कल परसों लिख लिखो कर करो दो दे देना दिया दिए भेजो भेज रुपये रुपए रुपया पैसे पैसा ' +
    'ಅವರ ಅವರು ಅವರಿಗೆ ಗೆ ಇಂದು ನಿನ್ನೆ ನಾಳೆ ಮಾಡಿ ಹಣ ರೂಪಾಯಿ ಇದು ಅದು ನನ್ನ ನನಗೆ ಏನು',
);
const ALL_CUES = [CREDIT, PAYMENT, GIVE, GIVE_KN_CUSTOMER, GIVE_KN_SHOP, TOOK, FUTURE, PAST, QUERY, QUERY_EN, REMINDER, UNDO, CORR_CUE, MARK_KO, MARK_NE, MARK_POSS, SEP];

const DATE_WORDS: Record<string, string> = {
  aaj: 'aaj', आज: 'aaj', today: 'today', ಇಂದು: 'ಇಂದು', kal: 'kal', कल: 'kal', yesterday: 'yesterday', ನಿನ್ನೆ: 'ನಿನ್ನೆ', tomorrow: 'tomorrow', ನಾಳೆ: 'ನಾಳೆ',
  parso: 'parso', परसों: 'parso', monday: 'monday', tuesday: 'tuesday', wednesday: 'wednesday', thursday: 'thursday', friday: 'friday', saturday: 'saturday', sunday: 'sunday',
  somvar: 'somvar', mangalvar: 'mangalvar', budhvar: 'budhvar', guruvar: 'guruvar', shukravar: 'shukravar', shanivar: 'shanivar', ravivar: 'ravivar',
  ಇವತ್ತು: 'aaj', ಪರಸೋ: 'parso', ನಾಡಿದ್ದು: 'parso', ಸೋಮವಾರ: 'somvar', ಮಂಗಳವಾರ: 'mangalvar', ಬುಧವಾರ: 'budhvar', ಗುರುವಾರ: 'guruvar', ಶುಕ್ರವಾರ: 'shukravar', ಶನಿವಾರ: 'shanivar', ಭಾನುವಾರ: 'ravivar',
  सोमवार: 'somvar', मंगलवार: 'mangalvar', बुधवार: 'budhvar', गुरुवार: 'guruvar', शुक्रवार: 'shukravar', शनिवार: 'shanivar', रविवार: 'ravivar',
};

const tokensWithSpans = (s: string): { w: string; n: string; a: number; b: number }[] =>
  [...s.matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map((m) => ({ w: m[0], n: norm(m[0]), a: m.index ?? 0, b: (m.index ?? 0) + m[0].length }));

const isNumberish = (t: string): boolean => /^\p{N}/u.test(t) || lookup(t) !== undefined;
const isCue = (n: string): boolean => ALL_CUES.some((s) => s.has(n));

function findDate(tokens: { w: string; n: string }[], tense: DateTense, nowMs: number): string | undefined {
  const phrase = tokens.map((t) => t.w.toLowerCase()).join(' ');
  for (const p of ['day after tomorrow', 'day before yesterday']) {
    if (phrase.includes(p)) {
      const r = resolveDate(p, tense, nowMs);
      if (r.kind === 'resolved') return r.token;
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const lw = t.w.toLowerCase();
    const nw = tokens[i + 1]?.w.toLowerCase();
    if ((lw === 'last' && nw === 'week') || ((lw === 'pichle' || lw === 'pichhle' || lw === 'पिछले') && (nw === 'hafte' || nw === 'hafta' || nw === 'हफ्ते' || nw === 'हफ़्ते'))) {
      const r = resolveDate('last week', 'past', nowMs);
      if (r.kind === 'resolved') return r.token;
    }
    const key = DATE_WORDS[t.w.toLowerCase()] ?? DATE_WORDS[t.n];
    if (!key) continue;
    const r = resolveDate(key, tense, nowMs);
    if (r.kind === 'resolved') return r.token;
    if (r.kind === 'ambiguous') {
      const r2 = resolveDate(key, 'past', nowMs);
      if (r2.kind === 'resolved') return r2.token;
    }
  }
  return undefined;
}

interface Clause {
  text: string;
  a: number;
  b: number;
}

function splitClauses(text: string, amounts: AmountMatch[]): Clause[] {
  if (amounts.length < 2) return [{ text, a: 0, b: text.length }];
  const cuts: number[] = [];
  for (let i = 0; i + 1 < amounts.length; i++) {
    const from = amounts[i]!.span[1];
    const to = amounts[i + 1]!.span[0];
    const gap = text.slice(from, to);
    // Prefer an explicit separator: a comma or semicolon, else "aur", "and", "phir".
    let cut = -1;
    const punct = gap.search(/[,;।.]/);
    if (punct >= 0) cut = from + punct + 1;
    else {
      const m = /(^|[^\p{L}\p{M}])(aur|and|phir|then|और|फिर|ಮತ್ತು)(?=[^\p{L}\p{M}]|$)/iu.exec(gap);
      if (m) cut = from + m.index + m[1]!.length;
    }
    if (cut < 0) {
      // No separator: cut just before the name-like token that precedes the next amount, else the middle.
      const toks = tokensWithSpans(gap);
      const mid = toks.length ? toks[Math.floor(toks.length / 2)]!.a : 0;
      cut = from + mid;
    }
    cuts.push(cut);
  }
  const out: Clause[] = [];
  let start = 0;
  for (const c of cuts) {
    out.push({ text: text.slice(start, c), a: start, b: c });
    start = c;
  }
  out.push({ text: text.slice(start), a: start, b: text.length });
  return out;
}

/** Heuristic for a customer name when the ledger doesn't help: the first word that is not a cue, number or filler. */
function guessName(tokens: { w: string; n: string }[]): string | undefined {
  const cand = (t: { w: string; n: string }): boolean => !STOP.has(t.n) && !isCue(t.n) && !isNumberish(t.w) && !/^\p{N}/u.test(t.w) && t.n.length > 1;
  // Prefer the word right before a possessive or case marker.
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i]!;
    if ((MARK_POSS.has(t.n) || MARK_KO.has(t.n) || MARK_NE.has(t.n)) && cand(tokens[i - 1]!)) return tokens[i - 1]!.w;
  }
  for (const t of tokens) if (cand(t)) return t.w;
  return undefined;
}

function interpretClause(clause: Clause, amounts: AmountMatch[], ctx: InterpretContext, inherited: string | undefined, nowMs: number): ParsedEvent {
  const text = clause.text;
  const toks = tokensWithSpans(text);
  const ns = toks.map((t) => t.n);
  const has = (s: Set<string>): boolean => ns.some((n) => s.has(n));
  const mine = amounts.filter((a) => a.span[0] >= clause.a && a.span[1] <= clause.b);
  const amount = mine[0];
  const q = text.trim().endsWith('?');

  // customer
  let customer: string | undefined;
  let customerKnown = false;
  const customers = ctx.customers ?? [];
  if (customers.length) {
    const byAlias = findByAlias(text, customers);
    for (const t of toks) {
      if (STOP.has(t.n) || isCue(t.n) || isNumberish(t.w)) continue;
      const m = matchName(t.w, customers, text);
      if (m.kind === 'exact' || m.kind === 'ambiguous' || m.kind === 'near') { customer = t.w; customerKnown = true; break; }
    }
    if (!customer && byAlias.length) { customer = byAlias[0]!.name; customerKnown = true; }
  }
  customer ??= guessName(toks);
  // A name the shopkeeper clearly attached to the sentence ("Suresh ka ...") even though the ledger doesn't have it yet.
  const guessedWithMarker = !customerKnown && customer !== undefined && toks.some((t, i) => i > 0 && toks[i - 1]!.w === customer && (MARK_POSS.has(t.n) || MARK_KO.has(t.n) || MARK_NE.has(t.n)));
  const customerInherited = !customer && inherited !== undefined;
  const who = customer ?? inherited;

  // tense and date
  const future = has(FUTURE);
  const tense: Tense = future ? 'future' : has(PAST) || has(PAYMENT) || has(TOOK) || has(GIVE) ? 'past' : 'unknown';
  const dateToken = findDate(toks, future ? 'future' : 'past', nowMs);

  const base = { tense, dateToken, customerSpoken: who, customerInherited: customerInherited || undefined, text: text.trim() } as const;
  const withAmount = (e: ParsedEvent): ParsedEvent => {
    if (amount) {
      e.amountPaise = amount.paise;
      e.amountConfidence = amount.confidence;
    }
    return e;
  };

  // direction
  const hasCredit = has(CREDIT);
  const hasPayment = has(PAYMENT);
  let direction: 'credit' | 'payment' | undefined;
  if (hasPayment) direction = 'payment';
  else if (hasCredit || has(TOOK)) direction = 'credit';
  else if (has(GIVE_KN_CUSTOMER)) direction = 'payment';
  else if (has(GIVE_KN_SHOP)) direction = 'credit';
  else if (has(GIVE)) {
    const gi = toks.findIndex((t) => GIVE.has(t.n));
    const ci = customer ? toks.findIndex((t) => t.w === customer) : -1;
    const markerAfterName = ci >= 0 ? toks[ci + 1]?.n : undefined;
    const markerAfterName2 = ci >= 0 ? toks[ci + 2]?.n : undefined;
    const marks = [markerAfterName, markerAfterName2].filter((x): x is string => !!x);
    if (marks.some((m) => MARK_NE.has(m))) direction = 'payment';
    else if (marks.some((m) => MARK_KO.has(m))) direction = 'credit';
    else if (/^(gave|give|given|gives)$/.test(ns[gi] ?? '')) direction = ci >= 0 && ci < gi ? 'payment' : ci > gi ? 'credit' : undefined;
    else if (customerInherited) direction = 'payment';
  }

  // 1. reminders
  if (has(REMINDER)) return withAmount({ ...base, intent: 'reminder_opt_in', needs: who ? [] : ['customer'] });
  // 2. queries
  const ledgerTerm = hasCredit || hasPayment || ns.includes('balance') || ns.includes('hisab');
  const queryish = has(QUERY) || (q && ledgerTerm && !amount) || (has(QUERY_EN) && ledgerTerm && !amount);
  if (queryish && !(amount && direction)) return { ...base, intent: 'balance_query', needs: [] };
  // 3. future promises are notes
  if (future) return withAmount({ ...base, intent: 'note', needs: [] });
  // 4. corrections
  // "Nahi nahi 1500 udhaar hain": a sentence that opens with "no" and carries an amount but no name of a person is a
  // correction of the last entry, even when it repeats the direction word. It must never become a new customer.
  const leadCue = toks.slice(0, 2).some((t) => LEAD_CUE.has(t.n));
  if (leadCue && amount && !customerKnown && !guessedWithMarker) {
    const ev = withAmount({ ...base, customerSpoken: inherited, customerInherited: inherited !== undefined || undefined, intent: 'correction', correction: { kind: 'amount' }, needs: amount.confidence < CONFIRM_BELOW ? ['amount_confirm'] : [] });
    if (direction) ev.directionHint = direction;
    return ev;
  }
  // "Delete all ledger entries" is not an undo: a voice undo is short and about the last entry only.
  const undoAll = /\b(all|every|everything|entire|saare|saari|sab|sabhi|ledger|entries)\b|सब|सारे|सभी|ಎಲ್ಲ/i.test(text) || toks.length > 6;
  const undo = has(UNDO) && !direction && !undoAll;
  const cue = has(CORR_CUE);
  if (has(UNDO) && undoAll && !direction && !amount) return { ...base, intent: 'out_of_scope', needs: [] };
  if (undo && !amount) return { ...base, intent: 'correction', correction: { kind: 'undo' }, needs: [] };
  if (undo && amount) return withAmount({ ...base, intent: 'correction', correction: { kind: 'amount' }, needs: amount.confidence < CONFIRM_BELOW ? ['amount_confirm'] : [] });
  if (cue && !direction) {
    if (amount) return withAmount({ ...base, intent: 'correction', correction: { kind: 'amount' }, needs: amount.confidence < CONFIRM_BELOW ? ['amount_confirm'] : [] });
    if (who) return { ...base, intent: 'correction', correction: { kind: 'customer' }, needs: [] };
    return { ...base, intent: 'correction', correction: { kind: 'undo' }, needs: [] };
  }
  // 5. entries
  if (direction || amount) {
    const needs: Need[] = [];
    if (!direction) needs.push('direction');
    if (!amount) needs.push('amount');
    else if (amount.confidence < CONFIRM_BELOW) needs.push('amount_confirm');
    if (!who) needs.push('customer');
    if (!direction && !amount) return { ...base, intent: 'out_of_scope', needs: [] };
    return withAmount({ ...base, intent: direction === 'payment' ? 'payment' : 'credit_entry', needs });
  }
  return { ...base, intent: 'out_of_scope', needs: [] };
}

/**
 * Turns one transcript into events, deterministically. No network. Amounts come only from `parseAmount`.
 * `needsLlm` is true when nothing recognisable was found, so the caller can fall back.
 */
/** From this amount up, the amount is always read back before saving. */
export const LARGE_PAISE = 10_000 * 100;

export function interpret(rawText: string, ctx: InterpretContext = {}): Interpretation {
  const text = unglue(rawText);
  const nowMs = ctx.nowMs ?? Date.now();
  const refusal = detectRefusal(text);
  if (refusal) {
    const who = guessNameForRefusal(text, ctx);
    return { text, needsLlm: false, events: [{ intent: 'refusal', refusal, tense: 'unknown', needs: [], customerSpoken: who, text: text.trim() }] };
  }
  const amounts = parseAmount(text);
  const clauses = splitClauses(text, amounts);
  const events: ParsedEvent[] = [];
  let inherited: string | undefined;
  for (const clause of clauses) {
    const ev = interpretClause(clause, amounts, ctx, inherited, nowMs);
    // "Ramesh ka 340 udhaar, nahi nahi 430 udhaar": a clause that opens with a correction cue and carries an amount,
    // with no new name, replaces the amount of the entry before it.
    const lead = tokensWithSpans(clause.text).slice(0, 2).some((t) => LEAD_CUE.has(t.n));
    const prior = events[events.length - 1];
    if (lead && prior && (prior.intent === 'credit_entry' || prior.intent === 'payment') && ev.amountPaise !== undefined && (ev.customerInherited || !ev.customerSpoken || ev.customerSpoken === prior.customerSpoken)) {
      prior.amountPaise = ev.amountPaise;
      prior.amountConfidence = ev.amountConfidence;
      prior.selfCorrected = true;
      prior.needs = prior.needs.filter((n) => n !== 'amount' && n !== 'amount_confirm');
      // The direction word may come in the correcting clause ("340, nahi nahi 430 udhaar").
      const evDir = ev.directionHint ?? (ev.intent === 'credit_entry' ? 'credit' : ev.intent === 'payment' ? 'payment' : undefined);
      if (prior.needs.includes('direction') && evDir) {
        prior.intent = evDir === 'payment' ? 'payment' : 'credit_entry';
        prior.needs = prior.needs.filter((n) => n !== 'direction');
      }
      if ((ev.amountConfidence ?? 1) < CONFIRM_BELOW) prior.needs.push('amount_confirm');
      continue;
    }
    // "Ramesh ka 340, nahi nahi 430 udhaar": a correction cue with an amount and no new name replaces the previous amount.
    const prev = events[events.length - 1];
    if (prev && ev.intent === 'correction' && ev.correction?.kind === 'amount' && ev.customerInherited && (prev.intent === 'credit_entry' || prev.intent === 'payment')) {
      prev.amountPaise = ev.amountPaise;
      prev.amountConfidence = ev.amountConfidence;
      prev.selfCorrected = true;
      if (prev.needs.includes('direction') && ev.directionHint) {
        prev.intent = ev.directionHint === 'payment' ? 'payment' : 'credit_entry';
        prev.needs = prev.needs.filter((n) => n !== 'direction');
      }
      prev.needs = prev.needs.filter((n) => n !== 'amount' && n !== 'amount_confirm');
      if ((ev.amountConfidence ?? 1) < CONFIRM_BELOW) prev.needs.push('amount_confirm');
      continue;
    }
    // A correction in the same breath that names the same customer and carries a direction is a new entry that supersedes the old one.
    events.push(ev);
    if (ev.customerSpoken && !ev.customerInherited) inherited = ev.customerSpoken;
  }
  // A garbled transcript often shows up as extra fragments with amounts and no direction or name. When one
  // utterance has such unresolved pieces, read back every amount before anything is saved.
  const unresolved = events.length > 1 && events.some((e) => (e.intent === 'credit_entry' || e.intent === 'payment') && (e.needs.includes('direction') || e.needs.includes('customer')));
  for (const e of events) {
    if (e.amountPaise === undefined || (e.intent !== 'credit_entry' && e.intent !== 'payment')) continue;
    if (unresolved && !e.needs.includes('amount_confirm')) e.needs.push('amount_confirm');
    // An entry that already needs a name or a direction, with a four-digit amount: read it back too. A garbled
    // "sawa sau" can turn into 1,225, and the shopkeeper is being asked something anyway.
    if ((e.needs.includes('customer') || e.needs.includes('direction')) && e.amountPaise >= 1000 * 100 && !e.needs.includes('amount_confirm')) e.needs.push('amount_confirm');
    // Large amounts are always read back: a slip of one zero costs a lot.
    if (e.amountPaise >= LARGE_PAISE && !e.needs.includes('amount_confirm')) e.needs.push('amount_confirm');
  }
  const first = events[0];
  const needsLlm = events.length === 0 || events.every((e) => e.intent === 'out_of_scope');
  void first;
  return { text, events, needsLlm };
}

function guessNameForRefusal(text: string, ctx: InterpretContext): string | undefined {
  const toks = tokensWithSpans(text);
  if (ctx.customers?.length) {
    for (const t of toks) {
      if (STOP.has(t.n) || isCue(t.n) || isNumberish(t.w)) continue;
      const m = matchName(t.w, ctx.customers, text);
      if (m.kind === 'exact' || m.kind === 'ambiguous' || m.kind === 'near') return t.w;
    }
  }
  return guessName(toks);
}

/**
 * True only for an explicit, un-negated statement that a customer agreed to reminders ("Opt Sunita in",
 * "Sunita ne reminder ke liye haan kaha"). "Send it even if she doesn't agree" is not consent.
 */
export function isOptInStatement(text: string): boolean {
  const t = text.toLowerCase();
  const negated = /\b(not|nahi|nahin|na|without|bina|don'?t|doesn'?t|dont|never|refuse[sd]?|even if|chahe|bhale)\b|नहीं|नही|बिना|चाहे|भले|ಒಪ್ಪದ|ಇಲ್ಲ|ಬಿನಾ|ಇಲ್ಲದೆ|ಆದರೂ/.test(t);
  if (negated) return false;
  return /\bopt(ed)? ?(.{0,30})?in\b|\boptin\b|\bconsent(ed)?\b|\bagreed\b|\bsahmat\b|सहमत|ಒಪ್ಪಿದ್ದಾರೆ|ಒಪ್ಪಿಗೆ/.test(t);
}

/** The direction a short answer like "udhaar" or "jama" gives, or undefined. */
export function detectDirection(text: string): 'credit' | 'payment' | undefined {
  const ns = tokensWithSpans(text).map((t) => t.n);
  if (ns.some((n) => PAYMENT.has(n))) return 'payment';
  if (ns.some((n) => CREDIT.has(n) || TOOK.has(n))) return 'credit';
  return undefined;
}

export function guessCustomerName(text: string): string | undefined {
  return guessName(tokensWithSpans(text));
}

const YES = W('haan han ha haanji ji yes yeah yep yup sahi theek thik ok okay correct right sure हाँ हां हा जी सही ठीक ಹೌದು ಸರಿ');
const NO = W('nahi nahin na no nope galat wrong cancel नहीं नही ग़लत गलत ಇಲ್ಲ ಬೇಡ');
/** "yes" or "no" from a short reply, or undefined. The first one said wins. */
export function yesNo(text: string): 'yes' | 'no' | undefined {
  for (const t of tokensWithSpans(text)) {
    if (YES.has(t.n)) return 'yes';
    if (NO.has(t.n)) return 'no';
  }
  return undefined;
}

/** How many words of `text` are left once the amount, currency and filler words are taken out. */
export function residualWords(text: string): number {
  const amounts = parseAmount(text);
  let rest = text;
  for (const a of [...amounts].reverse()) rest = rest.slice(0, a.span[0]) + ' ' + rest.slice(a.span[1]);
  return tokensWithSpans(rest).filter((t) => !STOP.has(t.n) && !YES.has(t.n) && !NO.has(t.n)).length;
}

export type { Intent };
