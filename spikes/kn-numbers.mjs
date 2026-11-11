// Kannada number round trip: Timbre reads ₹N, Prisma (codemix, kn-IN) writes it back as words. Saves pairs for the parser tests.
import { writeFileSync } from 'node:fs';
import { tts, stt, logRun } from './lib.mjs';
const vals = [23, 45, 99, 150, 275, 340, 1500, 2500, 12000, 120000, 200000];
const out = []; let sec = 0;
for (const n of vals) {
  const t = await tts({ text: `ರಮೇಶ್ ಅವರ ₹${n} ಉಧಾರ`, language: 'kn-IN' });
  const r = await stt({ pcm: t.pcm, lang: 'kn-IN', format: 'codemix' });
  sec += (t.pcm.length / 32000) * 2;
  out.push({ n, heard: r.transcript?.text ?? null });
  console.log(n, '->', r.transcript?.text);
}
writeFileSync('spikes/kn-numbers.json', JSON.stringify(out, null, 1));
logRun(`kn-numbers audioSec(tts+stt)=${sec.toFixed(1)}`);
