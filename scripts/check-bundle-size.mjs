// I7: fail when the gzipped JS of the phone app grows past the budget. Run after `npm run build`.
// Budget history: 83,000 B was set from the Phase 0 baseline (69,455 B plus 20%). F1 to F9 (profile, PIN, search,
// summaries, edits, WhatsApp reminders, four more languages) took it to about 106 KB, so on 2026-11-22 the budget was
// reset to 112,000 B (about 5% headroom). Raise it again only with a note in docs/progress.md saying what grew.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET = 112_000;
const dir = new URL('../apps/web/dist/assets/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
if (files.length === 0) { console.error('no JS in apps/web/dist/assets: run npm run build first'); process.exit(2); }
let total = 0;
for (const f of files) {
  const n = gzipSync(readFileSync(new URL(f, dir))).length;
  total += n;
  console.log(`${String(n).padStart(8)}  ${f}`);
}
console.log(`${String(total).padStart(8)}  total gzipped JS (budget ${BUDGET})`);
if (total > BUDGET) { console.error(`over budget by ${total - BUDGET} B`); process.exit(1); }
