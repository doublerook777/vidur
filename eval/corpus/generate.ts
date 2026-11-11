/**
 * Eval corpus generator. DRY-RUN ONLY for now: --dry-run (the default) writes
 * eval/corpus/manifest.json with no network and no audio. --live would synthesize
 * speech with the real TTS endpoint and is never run by automation.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NOISE_LICENCES } from './noise.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(dirname(HERE));
const GOLDEN_PATH = join(REPO_ROOT, 'eval', 'golden', 'utterances.jsonl');
const MANIFEST_PATH = join(HERE, 'manifest.json');

export interface GoldenRow {
  id: string;
  lang: 'hi' | 'en' | 'kn' | 'hinglish';
  text: string;
  expected: { intent: string; amount?: number; customer?: string; item?: string; date?: string };
}

export interface VariantPlan {
  id: string;
  itemId: string;
  lang: GoldenRow['lang'];
  voice: string;
  /** 'clean' for the unmixed variant, otherwise the SNR in dB. */
  snr: 'clean' | 15 | 10 | 5;
  noise: 'none' | 'pink' | 'shopHum' | 'babble';
  noiseSeed: number | null;
  text: string;
  expected: GoldenRow['expected'];
  file: string;
}

export interface CorpusManifest {
  generatedAt: 'dry-run' | 'live';
  noiseLicences: Record<string, string>;
  counts: {
    items: number;
    variants: number;
    perLang: Record<string, number>;
    perSnr: Record<string, number>;
  };
  variants: VariantPlan[];
}

const VOICES = ['Avinash', 'Shivani'] as const;
const TTS_LANGUAGE: Record<GoldenRow['lang'], string> = {
  hi: 'hi-en',
  hinglish: 'hi-en',
  en: 'auto',
  kn: 'kn-IN',
};
const NOISE_ROTATION = ['pink', 'shopHum', 'babble'] as const;
const SNR_VARIANTS = [15, 10, 5] as const;
const SELECTION_SEED = 7;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}

export function readGolden(path = GOLDEN_PATH): GoldenRow[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as GoldenRow);
}

/** Pick 60 items deterministically (seed 7): 15 per language, preferring amount-bearing credit/payment rows. */
export function selectItems(rows: GoldenRow[], seed = SELECTION_SEED): GoldenRow[] {
  const perLang: Record<string, GoldenRow[]> = { hi: [], hinglish: [], en: [], kn: [] };
  for (const row of rows) {
    (perLang[row.lang] ??= []).push(row);
  }

  const picked: GoldenRow[] = [];
  for (const lang of ['hi', 'hinglish', 'en', 'kn'] as const) {
    const candidates = perLang[lang] ?? [];
    const withAmount = shuffled(
      candidates.filter((r) => (r.expected.intent === 'credit_entry' || r.expected.intent === 'payment') && r.expected.amount !== undefined),
      seed + lang.length,
    );
    const refusals = shuffled(
      candidates.filter((r) => r.expected.intent === 'refusal'),
      seed + 1000 + lang.length,
    );
    const rest = shuffled(candidates, seed + 2000 + lang.length);

    const bucket: GoldenRow[] = [];
    const take = (from: GoldenRow[], n: number): void => {
      for (const row of from) {
        if (bucket.length >= 15) break;
        if (n > 0 && !bucket.includes(row)) {
          bucket.push(row);
          n -= 1;
        }
      }
    };
    take(withAmount, 13);
    take(refusals, 2);
    // top up from the rest if a language has fewer than 13 amount-bearing rows
    take(rest, 15);
    picked.push(...bucket.slice(0, 15));
  }
  return picked;
}

/** Build the full variant plan: 60 items × 4 variants (clean, snr 15/10/5) = 240. */
export function buildPlan(rows: GoldenRow[] = readGolden()): CorpusManifest {
  const items = selectItems(rows);
  const variants: VariantPlan[] = [];

  items.forEach((item, i) => {
    const voice = VOICES[i % VOICES.length]!;
    const baseId = `C-${String(i + 1).padStart(4, '0')}`;

    variants.push({
      id: `${baseId}__${voice}__clean`,
      itemId: item.id,
      lang: item.lang,
      voice,
      snr: 'clean',
      noise: 'none',
      noiseSeed: null,
      text: item.text,
      expected: item.expected,
      file: `eval/audio/corpus/${baseId}__${voice}__clean.pcm`,
    });

    SNR_VARIANTS.forEach((snr, j) => {
      const noise = NOISE_ROTATION[(i + j) % NOISE_ROTATION.length]!;
      const noiseSeed = SELECTION_SEED * 100000 + i * 100 + j;
      variants.push({
        id: `${baseId}__${voice}__snr${snr}`,
        itemId: item.id,
        lang: item.lang,
        voice,
        snr,
        noise,
        noiseSeed,
        text: item.text,
        expected: item.expected,
        file: `eval/audio/corpus/${baseId}__${voice}__snr${snr}.pcm`,
      });
    });
  });

  const perLang: Record<string, number> = { hi: 0, hinglish: 0, en: 0, kn: 0 };
  const perSnr: Record<string, number> = { clean: 0, '15': 0, '10': 0, '5': 0 };
  for (const v of variants) {
    perLang[v.lang] = (perLang[v.lang] ?? 0) + 1;
    perSnr[String(v.snr)] = (perSnr[String(v.snr)] ?? 0) + 1;
  }

  return {
    generatedAt: 'dry-run',
    noiseLicences: { ...NOISE_LICENCES },
    counts: { items: items.length, variants: variants.length, perLang, perSnr },
    variants,
  };
}

/** LIVE ONLY — never called by the dry-run path or by tests. Synthesizes and mixes real audio (spends TTS credits). */
async function buildLive(): Promise<CorpusManifest> {
  const plan = buildPlan();
  const { pink, shopHum, babble } = await import('./noise.js');
  const { mixAtSnr } = await import('./mix.js');
  // @ts-expect-error live-only import of a plain .mjs spike; never loaded by dry-run or tests
  const { tts } = (await import('../../spikes/lib.mjs')) as {
    tts(opts: { text: string; voice?: string; language?: string; speed?: number }): Promise<{ pcm: Buffer }>;
  };

  const audioDir = join(REPO_ROOT, 'eval', 'audio', 'corpus');
  mkdirSync(audioDir, { recursive: true });

  // Synthesize each unique item once (cache by itemId).
  const speechByItem = new Map<string, Int16Array>();
  for (const item of plan.variants) {
    if (speechByItem.has(item.itemId)) continue;
    const res = await tts({ text: item.text, voice: item.voice, language: TTS_LANGUAGE[item.lang], speed: 1 });
    const samples = new Int16Array(res.pcm.buffer.slice(res.pcm.byteOffset, res.pcm.byteOffset + res.pcm.byteLength));
    speechByItem.set(item.itemId, samples);
  }

  for (const v of plan.variants) {
    const speech = speechByItem.get(v.itemId)!;
    let samples = speech;
    if (v.snr !== 'clean') {
      const seconds = speech.length / 16000;
      let noise: Int16Array;
      if (v.noise === 'pink') noise = pink(seconds, v.noiseSeed!);
      else if (v.noise === 'shopHum') noise = shopHum(seconds, v.noiseSeed!);
      else {
        // babble from OTHER items' synthesized speech
        const others = [...speechByItem.entries()].filter(([id]) => id !== v.itemId).map(([, s]) => s);
        noise = babble(others, seconds, v.noiseSeed!);
      }
      samples = mixAtSnr(speech, noise, v.snr);
    }
    writeFileSync(join(REPO_ROOT, v.file), Buffer.from(samples.buffer));
  }
  plan.generatedAt = 'live';
  return plan;
}

async function main(): Promise<void> {
  const live = process.argv.includes('--live');
  const plan = live ? await buildLive() : buildPlan();
  writeFileSync(MANIFEST_PATH, JSON.stringify(plan, null, 2) + '\n');
  console.log(`manifest written to ${MANIFEST_PATH} (${plan.counts.variants} variants, generatedAt=${plan.generatedAt})`);
}

const invokedDirectly = (process.argv[1] ?? '').replace(/\\/g, '/').endsWith('eval/corpus/generate.ts');

if (invokedDirectly) {
  void main();
}
