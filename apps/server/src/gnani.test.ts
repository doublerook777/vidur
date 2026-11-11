import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';

import { SttLink } from './gnani.js';
import { createLogger } from './logger.js';

const log = createLogger(() => undefined, { strict: true });
let close: (() => Promise<void>) | null = null;
afterEach(async () => { await close?.(); close = null; });

/** A recognizer that splits at pauses: it finishes a segment on its own after `earlyAfterFrames` frames. */
async function fakePrisma(script: (ws: WebSocket, state: { frames: number; sentEarly: boolean }) => void): Promise<string> {
  const http = createServer();
  const wss = new WebSocketServer({ server: http });
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected', config: {} }));
    const st = { frames: 0, sentEarly: false };
    ws.on('message', (d, bin) => { if (bin) { st.frames++; script(ws, st); } else if (JSON.parse(d.toString()).type === 'commit') script(ws, { ...st, frames: -1 } as never); });
  });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  close = async () => { wss.clients.forEach((c) => c.terminate()); await new Promise<void>((r) => http.close(() => r())); };
  return `ws://127.0.0.1:${(http.address() as AddressInfo).port}`;
}
const seg = (text: string, ms: number) => JSON.stringify({ type: 'transcript', text, audio_duration_ms: ms, is_final: true, detected_language_code: 'hi-IN', latency: 5 });
const frame = () => Buffer.alloc(1024);

describe('SttLink: a pause inside one press does not lose the first half', () => {
  it('joins a segment finished before commit with the one finished by commit', async () => {
    const url = await fakePrisma((ws, st) => {
      if (st.frames === 1) { ws.send(JSON.stringify({ type: 'speech_start' })); }
      if (st.frames === 4 && !st.sentEarly) { st.sentEarly = true; ws.send(seg('Ramesh ka', 128)); }
      if (st.frames === 6) ws.send(JSON.stringify({ type: 'speech_start' }));
      if (st.frames === -1) setTimeout(() => ws.send(seg('teen sau udhaar', 160)), 10);
    });
    const link = new SttLink({ baseUrl: url, apiKey: 'k', log }, 'hi');
    await link.connect();
    link.resetUtterance();
    for (let i = 0; i < 8; i++) link.sendAudio(frame());
    await new Promise((r) => setTimeout(r, 40));
    const t = await link.commit();
    expect(t.text).toBe('Ramesh ka teen sau udhaar');
    expect(t.audioMs).toBe(288);
    expect(t.v3).toBe(true);
    link.close();
  });

  it('if everything was finalized before commit, commit still returns it without waiting for the timeout', async () => {
    const url = await fakePrisma((ws, st) => {
      if (st.frames === 1) ws.send(JSON.stringify({ type: 'speech_start' }));
      if (st.frames === 4 && !st.sentEarly) { st.sentEarly = true; ws.send(seg('Mohan ka 50 udhaar', 128)); }
    });
    const link = new SttLink({ baseUrl: url, apiKey: 'k', log }, 'hi');
    await link.connect();
    link.resetUtterance();
    for (let i = 0; i < 6; i++) link.sendAudio(frame());
    await new Promise((r) => setTimeout(r, 40));
    const t0 = Date.now();
    const t = await link.commit(6000);
    expect(t.text).toBe('Mohan ka 50 udhaar');
    expect(Date.now() - t0).toBeLessThan(1000); // the 300 ms grace, not the 6 s timeout
    link.close();
  });

  it('waits for a segment that is still being recognized when commit arrives', async () => {
    const url = await fakePrisma((ws, st) => {
      if (st.frames === 1) ws.send(JSON.stringify({ type: 'speech_start' }));
      if (st.frames === 3) ws.send(JSON.stringify({ type: 'speech_start' })); // a second segment began
      if (st.frames === 4) ws.send(seg('pehla', 96)); // the first finishes after commit was sent
      if (st.frames === -1) setTimeout(() => ws.send(seg('doosra', 96)), 60);
    });
    const link = new SttLink({ baseUrl: url, apiKey: 'k', log }, 'hi');
    await link.connect();
    link.resetUtterance();
    for (let i = 0; i < 4; i++) link.sendAudio(frame());
    const t = await link.commit();
    expect(t.text).toBe('pehla doosra');
    link.close();
  });

  it('a press with no speech returns empty text, not an error', async () => {
    const url = await fakePrisma((ws, st) => { if (st.frames === -1) ws.send(seg('', 0)); });
    const link = new SttLink({ baseUrl: url, apiKey: 'k', log }, 'hi');
    await link.connect();
    link.resetUtterance();
    link.sendAudio(frame());
    expect((await link.commit()).text).toBe('');
    link.close();
  });
});
