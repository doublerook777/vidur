// T1.4 step 2: STT accuracy on the 20 clips across format and language settings.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { stt, pct, logRun } from './lib.mjs';
import { CLIPS } from './t14-clips.mjs';
const CONFIGS = [
  ['hi-IN/transcribe', 'hi-IN', 'transcribe'],
  ['hi-IN/codemix', 'hi-IN', 'codemix'],
  ['hi-IN/verbatim', 'hi-IN', 'verbatim'],
  ['indic-auto/transcribe', 'indic-auto', 'transcribe'],
  ['hi-IN,en-IN/transcribe', 'hi-IN,en-IN', 'transcribe'],
];
const DIG = { '०': 0, '१': 1, '२': 2, '३': 3, '४': 4, '५': 5, '६': 6, '७': 7, '८': 8, '९': 9 };
function nums(t) {
  const s = t.replace(/[०-९]/g, (c) => DIG[c]).replace(/(\d),(\d)/g, '$1$2');
  return (s.match(/\d+/g) ?? []).map(Number);
}
const results = [];
let sec = 0;
async function pool(jobs, n) { const q = [...jobs]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) await q.shift()(); })); }
const jobs = [];
for (const [label, lang, format] of CONFIGS) {
  for (let i = 0; i < CLIPS.length; i++) {
    jobs.push(async () => {
      const pcm = readFileSync(`eval/audio/t14/c${String(i).padStart(2, '0')}.pcm`);
      sec += pcm.length / 32000;
      try {
        const r = await stt({ pcm, lang, format });
        const text = r.transcript?.text ?? '';
        results.push({ label, clip: i, expected: CLIPS[i][1], text, ok: nums(text).includes(CLIPS[i][1]), lat: r.transcript ? r.recvAt - r.sentEnd : null, err: r.error?.message ?? r.error?.code ?? null });
      } catch (e) { results.push({ label, clip: i, expected: CLIPS[i][1], text: '', ok: false, lat: null, err: String(e.message) }); }
    });
  }
}
await pool(jobs, 3);
mkdirSync('eval/results/raw', { recursive: true });
writeFileSync('eval/results/raw/t14.json', JSON.stringify(results, null, 1));
for (const [label] of CONFIGS) {
  const rs = results.filter((r) => r.label === label);
  const lat = rs.map((r) => r.lat).filter((x) => x != null);
  console.log(`${label.padEnd(24)} digits-correct ${rs.filter((r) => r.ok).length}/${rs.length}  errors ${rs.filter((r) => r.err).length}  commit->transcript p50 ${pct(lat, 50)} p95 ${pct(lat, 95)} ms`);
}
logRun(`t14-run stt audioSec=${sec.toFixed(1)}`);
