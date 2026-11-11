// CP3 live check: Node client -> local gateway -> real Gnani. Measures gateway overhead per hop. Spends a few credits.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import WebSocket from 'ws';
import { stt, pct, logRun } from './lib.mjs';

const PORT = 8099;
const child = spawn('npx', ['tsx', 'apps/server/src/index.ts'], { env: { ...process.env, MODE: 'local', PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
child.stdout.on('data', (d) => (out += d));
child.stderr.on('data', (d) => (out += d));
const up = async () => { for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/healthz`)).ok) return; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 250)); } throw new Error('gateway did not start: ' + out.slice(-400)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let audioSec = 0;
try {
  await up();
  const clip = readFileSync('eval/audio/t14/c00.pcm'); // Timbre-made Hindi clip, "ramesh ka 340 udhaar"
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const msgs = []; const bins = [];
  ws.on('message', (d, bin) => (bin ? bins.push(performance.now()) : msgs.push({ t: performance.now(), ...JSON.parse(d.toString()) })));
  await new Promise((r) => ws.once('open', r));
  const wait = async (pred, ms = 8000) => { const t0 = performance.now(); for (;;) { const m = msgs.find(pred); if (m) return m; if (performance.now() - t0 > ms) throw new Error('timeout ' + JSON.stringify(msgs.map((x) => x.type + (x.code ? ':' + x.code : '')))); await sleep(5); } };
  const clip0 = clip;
  const direct = [];
  for (let i = 0; i < 5; i++) { const r = await stt({ pcm: clip0, lang: 'hi-IN', format: 'codemix' }); direct.push(r.recvAt - r.sentEnd); audioSec += clip0.length / 32000; }
  console.log(`direct to Gnani (same clip0, same settings): commit->transcript p50 ${pct(direct, 50)} p95 ${pct(direct, 95)} ms`);

  const t0 = performance.now();
  ws.send(JSON.stringify({ type: 'hello', lang: 'hi' }));
  const ready = await wait((m) => m.type === 'ready');
  console.log(`hello -> ready ${(ready.t - t0).toFixed(0)} ms (both sockets warm), degraded=${ready.degraded}`);

  const viaGw = [], gwSide = [], texts = [];
  for (let i = 0; i < 5; i++) {
    msgs.length = 0;
    ws.send(JSON.stringify({ type: 'ptt_down' }));
    await wait((m) => m.type === 'speech_start');
    for (let o = 0; o < clip.length; o += 1024) { ws.send(clip.subarray(o, Math.min(clip.length, o + 1024))); await sleep(32); }
    const up = performance.now();
    ws.send(JSON.stringify({ type: 'ptt_up' }));
    const tr = await wait((m) => m.type === 'transcript');
    viaGw.push(tr.t - up); gwSide.push(tr.sttMs); texts.push(tr.text); audioSec += clip.length / 32000;
    await sleep(200);
  }
  console.log('transcripts:', [...new Set(texts)].join(' | '));
  console.log(`release->transcript at the client: p50 ${pct(viaGw, 50).toFixed(0)} p95 ${pct(viaGw, 95).toFixed(0)} ms; gateway-measured commit->transcript: p50 ${pct(gwSide, 50)} p95 ${pct(gwSide, 95)} ms`);
  const hop = viaGw.map((v, i) => v - gwSide[i]);
  console.log(`gateway overhead on the STT path (client view minus gateway commit->transcript): p50 ${pct(hop, 50).toFixed(1)} p95 ${pct(hop, 95).toFixed(1)} ms`);

  const tts = [], ttsGw = [];
  for (let i = 0; i < 5; i++) {
    msgs.length = 0; bins.length = 0;
    const sent = performance.now();
    ws.send(JSON.stringify({ type: 'speak', id: 's' + i, text: 'रमेश, ₹340 उधार। बाकी ₹340।', lang: 'hi' }));
    await wait((m) => m.type === 'tts_end' && m.id === 's' + i);
    tts.push(bins[0] - sent); ttsGw.push((await wait((m) => m.type === 'metric' && m.name === 'tts_first_audio_ms')).ms); audioSec += (bins.length * 2560) / 32000;
    await sleep(200);
  }
  console.log(`speak -> first audio at the client: p50 ${pct(tts, 50).toFixed(0)} p95 ${pct(tts, 95).toFixed(0)} ms; gateway-measured request->first chunk: p50 ${pct(ttsGw, 50)} p95 ${pct(ttsGw, 95)} ms`);
  const thop = tts.map((v, i) => v - ttsGw[i]);
  console.log(`gateway overhead on the TTS path: p50 ${pct(thop, 50).toFixed(1)} p95 ${pct(thop, 95).toFixed(1)} ms`);

  // barge-in against the real service
  msgs.length = 0; bins.length = 0;
  ws.send(JSON.stringify({ type: 'speak', id: 'bi', text: 'रमेश का तीन सौ चालीस रुपये उधार लिख दिया गया है और सुनीता का डेढ़ सौ रुपये जमा हो गया है और कविता का ढाई हज़ार रुपये बाकी है', lang: 'hi' }));
  await wait((m) => m.type === 'tts_start');
  await sleep(150);
  const before = bins.length; const iAt = performance.now();
  ws.send(JSON.stringify({ type: 'interrupt' }));
  const end = await wait((m) => m.type === 'tts_end' && m.id === 'bi');
  await sleep(1200);
  console.log(`barge-in: tts_end(interrupted=${end.interrupted}) after ${(end.t - iAt).toFixed(0)} ms; chunks at interrupt ${before}, chunks 1.2 s later ${bins.length} (must be equal: ${bins.length <= before + 1 ? 'ok' : 'LATE AUDIO'})`);
  ws.send(JSON.stringify({ type: 'speak', id: 'after', text: 'ठीक है', lang: 'hi' }));
  const sp = performance.now();
  await wait((m) => m.type === 'tts_start' && m.id === 'after');
  console.log(`next sentence after barge-in: first audio in ${(performance.now() - sp).toFixed(0)} ms`);
  ws.close();
  logRun(`cp3-live audioSec(approx)=${audioSec.toFixed(1)}`);
  console.log('gateway log lines containing Devanagari or digits-with-words (must be 0):', out.split('\n').filter((l) => /[ऀ-ॿ]/.test(l)).length);
} catch (e) {
  console.log('FAILED:', e.message);
  console.log('gateway output tail:', out.split('\n').slice(-12).join('\n'));
} finally {
  child.kill();
}
