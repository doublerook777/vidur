// T1.6: warm-socket TTFB, and what happens when a request is abandoned mid-stream.
import WebSocket from 'ws';
import { env, pct, logRun } from './lib.mjs';
const key = env().GNANI_API_KEY;
const req = (text) => JSON.stringify({ text, voice: 'Avinash', model: 'timbre-v3.0', language: 'hi-en', speed: 1, audio_config: { sample_rate: 16000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'raw' } });
const open = () => new Promise((res, rej) => { const t0 = performance.now(); const ws = new WebSocket('wss://api.vachana.ai/api/v1/tts', { headers: { 'X-API-Key-ID': key } }); ws.on('open', () => res({ ws, openMs: performance.now() - t0 })); ws.on('error', rej); });
const SHORT = 'रमेश का तीन सौ चालीस रुपये उधार लिख दिया';
const LONG = 'रमेश का तीन सौ चालीस रुपये उधार लिख दिया गया है और सुनीता का डेढ़ सौ रुपये जमा हो गया है और कविता का ढाई हज़ार रुपये बाकी है';
let sec = 0;

// A: warm socket, 8 sequential requests
{
  const { ws, openMs } = await open();
  console.log(`socket open (TLS+upgrade): ${openMs.toFixed(0)} ms`);
  const tt = [];
  for (let i = 0; i < 8; i++) {
    await new Promise((resolve) => {
      const t0 = performance.now(); let first = null; let bytes = 0;
      const on = (d) => { const m = JSON.parse(d.toString()); if (m.type === 'audio' && m.data?.audio) { if (first === null) first = performance.now() - t0; bytes += m.data.audio.length * 0.75; } if (m.type === 'error') console.log('  A msg error:', JSON.stringify(m).slice(0,200));
      if ((m.type === 'complete' && m.message) || m.type === 'error') { ws.off('message', on); tt.push(first); sec += bytes / 32000; resolve(); } };
      ws.on('message', on); ws.send(req(SHORT));
    });
  }
  console.log(`A warm-socket ttfb (8 reqs): ${tt.map((x) => (x == null ? 'none' : x.toFixed(0))).join(', ')}  p50 ${pct(tt.filter((x)=>x!=null), 50)?.toFixed(0)} p95 ${pct(tt.filter((x)=>x!=null), 95)?.toFixed(0)}`);
  ws.close();
}

// B: abandon a long request after its first chunk, send a new request on the SAME socket immediately
{
  const { ws } = await open();
  const events = []; const t0 = performance.now();
  let sentSecond = false; let secondSentAt = 0; let secondFirstAudio = null; let staleChunks = 0; let ids = new Set(); let startCount = 0;
  await new Promise((resolve) => {
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString()); const t = Math.round(performance.now() - t0);
      if (m.type === 'start') { startCount++; ids.add(m.request_id); events.push(`${t} start #${startCount} id=${(m.request_id ?? '').slice(0, 8)}`); }
      if (m.type === 'error') events.push(`${t} error ${JSON.stringify(m).slice(0, 160)}`);
      if (m.type === 'complete' && m.message) { events.push(`${t} complete`); if (startCount >= 2) setTimeout(resolve, 300); }
      if (m.type === 'audio' && m.data?.audio) {
        sec += (m.data.audio.length * 0.75) / 32000;
        if (!sentSecond) { sentSecond = true; secondSentAt = performance.now(); events.push(`${t} first audio of LONG; sending SHORT on same socket now`); ws.send(req(SHORT)); }
        else if (startCount >= 2 && secondFirstAudio === null) { secondFirstAudio = performance.now() - secondSentAt; events.push(`${t} first audio after second start (+${secondFirstAudio.toFixed(0)} ms from second send)`); }
        else if (startCount < 2) staleChunks++;
      }
    });
    ws.send(req(LONG));
    setTimeout(resolve, 12000);
  });
  console.log('B events:'); events.forEach((e) => console.log('  ' + e));
  console.log(`B chunks of the first request that kept arriving after the second send: ${staleChunks}; second request first-audio delay ${secondFirstAudio?.toFixed(0)} ms`);
  ws.close();
}

// C: abandon by closing the socket and reopening
{
  const t0 = performance.now();
  const { ws, openMs } = await open();
  ws.close();
  const { ws: ws2, openMs: o2 } = await open();
  console.log(`C reopen cost: ${openMs.toFixed(0)} and ${o2.toFixed(0)} ms (handshake only)`);
  ws2.close();
}
logRun(`t16 tts audioSec=${sec.toFixed(1)}`);
