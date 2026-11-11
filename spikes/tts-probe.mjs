// T1.2: one TTS call, save wav and time to first chunk. Usage: node spikes/tts-probe.mjs "<text>" out.pcm [runs]
import { writeFileSync } from 'node:fs';
import { tts, wavHeader, pct, logRun } from './lib.mjs';
const [text, out, runsArg] = process.argv.slice(2);
const runs = Number(runsArg ?? 1);
const ttfbs = [];
let last;
for (let i = 0; i < runs; i++) {
  last = await tts({ text });
  ttfbs.push(last.ttfbMs);
  console.log(`run ${i + 1}: ttfb ${last.ttfbMs.toFixed(0)} ms, total ${last.totalMs.toFixed(0)} ms, ${last.chunks} chunks, ${last.pcm.length} bytes (${(last.pcm.length / 32000).toFixed(2)} s audio), msgs ${[...new Set(last.msgs)].join('>')}`);
}
if (runs > 1) console.log(`ttfb p50 ${pct(ttfbs, 50).toFixed(0)} p95 ${pct(ttfbs, 95).toFixed(0)}`);
writeFileSync(out, last.pcm);
writeFileSync(out.replace(/\.pcm$/, '.wav'), Buffer.concat([wavHeader(last.pcm.length), last.pcm]));
logRun(`tts-probe runs=${runs} chars=${text.length} audioSec=${(last.pcm.length / 32000 * runs).toFixed(1)}`);
