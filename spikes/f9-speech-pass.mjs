// F9.3 synthetic speech pass: Timbre speaks a test line, Prisma transcribes it, the core parser reads the transcript.
// Tests the parser against real STT output; machine voice only, no real accent, no native speaker has heard any of it.
// Pass line: no line comes back as a different amount than the one spoken (an unread amount is fine, the app asks).
// Usage: node spikes/f9-speech-pass.mjs [ta te mr gu]   (spends about 30 credits)
import { writeFileSync } from 'node:fs';
import { stt, tts, logRun } from './lib.mjs';
import { interpret } from '../packages/core/dist/index.js';

const LINES = {
  ta: [['ரமேஷ் முன்னூற்று நாற்பது ரூபாய் கடன்', 340], ['ரமேஷ் இரண்டாயிரத்து ஐநூறு ரூபாய் செலுத்தினார்', 2500], ['ரமேஷ் ஆயிரத்து ஐநூறு ரூபாய் கடன்', 1500], ['ரமேஷ் மூன்றாயிரத்து ஐந்நூறு ரூபாய் கடன்', 3500], ['ரமேஷ் ₹500 கடன்', 500], ['ரமேஷ் ஐநூறு ரூபாய் செலுத்தினார்', 500]],
  te: [['రమేష్ మూడు వందల నలభై రూపాయలు అప్పు', 340], ['రమేష్ రెండు వేల ఐదు వందల రూపాయలు చెల్లించాడు', 2500], ['రమేష్ వెయ్యి ఐదు వందల రూపాయలు అప్పు', 1500], ['రమేష్ మూడు వేల ఐదు వందల రూపాయలు అప్పు', 3500], ['రమేష్ ₹500 అప్పు', 500], ['రమేష్ ఐదు వందల రూపాయలు చెల్లించాడు', 500]],
  mr: [['रमेश तीनशे चाळीस रुपये उधार', 340], ['रमेशने दोन हजार पाचशे रुपये जमा केले', 2500], ['रमेश दीड हजार रुपये उधार', 1500], ['रमेश साडेतीन हजार रुपये उधार', 3500], ['रमेश ₹500 उधार', 500], ['रमेशने पाचशे रुपये जमा केले', 500]],
  gu: [['રમેશ ત્રણસો ચાલીસ રૂપિયા ઉધાર', 340], ['રમેશે બે હજાર પાંચસો રૂપિયા જમા કર્યા', 2500], ['રમેશ દોઢ હજાર રૂપિયા ઉધાર', 1500], ['રમેશ સાડા ત્રણ હજાર રૂપિયા ઉધાર', 3500], ['રમેશ ₹500 ઉધાર', 500], ['રમેશે પાંચસો રૂપિયા જમા કર્યા', 500]],
};
const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LINES);
const rows = [];
let audioSec = 0;
for (const lang of which) {
  for (const [text, want] of LINES[lang]) {
    const row = { lang, want };
    try {
      const t = await tts({ text, language: `${lang}-IN` });
      audioSec += t.pcm.length / 32000;
      const s = await stt({ pcm: t.pcm, lang: `${lang}-IN`, format: 'codemix', tailSilenceMs: 300 });
      audioSec += (t.pcm.length + 9600) / 32000;
      const heard = s.transcript ? (s.transcript.text ?? s.transcript.output?.text ?? '') : '';
      row.heard = heard;
      const ev = interpret(heard, { lang }).events[0];
      row.got = ev?.amountPaise != null ? ev.amountPaise / 100 : null;
      row.conf = ev?.amountConfidence ?? null;
      row.verdict = row.got === want ? 'ok' : row.got === null ? 'unread' : 'WRONG';
    } catch (e) { row.verdict = 'error'; row.error = String(e.message ?? e).slice(0, 120); }
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
const n = (v) => rows.filter((r) => r.verdict === v).length;
console.log(`ok ${n('ok')} unread ${n('unread')} WRONG ${n('WRONG')} error ${n('error')} of ${rows.length}; audio about ${audioSec.toFixed(0)} s`);
logRun(`f9-speech-pass langs=${which.join(',')} audioSec=${audioSec.toFixed(1)} ok=${n('ok')} unread=${n('unread')} wrong=${n('WRONG')}`);
writeFileSync(new URL('./f9-speech-pass.last.json', import.meta.url), JSON.stringify(rows, null, 1));
