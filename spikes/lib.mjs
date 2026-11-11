// Shared helpers for spikes. Reads .env in-process; never prints the key.
import { readFileSync, appendFileSync } from 'node:fs';
import WebSocket from 'ws';

export function env() {
  const e = {};
  for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) e[m[1]] = m[2];
  }
  return e;
}

/** Synthesize text with Timbre. Returns {pcm:Buffer, ttfbMs, totalMs, chunks, msgs}. */
export function tts({ text, voice = 'Avinash', language = 'hi-en', speed = 1, sampleRate = 16000 }) {
  const key = env().GNANI_API_KEY;
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const ws = new WebSocket('wss://api.vachana.ai/api/v1/tts', { headers: { 'X-API-Key-ID': key } });
    const parts = [];
    let ttfb = null;
    const msgs = [];
    ws.on('open', () =>
      ws.send(
        JSON.stringify({
          text, voice, model: 'timbre-v3.0', language, speed,
          audio_config: { sample_rate: sampleRate, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'raw' },
        }),
      ),
    );
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      msgs.push(m.type);
      if (m.type === 'audio' && m.data?.audio) {
        if (ttfb === null) ttfb = performance.now() - t0;
        parts.push(Buffer.from(m.data.audio, 'base64'));
      } else if (m.type === 'complete') {
        ws.close();
        resolve({ pcm: Buffer.concat(parts), ttfbMs: ttfb, totalMs: performance.now() - t0, chunks: parts.length, msgs });
      } else if (m.type === 'error') {
        ws.close();
        reject(new Error('tts error: ' + JSON.stringify(m).slice(0, 300)));
      }
    });
    ws.on('unexpected-response', (_q, r) => reject(new Error('tts http ' + r.statusCode)));
    ws.on('error', (e) => reject(e));
  });
}

export function wavHeader(len, rate = 16000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + len, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(len, 40);
  return h;
}

export const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };

/** Append one line to the credit log file (human fills balances in progress.md). */
export function logRun(line) { appendFileSync(new URL('./runs.log', import.meta.url), new Date().toISOString() + ' ' + line + '\n'); }

/**
 * STT session helper. Streams a PCM16 16 kHz buffer paced at 32 ms per 1024-byte frame,
 * then optionally sends commit. Returns timing and all messages.
 * opts: {pcm, lang, format, model, extraHeaders, commit:true|false, tailSilenceMs, paced:true}
 */
export function stt(opts) {
  const { pcm, lang = 'hi-IN', format = 'transcribe', model = 'prisma-v3.0', extraHeaders = {}, commit = true, tailSilenceMs = 0, paced = true } = opts;
  const key = env().GNANI_API_KEY;
  return new Promise((resolve, reject) => {
    const headers = { 'x-api-key-id': key, model, language_code: lang, format, 'x-sample-rate': '16000', ...extraHeaders };
    const ws = new WebSocket('wss://api.vachana.ai/stt/v3/stream', { headers });
    const log = [];
    const t0 = performance.now();
    const T = () => Math.round(performance.now() - t0);
    let sentEnd = null;
    let speechEndSent = null;
    let done = false;
    const finish = (r) => { if (!done) { done = true; try { ws.close(); } catch {} resolve({ log, sentEnd, speechEndSent, ...r }); } };
    ws.on('unexpected-response', (_q, r) => reject(new Error('stt http ' + r.statusCode)));
    ws.on('error', (e) => reject(e));
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      log.push({ t: T(), ...m });
      if (m.type === 'connected') begin();
      if (m.type === 'transcript') finish({ transcript: m, recvAt: T() });
      if (m.type === 'error') finish({ error: m });
    });
    ws.on('close', () => finish({ closed: true }));
    setTimeout(() => finish({ timeout: true }), 25000);
    async function begin() {
      const silence = Buffer.alloc(Math.round((tailSilenceMs / 1000) * 32000));
      const all = Buffer.concat([pcm, silence]);
      const frames = Math.ceil(all.length / 1024);
      let next = performance.now();
      const speechFrames = Math.ceil(pcm.length / 1024);
      for (let i = 0; i < frames; i++) {
        const f = Buffer.alloc(1024); all.copy(f, 0, i * 1024, Math.min(all.length, (i + 1) * 1024));
        ws.send(f);
        if (i === speechFrames - 1) speechEndSent = T();
        if (paced) { next += 32; const w = next - performance.now(); if (w > 0) await new Promise((r) => setTimeout(r, w)); }
      }
      sentEnd = T();
      if (commit) ws.send(JSON.stringify({ type: 'commit' }));
    }
  });
}
