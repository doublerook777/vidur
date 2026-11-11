// T1.7: free-tier LLM parse test on Groq. Synthetic golden items only. Usage: node spikes/llm-bench.mjs <model> [count] [reasoning_effort]
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { env, pct } from './lib.mjs';
const [model, countArg = '30', effort] = process.argv.slice(2);
const e = env();
const rows = readFileSync('eval/golden/utterances.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const pick = [];
for (const lang of ['hi', 'hinglish', 'kn']) {
  const xs = rows.filter((r) => r.lang === lang);
  const step = Math.floor(xs.length / 10);
  for (let i = 0; i < 10; i++) pick.push(xs[i * step]);
}
const items = pick.slice(0, Number(countArg) === 30 ? 30 : Number(countArg));

const SYSTEM = `You parse one spoken utterance from a small-shop owner in India into JSON for a credit ledger (udhaar/khata). The utterance is a speech transcript in Hindi, Kannada, English or a mix, in native or Latin script.
Output only JSON matching the schema. Fields:
- intent: credit_entry (customer took goods or money on credit: udhaar, baaki), payment (customer paid back: jama, wapas, chukaya), balance_query (asks who owes what or a total), correction (replaces or undoes the last entry: "nahi", "galat"), reminder_opt_in (shopkeeper asks to send a polite reminder to a consenting customer), note (a future promise to pay, saved as a note only), refusal (threats, pressure on a customer, lending money, interest, judging whether a customer is creditworthy), out_of_scope (anything else).
- amount: integer rupees, or null if none. Convert spoken numbers: dedh sau=150, dhai hazaar=2500, sawa do sau=225, paune teen sau=275, saade teen sau=350, ek lakh=100000. Native digits to ASCII.
- customer: the customer's first name written in Latin letters, or null.
- item: goods mentioned in English, or null.
- date: today, yesterday, tomorrow, day_after_tomorrow, last_week, or null.
- clarify: true only if the utterance is too ambiguous to act on (missing direction, unclear amount, unclear person).
Never guess an amount that was not said. Never judge a customer. If the speaker threatens, pressures, lends or charges interest, intent is refusal.`;

const schema = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['credit_entry', 'payment', 'balance_query', 'correction', 'reminder_opt_in', 'note', 'refusal', 'out_of_scope'] },
    amount: { type: ['integer', 'null'] },
    customer: { type: ['string', 'null'] },
    item: { type: ['string', 'null'] },
    date: { type: ['string', 'null'] },
    clarify: { type: 'boolean' },
  },
  required: ['intent', 'amount', 'customer', 'item', 'date', 'clarify'],
  additionalProperties: false,
};

async function call(text, strict = true) {
  const body = {
    model, temperature: 0, max_completion_tokens: 600,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }],
    response_format: strict ? { type: 'json_schema', json_schema: { name: 'parse', strict: true, schema } } : { type: 'json_object' },
  };
  if (effort) body.reasoning_effort = effort;
  const t0 = performance.now();
  const r = await fetch(e.LLM_BASE_URL + '/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + e.LLM_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const ms = performance.now() - t0;
  const j = await r.json();
  if (!r.ok) return { ms, err: `${r.status} ${JSON.stringify(j.error ?? j).slice(0, 200)}`, retry: r.headers.get('retry-after') };
  let out = null;
  try { out = JSON.parse(j.choices[0].message.content); } catch { /* invalid */ }
  return { ms, out, usage: j.usage };
}

const lat = []; let intentOk = 0, amtOk = 0, amtN = 0, custOk = 0, custN = 0, invalid = 0, tokens = 0, errs = 0;
let strict = true;
for (const it of items) {
  let r = await call(it.text, strict);
  if (r.err && /json_schema|strict|response_format/i.test(r.err) && strict) { strict = false; console.log('strict schema rejected, falling back to json_object:', r.err); r = await call(it.text, false); }
  if (r.err) { errs++; console.log(it.id, 'ERR', r.err, 'retry-after', r.retry); await new Promise((s) => setTimeout(s, 10000)); continue; }
  lat.push(r.ms); tokens += r.usage?.total_tokens ?? 0;
  if (!r.out) { invalid++; continue; }
  const x = it.expected;
  if (r.out.intent === x.intent) intentOk++;
  if (x.amount !== undefined) { amtN++; if (r.out.amount === x.amount) amtOk++; }
  if (x.customer) { custN++; if ((r.out.customer ?? '').toLowerCase() === x.customer.toLowerCase()) custOk++; }
  await new Promise((s) => setTimeout(s, 7500)); // stay under 8k tokens/min
}
const n = items.length;
const line = `${model}${effort ? ' effort=' + effort : ''} n=${n} ok=${lat.length} strict=${strict} p50=${(pct(lat, 50) ?? 0).toFixed(0)}ms p95=${(pct(lat, 95) ?? 0).toFixed(0)}ms intent=${intentOk}/${n} amount=${amtOk}/${amtN} customer=${custOk}/${custN} invalid=${invalid} errs=${errs} avgTokens=${(tokens / Math.max(1, lat.length)).toFixed(0)}`;
console.log(line);
mkdirSync('eval/results', { recursive: true });
appendFileSync('eval/results/llm-bench.txt', line + '\n');
