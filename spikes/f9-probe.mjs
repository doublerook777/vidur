// F9.0: which locales does Gnani support for Tamil, Telugu, Marathi and Gujarati? Round trip: Timbre speaks a test line,
// Prisma (format=codemix, one locale) listens to it. Machine voice only, no real accent. Spends a little: about 2 minutes of audio.
// Usage: node spikes/f9-probe.mjs [ta te mr gu]
import { writeFileSync } from 'node:fs';
import { stt, tts, logRun } from './lib.mjs';

const LINES = {
  ta: ['ரமேஷ் 340 ரூபாய் கடன்', 'ரமேஷ் இரண்டாயிரத்து ஐநூறு ரூபாய் செலுத்தினார்', 'ரமேஷ் ₹2,500 செலுத்தினார்'],
  te: ['రమేష్ 340 రూపాయలు అప్పు', 'రమేష్ రెండు వేల ఐదు వందల రూపాయలు చెల్లించాడు', 'రమేష్ ₹2,500 చెల్లించాడు'],
  mr: ['रमेश 340 रुपये उधार', 'रमेशने दोन हजार पाचशे रुपये जमा केले', 'रमेशने ₹2,500 जमा केले'],
  gu: ['રમેશ 340 રૂપિયા ઉધાર', 'રમેશે બે હજાર પાંચસો રૂપિયા જમા કર્યા', 'રમેશે ₹2,500 જમા કર્યા'],
};
const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LINES);
const results = [];
let audioSec = 0;
for (const lang of which) {
  const code = `${lang}-IN`;
  for (const text of LINES[lang]) {
    const row = { lang: code, text };
    try {
      const t = await tts({ text, language: code });
      row.tts = { ok: t.pcm.length > 0, ttfbMs: Math.round(t.ttfbMs), audioSec: +(t.pcm.length / 32000).toFixed(2) };
      audioSec += t.pcm.length / 32000;
      if (t.pcm.length > 0) {
        const s = await stt({ pcm: t.pcm, lang: code, format: 'codemix', tailSilenceMs: 300 });
        audioSec += (t.pcm.length + 9600) / 32000;
        row.stt = s.transcript ? { text: s.transcript.text ?? s.transcript.output?.text ?? JSON.stringify(s.transcript).slice(0, 200), detected: s.transcript.detected_language_code ?? null } : { error: s.error ?? (s.timeout ? 'timeout' : 'no transcript') };
      }
    } catch (e) {
      row.error = String(e.message ?? e).slice(0, 200);
    }
    results.push(row);
    console.log(JSON.stringify(row));
  }
}
logRun(`f9-probe langs=${which.join(',')} audioSec=${audioSec.toFixed(1)}`);
writeFileSync(new URL('./f9-probe.last.json', import.meta.url), JSON.stringify(results, null, 1));
console.log(`audio about ${audioSec.toFixed(0)} s`);
