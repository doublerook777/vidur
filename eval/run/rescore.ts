/**
 * Re-runs the CURRENT parser on transcripts saved by run.ts. Costs no credits, so parser changes can be measured freely.
 * Usage: npx tsx eval/run/rescore.ts <label>   (reads eval/results/raw/<label>.jsonl, writes <label>-rescored.jsonl)
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { interpret } from '../../packages/core/src/index.ts';

const label = process.argv[2];
if (!label) throw new Error('usage: rescore.ts <label>');
const NOW = Date.UTC(2026, 10, 11, 6, 30);
const NAMES = ['Ramesh', 'Sunita', 'Kavita', 'Mohan', 'Suresh', 'Anil', 'Geeta', 'Pooja', 'Vijay', 'Neha', 'Dinesh', 'Radha', 'Mahesh', 'Lakshmi', 'Manoj', 'Fatima', 'Rahul', 'Deepa', 'Imran', 'Arjun', 'Meena', 'Sanjay', 'Ajay', 'Kavya'];
const rows = readFileSync(`eval/results/raw/${label}.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown> & { heard: string });
const out = rows.map((r) => {
  const it = r.heard ? interpret(r.heard, { nowMs: NOW, customers: NAMES.map((n, i) => ({ id: String(i), name: n, aliases: [] })) }) : null;
  const ev = it?.events[0];
  return { ...r, got: ev ? { intent: ev.intent, amountPaise: ev.amountPaise, needs: ev.needs, customer: ev.customerSpoken } : null, needsLlm: it?.needsLlm ?? null };
});
writeFileSync(`eval/results/raw/${label}-rescored.jsonl`, out.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`rescored ${out.length} records -> eval/results/raw/${label}-rescored.jsonl`);
