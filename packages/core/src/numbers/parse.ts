import { CURRENCY, NEEDS_CONTEXT, NOT_MONEY_AFTER, asciiDigits, lookup, norm, type Entry } from './lexicon.js';

export type Lang = 'hi' | 'en' | 'kn' | 'hinglish';

export interface AmountMatch {
  /** Integer paise. Money is never a float. */
  paise: number;
  source: 'digits' | 'words' | 'colloquial' | 'artifact' | 'decimal';
  /** 1 means certain. Below `CONFIRM_BELOW` the dialogue must read the amount back before saving. */
  confidence: number;
  /** [start, end) in the original text, including an attached currency word. */
  span: [number, number];
  text: string;
}

export const CONFIRM_BELOW = 0.75;

interface Tok {
  text: string;
  start: number;
  end: number;
  n: string; // normalised
}

type El =
  | { t: 'dig'; value: number; conf: number; src: AmountMatch['source']; i: number }
  | { t: 'word'; e: Entry; i: number; w: string }
  | { t: 'groupFrac'; value: number; scale: 100 | 1000 | 100000 | 10000000; i0: number; i1: number };

const TOKEN_RE = /₹|\p{N}+(?:[.,:]\p{N}+)*|[\p{L}\p{M}]+/gu;

function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    out.push({ text: m[0], start, end: start + m[0].length, n: norm(m[0]) });
  }
  return out;
}

/** Turns one digit token into zero or more elements. Phone-like and malformed tokens give none. */
function digitElements(tok: Tok, i: number): El[] {
  const s = asciiDigits(tok.text);
  if (!/^\d/.test(s)) return [];
  if (/^\d+$/.test(s)) {
    if (s.length >= 10) return []; // phone number
    if (s.length > 1 && s.startsWith('0')) return [];
    return [{ t: 'dig', value: Number(s), conf: s.length >= 8 ? 0.4 : 1, src: 'digits', i }];
  }
  if (s.includes(':')) {
    const m = s.match(/^(\d{1,3}):(\d{2})$/);
    return m ? [{ t: 'dig', value: Number(m[1]! + m[2]!), conf: 0.4, src: 'artifact', i }] : [];
  }
  if (s.includes('.') && !s.includes(',')) {
    const m = s.match(/^(\d+)\.(\d+)$/);
    if (!m) return [];
    if (m[2]!.length === 2 && m[1]!.length <= 3) return [{ t: 'dig', value: Number(m[1]! + m[2]!), conf: 0.4, src: 'artifact', i }];
    return [{ t: 'dig', value: Number(s), conf: 0.5, src: 'decimal', i }];
  }
  // commas
  if (/^\d{1,3}(,\d{2})*,\d{3}$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) {
    return [{ t: 'dig', value: Number(s.replace(/,/g, '')), conf: 1, src: 'digits', i }];
  }
  return s.split(',').flatMap((p) => digitElements({ ...tok, text: p }, i));
}

interface State {
  total: number;
  cur: number;
  lastBig: number;
  last: 'none' | 'unit' | 'dig' | 'mult';
  lastMult: number;
  conf: number;
  colloquial: boolean;
  srcs: Set<AmountMatch['source']>;
  hasAny: boolean;
  i0: number;
  i1: number;
  lone: El | null; // set while the amount is one element long
}

const fresh = (): State => ({
  total: 0, cur: 0, lastBig: Infinity, last: 'none', lastMult: 0, conf: 1, colloquial: false,
  srcs: new Set(), hasAny: false, i0: -1, i1: -1, lone: null,
});

function span(el: El): [number, number] {
  return el.t === 'groupFrac' ? [el.i0, el.i1] : [el.i, el.i];
}

/** Tries to continue the amount with `el`. Returns false when `el` must start a new amount. */
function feed(st: State, el: El): boolean {
  const addUnitLike = (v: number): boolean => {
    if (!st.hasAny) { st.cur = v; return true; }
    if (st.last === 'mult') {
      if (st.lastMult === 100 ? v >= 100 : false) return false;
      st.cur += v;
      return true;
    }
    return false;
  };
  let ok = false;
  let source: AmountMatch['source'] = 'words';
  if (el.t === 'dig') {
    source = el.src;
    if (!st.hasAny) { st.cur = el.value; ok = true; }
    else if (st.last === 'mult' && el.value < st.lastMult) { st.cur += el.value; ok = true; }
    if (ok) { st.last = 'dig'; st.conf = Math.min(st.conf, el.conf); }
  } else if (el.t === 'groupFrac') {
    if (el.scale === 100) {
      if (!st.hasAny || (st.last === 'mult' && st.lastMult >= 1000)) { st.cur += el.value; st.last = 'mult'; st.lastMult = 100; ok = true; }
    } else if ((!st.hasAny || st.cur === 0) && el.scale < st.lastBig) {
      st.total += el.value; st.lastBig = el.scale; st.last = 'mult'; st.lastMult = el.scale; ok = true;
    }
    if (ok) st.conf = Math.min(st.conf, 0.95);
  } else {
    const e = el.e;
    if (e.kind === 'unit') {
      if (!st.hasAny) { st.cur = e.value; ok = true; }
      else if (st.last === 'mult') ok = addUnitLike(e.value);
      else if (st.last === 'unit') {
        if (st.cur >= 1 && st.cur <= 9 && e.value >= 20 && e.value % 10 === 0) {
          st.cur = st.cur * 100 + e.value; st.colloquial = true; ok = true; // teen chaalis, three forty
        } else if (st.cur >= 20 && st.cur % 10 === 0 && e.value < 10) { st.cur += e.value; ok = true; } // twenty five, three forty five
      }
      if (ok) { st.last = 'unit'; st.conf = Math.min(st.conf, st.colloquial ? 0.8 : 0.95); }
    } else if (e.kind === 'fusedHundred') {
      if (!st.hasAny || (st.last === 'mult' && st.lastMult >= 1000)) { st.cur += e.value; st.last = 'mult'; st.lastMult = 100; ok = true; }
      if (ok) st.conf = Math.min(st.conf, 0.95);
    } else if (e.kind === 'mult') {
      if (e.value === 100) {
        if (!st.hasAny) { st.cur = 100; ok = true; }
        else if (st.last !== 'mult' && st.cur > 0 && st.cur < 100) { st.cur *= 100; ok = true; }
        else if (st.last === 'mult' && st.cur === 0 && st.lastMult >= 1000) { st.cur = 100; ok = true; }
        if (ok) { st.last = 'mult'; st.lastMult = 100; }
      } else if (e.value < st.lastBig) {
        const group = !st.hasAny ? 1 : st.cur;
        if (group > 0 && group < 1000) {
          st.total += group * e.value; st.cur = 0; st.lastBig = e.value; st.last = 'mult'; st.lastMult = e.value; ok = true;
        }
      }
      if (ok) st.conf = Math.min(st.conf, st.hasAny ? 0.95 : 0.7);
    }
  }
  if (!ok) return false;
  const [a, b] = span(el);
  if (!st.hasAny) { st.i0 = a; st.lone = el; } else st.lone = null;
  st.i1 = b;
  st.hasAny = true;
  st.srcs.add(source);
  return true;
}

/** Collapses [fraction][unit?][multiplier] into one group element. */
function composeFractions(els: El[]): El[] {
  const out: El[] = [];
  for (let k = 0; k < els.length; k++) {
    const el = els[k]!;
    if (el.t === 'word' && el.e.kind === 'frac') {
      const word = el.e.word;
      let j = k + 1;
      let base: number | null = null;
      const nx = els[j];
      if (nx && nx.t === 'word' && nx.e.kind === 'unit' && nx.e.value >= 1 && nx.e.value <= 99) { base = nx.e.value; j++; }
      const mu = els[j];
      if (mu && mu.t === 'word' && mu.e.kind === 'mult') {
        const m = mu.e.value;
        let value: number | null = null;
        if (word === 'dedh' && base === null) value = 1.5 * m;
        else if (word === 'dhai' && base === null) value = 2.5 * m;
        else if (word === 'sawa') value = ((base ?? 1) + 0.25) * m;
        else if (word === 'paune') value = ((base ?? 1) - 0.25) * m;
        else if (word === 'saade' && base !== null) value = (base + 0.5) * m;
        if (value !== null) {
          out.push({ t: 'groupFrac', value, scale: m, i0: el.i, i1: mu.i });
          k = j;
          continue;
        }
      }
      continue; // a fraction word that is not part of an amount
    }
    out.push(el);
  }
  return out;
}

/** Phone numbers are blanked out first, keeping offsets: 98765 43210, +91 98765 43210, 080-2345-6789. */
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?\d{5}[\s-]?\d{5}|\d{3,4}[\s-]\d{3,4}[\s-]\d{4}/g;

/** `lang` is accepted for the API but all supported languages are always active, because shopkeepers mix them. */
export function parseAmount(input: string, lang: Lang = 'hi'): AmountMatch[] {
  void lang;
  const text = input.replace(PHONE_RE, (m) => ' '.repeat(m.length));
  const toks = tokenize(text);
  const isCur = (k: number): boolean => k >= 0 && k < toks.length && CURRENCY.has(toks[k]!.n);

  // Build runs of numeric elements. A run is broken by any other token.
  const runs: El[][] = [];
  let run: El[] = [];
  const endRun = (): void => { if (run.length) runs.push(run); run = []; };
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i]!;
    if (/^\p{N}/u.test(tk.text)) {
      const els = digitElements(tk, i);
      if (els.length) run.push(...els); else endRun();
      continue;
    }
    const e = lookup(tk.text);
    if (e) { run.push({ t: 'word', e, i, w: tk.n }); continue; }
    if (tk.n === 'and' && run.length && toks[i + 1] && (/^\p{N}/u.test(toks[i + 1]!.text) || lookup(toks[i + 1]!.text))) continue;
    endRun();
  }
  endRun();

  const out: AmountMatch[] = [];
  const emit = (st: State): void => {
    if (!st.hasAny) return;
    const value = st.total + st.cur;
    let { i0, i1 } = st;
    let hasCurrency = false;
    if (isCur(i0 - 1)) { i0 -= 1; hasCurrency = true; }
    if (isCur(i1 + 1)) { i1 += 1; hasCurrency = true; }
    const core0 = st.i0, core1 = st.i1;
    // Quantities, dates and times are not money, unless a currency mark says otherwise.
    const next = toks[core1 + 1];
    if (!hasCurrency && next && NOT_MONEY_AFTER.has(next.n)) return;
    if (!hasCurrency && text.slice(toks[core1]!.end).trimStart().startsWith('%')) return;
    let conf = st.conf;
    const lone = st.lone;
    if (lone && lone.t === 'word' && lone.e.kind === 'unit' && !hasCurrency) {
      if (NEEDS_CONTEXT.has(lone.w)) return; // Hindi "do" against English "do"
      if (lone.e.value <= 9) conf = Math.min(conf, 0.6);
    }
    if (value <= 0) return;
    if (value > 10000000) conf = Math.min(conf, 0.5);
    const source: AmountMatch['source'] = st.srcs.has('artifact') ? 'artifact' : st.srcs.has('decimal') ? 'decimal' : st.colloquial ? 'colloquial' : st.srcs.has('words') ? 'words' : 'digits';
    const s0 = toks[i0]!.start, s1 = toks[i1]!.end;
    void core0;
    out.push({ paise: Math.round(value * 100), source, confidence: Math.round(conf * 100) / 100, span: [s0, s1], text: input.slice(s0, s1) });
  };

  for (const r of runs) {
    let st = fresh();
    for (const el of composeFractions(r)) {
      if (!feed(st, el)) {
        emit(st);
        st = fresh();
        if (!feed(st, el)) st = fresh();
      }
    }
    emit(st);
  }
  return out.sort((a, b) => a.span[0] - b.span[0]);
}

/** The single best amount, or null. Used by the grounding check. */
export function amountsPaise(text: string, lang: Lang = 'hi'): number[] {
  return parseAmount(text, lang).map((a) => a.paise);
}
