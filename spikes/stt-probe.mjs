// T1.1: stream a PCM file to Prisma, log every message. Usage: node spikes/stt-probe.mjs file.pcm [lang] [format]
import { readFileSync } from 'node:fs';
import { stt, logRun } from './lib.mjs';
const [file, lang = 'hi-IN', format = 'transcribe'] = process.argv.slice(2);
const pcm = readFileSync(file);
const r = await stt({ pcm, lang, format });
for (const m of r.log) console.log(JSON.stringify(m).slice(0, 300));
if (r.transcript) console.log(`commit->transcript: ${r.recvAt - r.sentEnd} ms (sentEnd ${r.sentEnd}, recv ${r.recvAt})`);
logRun(`stt-probe audioSec=${(pcm.length / 32000).toFixed(1)} lang=${lang} format=${format}`);
