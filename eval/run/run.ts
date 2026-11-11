/**
 * Runs the audio corpus through real Prisma and the deterministic parser, and writes one JSONL record per variant.
 * Spends credits (audio seconds of STT). Usage:
 *   npx tsx eval/run/run.ts --label base [--snr clean,10] [--lang hi,hinglish] [--limit 20] [--concurrency 3]
 *        [--vad-threshold 0.7] [--min-silence 500] [--keyterms] [--format codemix] --yes
 * Without --yes it only prints the plan and the estimated audio seconds.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { interpret } from '../../packages/core/src/index.ts';
// @ts-expect-error plain JS helper shared with the spikes
import { stt } from '../../spikes/lib.mjs';

interface Variant { id: string; itemId: string; lang: 'hi' | 'hinglish' | 'en' | 'kn'; voice: string; snr: number | 'clean'; text: string; expected: Record<string, unknown>; file: string }

const arg = (k: string, d?: string): string | undefined => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? (process.argv[i + 1]?.startsWith('--') ? 'true' : process.argv[i + 1] ?? 'true') : d;
};
const has = (k: string): boolean => process.argv.includes(`--${k}`);

const label = arg('label', 'run')!;
const manifest = JSON.parse(readFileSync('eval/corpus/manifest.json', 'utf8')) as { variants: Variant[] };
let vs = manifest.variants.filter((v) => existsSync(v.file));
const snrs = arg('snr')?.split(',');
if (snrs) vs = vs.filter((v) => snrs.includes(String(v.snr)));
const langs = arg('lang')?.split(',');
if (langs) vs = vs.filter((v) => langs.includes(v.lang));
const limit = Number(arg('limit', '0'));
if (limit) vs = vs.slice(0, limit);

const bytes = vs.reduce((n, v) => n + readFileSync(v.file).length, 0);
const seconds = bytes / 32000;
console.log(`${vs.length} variants, ${seconds.toFixed(0)} s of audio (about ${(seconds / 60 * 15).toFixed(0)} credits at the budget rate of 15 per minute)`);
if (!has('yes')) { console.log('Dry run. Add --yes to spend the credits.'); process.exit(0); }

const NOW = Date.UTC(2026, 10, 11, 6, 30);
const CODE: Record<string, string> = { hi: 'hi-IN', hinglish: 'hi-IN', en: 'en-IN', kn: 'kn-IN' };
const NAMES = ['Ramesh', 'Sunita', 'Kavita', 'Mohan', 'Suresh', 'Anil', 'Geeta', 'Pooja', 'Vijay', 'Neha', 'Dinesh', 'Radha', 'Mahesh', 'Lakshmi', 'Manoj', 'Fatima', 'Rahul', 'Deepa', 'Imran', 'Arjun', 'Meena', 'Sanjay', 'Ajay', 'Kavya'];
const extra: Record<string, string> = {};
if (arg('vad-threshold')) extra['x-vad-threshold'] = arg('vad-threshold')!;
extra['x-min-silence-ms'] = arg('min-silence', '1500')!;
if (has('keyterms')) extra['keyterms'] = [...NAMES, 'udhaar', 'jama', 'baaki', 'khata', 'rupaye', 'hazaar', 'lakh'].join(',');
const format = arg('format', 'codemix')!;

mkdirSync('eval/results/raw', { recursive: true });
const out = `eval/results/raw/${label}.jsonl`;
writeFileSync(out, '');
let done = 0;
const queue = [...vs];
async function worker(): Promise<void> {
  while (queue.length) {
    const v = queue.shift()!;
    const pcm = readFileSync(v.file);
    let rec: Record<string, unknown>;
    try {
      // This machine's network drops now and then (DNS lookups fail), so connection errors are retried and never scored.
      let r: { transcript?: { text: string }; recvAt: number; sentEnd: number; timeout?: boolean; closed?: boolean; error?: { message?: string } } | undefined;
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          r = await stt({ pcm, lang: CODE[v.lang], format, extraHeaders: extra });
          if (r.transcript || (!r.timeout && !r.closed)) break;
        } catch (e) {
          if (!/EAI_AGAIN|ECONN|ETIMEDOUT|ENOTFOUND|socket|stt http (5|429)/i.test(String(e))) throw e;
        }
        await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      }
      if (!r) throw new Error('network unavailable after 6 attempts');
      const heard: string = r.transcript?.text ?? '';
      const it = heard ? interpret(heard, { nowMs: NOW, customers: NAMES.map((n, i) => ({ id: String(i), name: n, aliases: [] })) }) : null;
      const ev = it?.events[0];
      rec = {
        id: v.id, lang: v.lang, voice: v.voice, snr: v.snr, expected: v.expected, heard,
        got: ev ? { intent: ev.intent, amountPaise: ev.amountPaise, needs: ev.needs, customer: ev.customerSpoken } : null,
        sttMs: r.transcript ? r.recvAt - r.sentEnd : null, needsLlm: it?.needsLlm ?? null, error: r.error?.message ?? null,
      };
    } catch (e) {
      rec = { id: v.id, lang: v.lang, voice: v.voice, snr: v.snr, expected: v.expected, heard: '', got: null, sttMs: null, error: String(e).slice(0, 100) };
    }
    appendFileSync(out, JSON.stringify(rec) + '\n');
    if (++done % 20 === 0) console.log(`${done}/${vs.length}`);
  }
}
await Promise.all(Array.from({ length: Number(arg('concurrency', '3')) }, worker));
appendFileSync('spikes/runs.log', `${new Date().toISOString()} eval-run label=${label} audioSec=${seconds.toFixed(0)}\n`);
console.log(`wrote ${out}`);
