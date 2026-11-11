// T1.5: pre-roll burst, mid-session keyterms, concurrent sessions, how Timbre reads amounts, Kannada.
import WebSocket from 'ws';
import { env, stt, tts, logRun } from './lib.mjs';
const key = env().GNANI_API_KEY;
let sttSec = 0, ttsSec = 0;
const raw = (headers) => new WebSocket('wss://api.vachana.ai/stt/v3/stream', { headers: { 'x-api-key-id': key, model: 'prisma-v3.0', language_code: 'hi-IN', format: 'codemix', 'x-sample-rate': '16000', ...headers } });

// 2. keyterms: header at connect, and update_settings mid-session
{
  const ws = raw({ keyterms: 'Ramesh,Sunita' }); const out = [];
  await new Promise((resolve) => {
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); out.push(JSON.stringify(m).slice(0, 220)); });
    ws.on('unexpected-response', (_q, r) => { out.push('HTTP ' + r.statusCode); resolve(); });
    ws.on('error', (e) => { out.push('ERR ' + e.message); resolve(); });
    ws.on('open', () => setTimeout(() => ws.send(JSON.stringify({ type: 'update_settings', bias: ['कविता', 'महेश'] })), 400));
    setTimeout(() => { ws.close(); resolve(); }, 2500);
  });
  console.log('2 keyterms header + mid-session update_settings ->'); out.forEach((o) => console.log('   ' + o));
}

// 3. concurrent connections without audio
{
  const socks = []; const res = [];
  await Promise.all(Array.from({ length: 6 }, (_, i) => new Promise((resolve) => {
    const ws = raw({}); socks.push(ws);
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); if (m.type === 'connected') { res[i] = 'connected'; resolve(); } else if (m.type === 'error') { res[i] = 'error ' + (m.message ?? m.code); resolve(); } });
    ws.on('unexpected-response', (_q, r) => { res[i] = 'HTTP ' + r.statusCode; resolve(); });
    ws.on('error', (e) => { res[i] = 'ERR ' + e.message; resolve(); });
    setTimeout(resolve, 6000);
  })));
  socks.forEach((s) => s.close());
  console.log('3 six concurrent STT connections ->', res.join(', '));
}

// 4. how Timbre reads amounts (round trip through STT codemix)
const say = [
  ['रमेश का ₹340 उधार', 'hi-en'], ['रमेश का 340 रुपये उधार', 'hi-en'], ['Ramesh ka 340 rupaye udhaar', 'hi-en'],
  ['Ramesh ka teen sau chalis rupaye udhaar', 'hi-en'], ['सुरेश का ₹1,20,000 बाकी है', 'hi-en'], ['सुनीता ₹2500 जमा', 'hi-en'], ['Total ₹340 hai', 'hi-en'],
];
console.log('4 Timbre reading, heard back through STT codemix:');
for (const [text, language] of say) {
  const t = await tts({ text, language }); ttsSec += t.pcm.length / 32000;
  const r = await stt({ pcm: t.pcm, lang: 'hi-IN', format: 'codemix' }); sttSec += t.pcm.length / 32000;
  console.log(`   "${text}" -> "${r.transcript?.text}"`);
}

// 5. Kannada
console.log('5 Kannada:');
for (const [text, language, voice] of [['ರಮೇಶ್ ಅವರ ಮುನ್ನೂರ ನಲವತ್ತು ರೂಪಾಯಿ ಉಧಾರ', 'kn-IN', 'Avinash'], ['ರಮೇಶ್ ಅವರ ಮುನ್ನೂರ ನಲವತ್ತು ರೂಪಾಯಿ ಉಧಾರ', 'auto', 'Avinash']]) {
  try {
    const t = await tts({ text, language, voice }); ttsSec += t.pcm.length / 32000;
    const r = await stt({ pcm: t.pcm, lang: 'kn-IN', format: 'codemix' }); sttSec += t.pcm.length / 32000;
    console.log(`   tts ${language}/${voice} ok (${(t.pcm.length / 32000).toFixed(1)} s) -> STT kn-IN: "${r.transcript?.text}" ${r.error ? JSON.stringify(r.error).slice(0, 150) : ''}`);
  } catch (e) { console.log(`   tts ${language}/${voice} failed: ${e.message}`); }
}
logRun(`t15 stt audioSec=${sttSec.toFixed(1)} tts audioSec=${ttsSec.toFixed(1)}`);
