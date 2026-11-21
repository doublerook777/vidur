// F7 round 2: Timbre speaks a test line, Prisma transcribes it (every third line with 10 dB white noise), the core parser reads it.
// Machine voice only: no real accent, no speaker has heard any of it. Synthetic names and amounts.
// Result codes (references/test-campaign.md, local notes): R right, A asked correctly (read-back or question, never a wrong amount), W wrong.
// A silent wrong amount (wrong amount or direction saved without a question) is a P0.
// Usage: node spikes/f7-round2.mjs [hi hinglish en kn]   (spends roughly 20 to 60 credits)
import { writeFileSync } from 'node:fs';
import { stt, tts, logRun } from './lib.mjs';
import { interpret } from '../packages/core/dist/index.js';

const C = 'credit_entry', P = 'payment';
const LINES = {
  hi: [
    ['मोहन का तीन सौ चालीस रुपये उधार', 340, C], ['सुनीता ने दो सौ रुपये जमा किए', 200, P], ['रमेश का डेढ़ सौ रुपये उधार', 150, C],
    ['कविता का साढ़े तीन सौ रुपये उधार', 350, C], ['अनिल का दो हज़ार पाँच सौ रुपये उधार', 2500, C], ['विजय ने डेढ़ हज़ार रुपये दिए', 1500, P],
    ['मोहन का बारह हज़ार रुपये उधार', 12000, C], ['सुनीता का पच्चीस रुपये उधार', 25, C], ['दिनेश का पचहत्तर रुपये उधार', 75, C],
    ['मोहन ने कल पाँच सौ रुपये जमा किए', 500, P], ['अनिल का एक लाख रुपये उधार', 100000, C], ['रमेश का अस्सी रुपये उधार', 80, C],
  ],
  hinglish: [
    ['Mohan ka teen sau chalis rupaye udhaar', 340, C], ['Sunita ne do sau rupaye jama kiye', 200, P], ['Ramesh ka dedh sau rupaye udhaar', 150, C],
    ['Kavita ka saade teen sau rupaye udhaar', 350, C], ['Anil ka do hazaar paanch sau rupaye udhaar', 2500, C], ['Vijay ne dedh hazaar rupaye diye', 1500, P],
    ['Mohan ka paanch sau rupaye udhaar', 500, C], ['Sunita ka sattar rupaye udhaar', 70, C], ['Dinesh ka paintalis rupaye udhaar', 45, C],
    ['Ramesh ne kal sau rupaye jama kiye', 100, P], ['Anil ka dhai sau rupaye udhaar', 250, C], ['Mohan ka ek hazaar do sau rupaye udhaar', 1200, C],
  ],
  en: [
    ['Mohan owes three hundred and forty rupees', 340, C], ['Sunita paid two hundred rupees', 200, P], ['Ramesh took one hundred and fifty rupees on credit', 150, C],
    ['Kavita owes two thousand five hundred rupees', 2500, C], ['Anil paid fifteen hundred rupees', 1500, P], ['Vijay owes twelve thousand rupees', 12000, C],
    ['Mohan owes eighty rupees', 80, C], ['Sunita paid five hundred rupees yesterday', 500, P], ['Dinesh owes seventy five rupees', 75, C],
    ['Ramesh owes one lakh rupees', 100000, C], ['Anil paid two hundred and fifty rupees', 250, P], ['Mohan owes four hundred and ten rupees', 410, C],
  ],
  kn: [
    ['ಮೋಹನ್ ಮುನ್ನೂರು ನಲವತ್ತು ರೂಪಾಯಿ ಉಧಾರ', 340, C], ['ಸುನೀತಾ ಇನ್ನೂರು ರೂಪಾಯಿ ಕೊಟ್ಟರು', 200, P], ['ರಮೇಶ್ ನೂರ ಐವತ್ತು ರೂಪಾಯಿ ಉಧಾರ', 150, C],
    ['ಕವಿತಾ ಎರಡು ಸಾವಿರ ಐದು ನೂರು ರೂಪಾಯಿ ಉಧಾರ', 2500, C], ['ಅನಿಲ್ ಒಂದು ಸಾವಿರ ಐದು ನೂರು ರೂಪಾಯಿ ಕೊಟ್ಟರು', 1500, P], ['ವಿಜಯ್ ಹನ್ನೆರಡು ಸಾವಿರ ರೂಪಾಯಿ ಉಧಾರ', 12000, C],
    ['ಮೋಹನ್ ಎಂಬತ್ತು ರೂಪಾಯಿ ಉಧಾರ', 80, C], ['ಸುನೀತಾ ಐದು ನೂರು ರೂಪಾಯಿ ಕೊಟ್ಟರು', 500, P], ['ದಿನೇಶ್ ಎಪ್ಪತ್ತೈದು ರೂಪಾಯಿ ಉಧಾರ', 75, C],
    ['ರಮೇಶ್ ಒಂದು ಲಕ್ಷ ರೂಪಾಯಿ ಉಧಾರ', 100000, C], ['ಅನಿಲ್ ಇನ್ನೂರ ಐವತ್ತು ರೂಪಾಯಿ ಕೊಟ್ಟರು', 250, P], ['ಮೋಹನ್ ನಾಲ್ಕು ನೂರು ಹತ್ತು ರೂಪಾಯಿ ಉಧಾರ', 410, C],
  ],
};
const TTS_LANG = { hi: 'hi-en', hinglish: 'hi-en', en: 'en-IN', kn: 'kn-IN' };
const STT_LANG = { hi: 'hi-IN', hinglish: 'hi-IN', en: 'en-IN', kn: 'kn-IN' };
const CORE_LANG = { hi: 'hi', hinglish: 'hi', en: 'en', kn: 'kn' };

function addNoise(pcm, snrDb) {
  const n = pcm.length / 2;
  let sum = 0;
  for (let i = 0; i < n; i++) { const v = pcm.readInt16LE(i * 2); sum += v * v; }
  const rms = Math.sqrt(sum / n) || 1;
  const sigma = rms / Math.pow(10, snrDb / 20);
  const out = Buffer.alloc(pcm.length);
  for (let i = 0; i < n; i++) {
    const g = Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random()); // gaussian
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm.readInt16LE(i * 2) + g * sigma))), i * 2);
  }
  return out;
}

const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LINES);
const rows = [];
let audioSec = 0;
for (const grp of which) {
  let i = 0;
  for (const [text, want, wantIntent] of LINES[grp]) {
    i += 1;
    const noisy = i % 3 === 0;
    const row = { id: `${grp}-${String(i).padStart(2, '0')}`, grp, noise: noisy ? '10 dB' : 'clean', said: text, want, wantIntent };
    try {
      const t = await tts({ text, language: TTS_LANG[grp] });
      audioSec += t.pcm.length / 32000;
      const pcm = noisy ? addNoise(t.pcm, 10) : t.pcm;
      const s = await stt({ pcm, lang: STT_LANG[grp], format: 'codemix', tailSilenceMs: 300 });
      audioSec += (pcm.length + 9600) / 32000;
      const heard = s.transcript ? (s.transcript.text ?? s.transcript.output?.text ?? '') : '';
      row.heard = heard;
      const ev = interpret(heard, { lang: CORE_LANG[grp] }).events[0];
      row.intent = ev?.intent ?? null;
      row.got = ev?.amountPaise != null ? ev.amountPaise / 100 : null;
      row.needs = ev?.needs ?? [];
      const asked = !ev || row.needs.length > 0 || row.got === null;
      const right = row.intent === wantIntent && row.got === want;
      if (right && !(want >= 10000 && !row.needs.includes('amount_confirm'))) row.result = 'R';
      else if (asked && (row.got === null || row.got === want) && (row.intent === wantIntent || row.needs.includes('direction'))) row.result = 'A';
      else row.result = 'W';
      row.silent = row.result === 'W' && !asked; // a wrong entry that would be saved without a question
    } catch (e) { row.result = 'E'; row.error = String(e.message ?? e).slice(0, 120); }
    rows.push(row);
    console.log(JSON.stringify({ id: row.id, noise: row.noise, said: row.said, heard: row.heard, intent: row.intent, got: row.got, needs: row.needs, result: row.result, silent: row.silent }));
  }
}
const n = (v) => rows.filter((r) => r.result === v).length;
const silent = rows.filter((r) => r.silent).length;
console.log(`R ${n('R')} A ${n('A')} W ${n('W')} E ${n('E')} of ${rows.length}; silent wrong ${silent}; audio about ${audioSec.toFixed(0)} s`);
logRun(`f7-round2 groups=${which.join(',')} audioSec=${audioSec.toFixed(1)} R=${n('R')} A=${n('A')} W=${n('W')} silent=${silent}`);
writeFileSync(new URL('./f7-round2.last.json', import.meta.url), JSON.stringify(rows, null, 1));
