/**
 * Eval scorer for voice-ledger corpus runs. Pure functions + a small CLI.
 *
 *   npx tsx eval/score/score.ts <results.jsonl> [out.md]
 *
 * Default out: eval/results/<YYYY-MM-DD>.md (folder created). Exit code 1 when
 * silentWrong > 0, else 0.
 *
 * Definitions (denominators in parentheses):
 *   intentRight    = got.intent === expected.intent                       (n)
 *   directionRight = of expected.intent in {credit_entry, payment}: got.intent equal (directionTotal)
 *   amountExact    = of records with expected.amount: got.amountPaise === amount*100
 *                    AND needs has NO entry starting with 'amount'         (amountTotal)
 *   amountAsked    = of records with expected.amount and got != null: got amount missing
 *                    or wrong, BUT needs HAS an entry starting with 'amount' (amountTotal)
 *   silentWrong    = of records with expected.amount and got != null: got.amountPaise
 *                    defined and != expected*100, and needs has NO entry starting with 'amount' (amountTotal)
 *   noResult       = got === null                                          (n)
 * Latency percentiles: nearest-rank method, nulls ignored.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface ScoreRecord {
  id: string;
  lang: 'hi' | 'hinglish' | 'en' | 'kn';
  voice: string;
  snr: number | 'clean';
  expected: { intent: string; amount?: number; customer?: string; clarify?: boolean };
  heard: string;
  got: { intent: string; amountPaise?: number; needs: string[] } | null;
  sttMs: number | null;
  e2eMs?: number;
}

export interface CellMetrics {
  n: number;
  intentRight: number;
  directionRight: number;
  directionTotal: number;
  amountTotal: number;
  amountExact: number;
  /** The right amount, but the app read it back first (large or doubtful amounts). The shopkeeper confirms, so it is not a miss. */
  amountReadBack: number;
  amountAsked: number;
  silentWrong: number;
  noResult: number;
  sttP50: number | null;
  sttP95: number | null;
  e2eP50: number | null;
  e2eP95: number | null;
}

export interface SilentWrongRecord {
  id: string;
  heard: string;
  expected: ScoreRecord['expected'];
  got: NonNullable<ScoreRecord['got']>;
}

export interface Cell {
  lang: string;
  snr: string;
  metrics: CellMetrics;
}

export interface Report {
  overall: CellMetrics;
  cells: Cell[];
  silentWrongRecords: SilentWrongRecord[];
  silentWrong: number;
}

const DIRECTION_INTENTS = new Set(['credit_entry', 'payment']);
const LANGS = ['hi', 'hinglish', 'en', 'kn'];
const SNR_ORDER = ['clean', '15', '10', '5'];

function snrKey(snr: number | 'clean'): string {
  return snr === 'clean' ? 'clean' : String(snr);
}

function hasAmountNeed(needs: string[] | undefined): boolean {
  return (needs ?? []).some((n) => n.startsWith('amount'));
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.max(0, rank - 1)] ?? null;
}

function emptyCell(): CellMetrics {
  return {
    n: 0,
    intentRight: 0,
    directionRight: 0,
    directionTotal: 0,
    amountTotal: 0,
    amountExact: 0,
    amountReadBack: 0,
    amountAsked: 0,
    silentWrong: 0,
    noResult: 0,
    sttP50: null,
    sttP95: null,
    e2eP50: null,
    e2eP95: null,
  };
}

interface Accum {
  base: CellMetrics;
  stt: number[];
  e2e: number[];
}

function newAccum(): Accum {
  return { base: emptyCell(), stt: [], e2e: [] };
}

function addRecord(acc: Accum, rec: ScoreRecord, silentWrong: SilentWrongRecord[]): void {
  const m = acc.base;
  m.n += 1;

  const got = rec.got;
  const gotIntent = got?.intent;

  if (gotIntent === rec.expected.intent) m.intentRight += 1;

  if (DIRECTION_INTENTS.has(rec.expected.intent)) {
    m.directionTotal += 1;
    if (gotIntent === rec.expected.intent) m.directionRight += 1;
  }

  if (rec.expected.amount !== undefined) {
    m.amountTotal += 1;
    const expectedPaise = rec.expected.amount * 100;
    const amountNeed = hasAmountNeed(got?.needs);
    if (got !== null) {
      const gotPaise = got.amountPaise;
      if (gotPaise === expectedPaise && !amountNeed) {
        m.amountExact += 1;
      } else if (gotPaise === expectedPaise && amountNeed) {
        m.amountReadBack += 1;
      } else if ((gotPaise === undefined || gotPaise !== expectedPaise) && amountNeed) {
        m.amountAsked += 1;
      } else if (gotPaise !== undefined && gotPaise !== expectedPaise && !amountNeed) {
        m.silentWrong += 1;
        silentWrong.push({ id: rec.id, heard: rec.heard, expected: rec.expected, got });
      }
    }
  }

  if (got === null) m.noResult += 1;

  if (typeof rec.sttMs === 'number' && Number.isFinite(rec.sttMs)) acc.stt.push(rec.sttMs);
  if (typeof rec.e2eMs === 'number' && Number.isFinite(rec.e2eMs)) acc.e2e.push(rec.e2eMs);
}

function finishCell(acc: Accum): CellMetrics {
  const stt = [...acc.stt].sort((a, b) => a - b);
  const e2e = [...acc.e2e].sort((a, b) => a - b);
  acc.base.sttP50 = percentile(stt, 50);
  acc.base.sttP95 = percentile(stt, 95);
  acc.base.e2eP50 = percentile(e2e, 50);
  acc.base.e2eP95 = percentile(e2e, 95);
  return acc.base;
}

export function score(records: ScoreRecord[]): Report {
  const overall = newAccum();
  const perCell = new Map<string, Accum>();
  const silentWrongRecords: SilentWrongRecord[] = [];

  for (const rec of records) {
    addRecord(overall, rec, silentWrongRecords);
    const key = `${rec.lang}|${snrKey(rec.snr)}`;
    let cell = perCell.get(key);
    if (!cell) {
      cell = newAccum();
      perCell.set(key, cell);
    }
    addRecord(cell, rec, []); // silentWrong collected once, via overall
  }

  const cells: Cell[] = [...perCell.entries()].map(([key, acc]) => {
    const [lang = '', snr = ''] = key.split('|');
    return { lang, snr, metrics: finishCell(acc) };
  });

  const snrRank = (s: string): number => {
    const i = SNR_ORDER.indexOf(s);
    return i === -1 ? SNR_ORDER.length : i;
  };
  cells.sort((a, b) => {
    const la = LANGS.indexOf(a.lang);
    const lb = LANGS.indexOf(b.lang);
    const langCmp = (la === -1 ? LANGS.length : la) - (lb === -1 ? LANGS.length : lb);
    if (langCmp !== 0) return langCmp;
    return snrRank(a.snr) - snrRank(b.snr);
  });

  const overallMetrics = finishCell(overall);
  return {
    overall: overallMetrics,
    cells,
    silentWrongRecords,
    silentWrong: overallMetrics.silentWrong,
  };
}

export function pct(n: number, d: number): string {
  if (d === 0) return '—';
  return `${((100 * n) / d).toFixed(1)}%`;
}

function numOrDash(v: number | null): string {
  return v === null ? '—' : String(v);
}

function cellRow(c: Cell): string {
  const m = c.metrics;
  return [
    c.lang,
    c.snr,
    String(m.n),
    `${m.intentRight}/${m.n} (${pct(m.intentRight, m.n)})`,
    `${m.directionRight}/${m.directionTotal} (${pct(m.directionRight, m.directionTotal)})`,
    `${m.amountExact}/${m.amountTotal} (${pct(m.amountExact, m.amountTotal)})`,
    `${m.amountAsked}/${m.amountTotal} (${pct(m.amountAsked, m.amountTotal)})`,
    String(m.silentWrong),
    String(m.noResult),
    numOrDash(m.sttP50),
    numOrDash(m.sttP95),
    numOrDash(m.e2eP50),
    numOrDash(m.e2eP95),
  ].join(' | ');
}

export function toMarkdown(report: Report, title: string): string {
  const o = report.overall;
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push('## Overall');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Records | ${o.n} |`);
  lines.push(`| Intent right | ${o.intentRight}/${o.n} (${pct(o.intentRight, o.n)}) |`);
  lines.push(`| Direction right (credit/payment) | ${o.directionRight}/${o.directionTotal} (${pct(o.directionRight, o.directionTotal)}) |`);
  lines.push(`| Amount exact | ${o.amountExact}/${o.amountTotal} (${pct(o.amountExact, o.amountTotal)}) |`);
  lines.push(`| Amount right after a read-back | ${o.amountReadBack}/${o.amountTotal} (${pct(o.amountReadBack, o.amountTotal)}) |`);
  lines.push(`| **Amount right (exact or after a read-back)** | ${o.amountExact + o.amountReadBack}/${o.amountTotal} (${pct(o.amountExact + o.amountReadBack, o.amountTotal)}) |`);
  lines.push(`| Amount asked (instead of guessing) | ${o.amountAsked}/${o.amountTotal} (${pct(o.amountAsked, o.amountTotal)}) |`);
  lines.push(`| Silent wrong amount | ${o.silentWrong}/${o.amountTotal} (${pct(o.silentWrong, o.amountTotal)}) |`);
  lines.push(`| No result (got null) | ${o.noResult}/${o.n} (${pct(o.noResult, o.n)}) |`);
  lines.push(`| STT latency p50 | ${numOrDash(o.sttP50)} ms |`);
  lines.push(`| STT latency p95 | ${numOrDash(o.sttP95)} ms |`);
  lines.push(`| End-to-end p50 | ${numOrDash(o.e2eP50)} ms |`);
  lines.push(`| End-to-end p95 | ${numOrDash(o.e2eP95)} ms |`);
  lines.push('');
  lines.push('## By language × SNR');
  lines.push('');
  lines.push('| lang | snr | n | intent right | direction right | amount exact | amount asked | silent wrong | no result | stt p50 | stt p95 | e2e p50 | e2e p95 |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of report.cells) lines.push(`| ${cellRow(c)} |`);
  lines.push('');
  lines.push('## Silent wrongs');
  lines.push('');
  if (report.silentWrongRecords.length === 0) {
    lines.push('None.');
  } else {
    for (const r of report.silentWrongRecords) {
      lines.push(
        `- id=${r.id} heard=${JSON.stringify(r.heard)} expected=${JSON.stringify(r.expected)} got=${JSON.stringify(r.got)}`,
      );
    }
  }
  lines.push('');
  lines.push(`SILENT WRONG: ${report.silentWrong}`);
  lines.push('');
  return lines.join('\n');
}

function readJsonl(path: string): ScoreRecord[] {
  const text = readFileSync(path, 'utf8');
  const out: ScoreRecord[] = [];
  text.split('\n').forEach((raw, i) => {
    if (raw.trim().length === 0) return;
    try {
      out.push(JSON.parse(raw) as ScoreRecord);
    } catch (err) {
      throw new Error(`${path} line ${String(i + 1)}: invalid JSON: ${String(err)}`);
    }
  });
  return out;
}

function todayIst(): string {
  // Local date is fine for a report filename; labelled by the machine clock.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${String(yyyy)}-${mm}-${dd}`;
}

function main(): void {
  const input = process.argv[2];
  if (!input) {
    console.error('usage: npx tsx eval/score/score.ts <results.jsonl> [out.md]');
    process.exit(2);
  }
  const out = process.argv[3] ?? join('eval', 'results', `${todayIst()}.md`);
  const records = readJsonl(input);
  const report = score(records);
  const md = toMarkdown(report, `Eval results — ${input}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, md);
  console.log(`wrote ${out}`);
  if (report.silentWrong > 0) process.exit(1);
  process.exit(0);
}

const invokedAsScript =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) main();
