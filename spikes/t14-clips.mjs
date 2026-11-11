// T1.4 step 1: synthesize 20 number-heavy clips (synthetic names). Usage: node spikes/t14-clips.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { tts, logRun } from './lib.mjs';
export const CLIPS = [
  ['रमेश का तीन सौ चालीस रुपये उधार', 340, 'hi-en'],
  ['सुनीता ने डेढ़ सौ रुपये जमा किए', 150, 'hi-en'],
  ['कविता का ढाई हज़ार उधार लिखो', 2500, 'hi-en'],
  ['महेश को सवा दो सौ रुपये का उधार', 225, 'hi-en'],
  ['अनिल का पौने तीन सौ रुपये बाकी है', 275, 'hi-en'],
  ['गीता ने साढ़े तीन सौ रुपये वापस दिए', 350, 'hi-en'],
  ['सुरेश का एक लाख बीस हज़ार का हिसाब', 120000, 'hi-en'],
  ['पूजा का सात सौ पचास रुपये उधार', 750, 'hi-en'],
  ['विजय ने चार सौ निन्यानवे रुपये दिए', 499, 'hi-en'],
  ['नेहा का बारह सौ रुपये उधार', 1200, 'hi-en'],
  ['Ramesh ka teen sau chalis rupaye udhaar', 340, 'hi-en'],
  ['Sunita ne dedh sau rupaye jama kiye', 150, 'hi-en'],
  ['Kavita ka dhai hazaar udhaar likho', 2500, 'hi-en'],
  ['Mahesh ko sawa do sau ka udhaar', 225, 'hi-en'],
  ['Anil ka paune teen sau baaki hai', 275, 'hi-en'],
  ['Ramesh took three hundred and forty rupees on credit', 340, 'auto'],
  ['Sunita paid back one thousand five hundred rupees', 1500, 'auto'],
  ['Kavita owes two lakh rupees', 200000, 'auto'],
  ['दिनेश का आठ सौ पैंतीस रुपये उधार दो', 835, 'hi-en'],
  ['राधा ने पंद्रह सौ रुपये चुकाए', 1500, 'hi-en'],
];
if (process.argv[1]?.endsWith('t14-clips.mjs')) {
  mkdirSync('eval/audio/t14', { recursive: true });
  let sec = 0;
  for (let i = 0; i < CLIPS.length; i++) {
    const [text, , language] = CLIPS[i];
    const r = await tts({ text, language });
    writeFileSync(`eval/audio/t14/c${String(i).padStart(2, '0')}.pcm`, r.pcm);
    sec += r.pcm.length / 32000;
  }
  console.log(`20 clips, ${sec.toFixed(1)} s of audio`);
  logRun(`t14-clips tts audioSec=${sec.toFixed(1)}`);
}
