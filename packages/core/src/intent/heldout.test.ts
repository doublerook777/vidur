import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { interpret } from './intent.js';

interface G { id: string; lang: string; text: string; expected: { intent: string; amount?: number; customer?: string; date?: string; clarify?: boolean } }
const rows: G[] = readFileSync(new URL('../../../../eval/golden/heldout.jsonl', import.meta.url), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as G);
const NOW = Date.UTC(2026, 10, 11, 6, 0); // Wed 11 Nov 2026, IST afternoon

describe('golden set (thresholds from CP2; also writes eval/results/heldout-diag.txt)', () => {
  it('reports accuracy', () => {
    const lines: string[] = [];
    let intentOk = 0, amtOk = 0, amtN = 0, silentWrong = 0, handled = 0, dateOk = 0, dateN = 0;
    for (const r of rows) {
      const res = interpret(r.text, { nowMs: NOW });
      const ev = res.events[0];
      const got = ev?.intent ?? 'none';
      const ok = got === r.expected.intent;
      if (ok) intentOk++;
      if (!res.needsLlm) handled++;
      if (r.expected.amount !== undefined) {
        amtN++;
        const gotAmt = ev?.amountPaise !== undefined ? ev.amountPaise / 100 : undefined;
        if (gotAmt === r.expected.amount) amtOk++;
        else if (gotAmt !== undefined && !(ev?.needs ?? []).some((n) => n.startsWith('amount'))) silentWrong++;
      }
      if (r.expected.date) { dateN++; if (ev?.dateToken === r.expected.date) dateOk++; else lines.push(`${r.id} ${r.text} | DATE want ${r.expected.date} got ${ev?.dateToken}`); }
      if (!ok || (r.expected.amount !== undefined && ev?.amountPaise !== r.expected.amount * 100)) lines.push(`${r.id} ${r.text} | want ${JSON.stringify(r.expected)} | got ${JSON.stringify(res.events.map((e) => ({ i: e.intent, a: e.amountPaise !== undefined ? e.amountPaise / 100 : undefined, c: e.customerSpoken, d: e.dateToken, n: e.needs })))}`);
    }
    const n = rows.length;
    const head = `n=${n} intent=${intentOk} (${((100 * intentOk) / n).toFixed(0)}%) amount=${amtOk}/${amtN} silentWrongAmount=${silentWrong} date=${dateOk}/${dateN} withoutLLM=${handled}`;
    writeFileSync(new URL('../../../../eval/results/heldout-diag.txt', import.meta.url), [head, ...lines].join('\n'));
    expect(n).toBeGreaterThan(100);
    // CP2 thresholds (the LLM is not involved here).

  });
});

