// T1.3: end-of-speech -> transcript latency, commit vs VAD silence of 300/400/500 ms.
import { readFileSync } from 'node:fs';
import { stt, pct, logRun } from './lib.mjs';
const pcm = readFileSync('eval/audio/t1-hi-340.pcm');
const N = Number(process.argv[2] ?? 5);
const rows = [];
async function series(label, opts) {
  const lat = []; let wrong = 0;
  for (let i = 0; i < N; i++) {
    const r = await stt({ pcm, lang: 'hi-IN', ...opts });
    if (!r.transcript) { wrong++; continue; }
    lat.push(r.recvAt - r.speechEndSent);
    if (!/340|३४०|तीन सौ/.test(r.transcript.text)) wrong++;
  }
  rows.push(`${label.padEnd(14)} n=${lat.length} p50=${pct(lat, 50)} p95=${pct(lat, 95)} ms  bad=${wrong}`);
  console.log(rows.at(-1));
}
await series('commit', { commit: true });
for (const ms of [300, 400, 500]) {
  await series(`vad-${ms}`, { commit: false, tailSilenceMs: ms + 1200, extraHeaders: { 'x-min-silence-ms': String(ms) } });
}
logRun(`vad-vs-commit n=${N}`);
