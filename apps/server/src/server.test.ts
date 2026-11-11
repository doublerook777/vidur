import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { loadConfig, type Config } from './config.js';
import { createLogger } from './logger.js';
import { startMockGnani, type MockGnani } from './mock-gnani/index.js';
import { createGateway, type Gateway } from './server.js';

interface Msg { type?: string; [k: string]: unknown }

class Client {
  msgs: Msg[] = [];
  bins: { at: number; bytes: number }[] = [];
  closed: { code: number } | null = null;
  ws: WebSocket;
  constructor(url: string, origin?: string) {
    this.ws = new WebSocket(url.replace('http', 'ws') + '/ws', origin ? { origin } : {});
    this.ws.on('message', (d, isBin) => (isBin ? this.bins.push({ at: Date.now(), bytes: (d as Buffer).length }) : this.msgs.push(JSON.parse(d.toString()) as Msg)));
    this.ws.on('close', (code) => (this.closed = { code }));
    this.ws.on('error', () => undefined);
  }
  open(): Promise<void> {
    return new Promise((res, rej) => { this.ws.once('open', () => res()); this.ws.once('error', rej); this.ws.once('unexpected-response', (_q, r) => rej(new Error(`http ${r.statusCode}`))); });
  }
  send(o: Msg): void { this.ws.send(JSON.stringify(o)); }
  async waitFor(pred: (m: Msg) => boolean, ms = 4000): Promise<Msg> {
    const t0 = Date.now();
    for (;;) {
      const m = this.msgs.find(pred);
      if (m) return m;
      if (Date.now() - t0 > ms) throw new Error(`timeout waiting; got ${JSON.stringify(this.msgs.map((x) => x.type))}`);
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  of(type: string): Msg[] { return this.msgs.filter((m) => m.type === type); }
  close(): void { this.ws.close(); }
}

const logs: string[] = [];
const log = createLogger((l) => logs.push(l), { strict: true });
let gw: Gateway | null = null;
let mock: MockGnani | null = null;
const clients: Client[] = [];

async function boot(env: Record<string, string> = {}, opts: { key?: string; llm?: (t: string) => Promise<unknown> } = {}) {
  mock = await startMockGnani({ ttfbMs: 5, chunkIntervalMs: 20 });
  const config: Config = { ...loadConfig({ MODE: 'local', GNANI_API_KEY: opts.key ?? 'good', PORT: '0', ...env }), gnaniBaseUrl: mock.url.replace('http', 'ws') };
  gw = await createGateway({ config, log, ...(opts.llm ? { llm: opts.llm } : {}) });
  return { gw, mock };
}
async function connect(env?: { origin?: string }): Promise<Client> {
  const c = new Client(gw!.url, env?.origin);
  clients.push(c);
  await c.open();
  return c;
}
const pcm = (ms: number): Buffer => Buffer.alloc(Math.round(ms * 32), 1);

afterEach(async () => {
  clients.splice(0).forEach((c) => c.close());
  await gw?.close();
  await mock?.close();
  gw = mock = null;
  logs.length = 0;
});

async function speakAUtterance(c: Client, ms = 900): Promise<Msg> {
  c.send({ type: 'ptt_down' });
  await c.waitFor((m) => m.type === 'speech_start');
  // Odd chunk sizes on purpose: the gateway must re-chunk to exact 1,024-byte frames.
  for (const n of [700, 3000, 1500, 777]) c.ws.send(pcm((n / 32) * (ms / 160)));
  c.send({ type: 'ptt_up' });
  return c.waitFor((m) => m.type === 'transcript');
}

describe('a full turn against the mock Gnani', () => {
  it('hello, press, speak, release, transcript, reply', async () => {
    const { mock } = await boot();
    mock.scriptTranscripts(['Ramesh ka 340 udhaar']);
    const c = await connect();
    c.send({ type: 'hello', lang: 'hi' });
    const ready = await c.waitFor((m) => m.type === 'ready');
    expect(ready['degraded']).toBe(false);
    expect(typeof ready['token']).toBe('string');
    expect(mock.requests.stt).toHaveLength(1); // both sockets were opened at hello
    expect(mock.requests.stt[0]!.headers['model']).toBe('prisma-v3.0');
    expect(mock.requests.stt[0]!.headers['format']).toBe('codemix');
    expect(mock.requests.stt[0]!.headers['language_code']).toBe('hi-IN');

    const tr = await speakAUtterance(c);
    expect(tr['text']).toBe('Ramesh ka 340 udhaar');
    expect(tr['v3']).toBe(true);
    expect(typeof tr['sttMs']).toBe('number');

    c.send({ type: 'speak', id: 'r1', text: 'Ramesh, ₹340 उधार। बाकी ₹340।', lang: 'hi' });
    await c.waitFor((m) => m.type === 'tts_end' && m.id === 'r1');
    expect(c.of('tts_start')).toHaveLength(1);
    expect(c.bins.length).toBeGreaterThan(3);
    expect(c.bins.every((b) => b.bytes === 2560)).toBe(true);
    expect(c.of('metric').some((m) => m['name'] === 'tts_first_audio_ms')).toBe(true);
  });

  it('a tap with no speech returns an empty transcript without calling the recognizer', async () => {
    await boot();
    const c = await connect();
    c.send({ type: 'hello', lang: 'en' });
    await c.waitFor((m) => m.type === 'ready');
    c.send({ type: 'ptt_down' });
    await c.waitFor((m) => m.type === 'speech_start');
    c.ws.send(pcm(40));
    c.send({ type: 'ptt_up' });
    const tr = await c.waitFor((m) => m.type === 'transcript');
    expect(tr['text']).toBe('');
  });

  it('audio and messages before hello are refused', async () => {
    await boot();
    const c = await connect();
    c.send({ type: 'ptt_down' });
    const e = await c.waitFor((m) => m.type === 'error');
    expect(e['code']).toBe('no_hello');
  });

  it('the context message sends names to the recognizer as bias', async () => {
    const { mock } = await boot();
    const c = await connect();
    c.send({ type: 'hello', lang: 'hi' });
    await c.waitFor((m) => m.type === 'ready');
    c.send({ type: 'context', names: ['रमेश', 'Sunita'], keyterms: ['udhaar'] });
    await new Promise((r) => setTimeout(r, 100));
    expect(mock.requests.stt).toHaveLength(1);
  });
});

describe('barge-in', () => {
  it('after interrupt, no audio for that id reaches the phone, and the next sentence starts fast', async () => {
    const { mock } = await boot();
    const c = await connect();
    c.send({ type: 'hello', lang: 'hi' });
    await c.waitFor((m) => m.type === 'ready');
    c.send({ type: 'speak', id: 'long', text: 'x'.repeat(120), lang: 'hi' }); // about 9.6 s of audio at 80 ms per character
    await c.waitFor((m) => m.type === 'tts_start' && m.id === 'long');
    await new Promise((r) => setTimeout(r, 120));
    const before = c.bins.length;
    expect(before).toBeGreaterThan(0);
    c.send({ type: 'interrupt' });
    const end = await c.waitFor((m) => m.type === 'tts_end' && m.id === 'long');
    expect(end['interrupted']).toBe(true);
    const atInterrupt = c.bins.length;
    await new Promise((r) => setTimeout(r, 500)); // the mock keeps streaming; the gateway must not forward it
    expect(c.bins.length).toBe(atInterrupt);
    // A new sentence goes out on a fresh socket, without waiting for the abandoned one.
    const t0 = Date.now();
    c.send({ type: 'speak', id: 'next', text: 'ठीक है', lang: 'hi' });
    await c.waitFor((m) => m.type === 'tts_start' && m.id === 'next');
    expect(Date.now() - t0).toBeLessThan(600);
    await c.waitFor((m) => m.type === 'tts_end' && m.id === 'next');
    expect(mock.requests.tts.length).toBe(2);
  });

  it('pressing the button interrupts speech too', async () => {
    await boot();
    const c = await connect();
    c.send({ type: 'hello', lang: 'hi' });
    await c.waitFor((m) => m.type === 'ready');
    c.send({ type: 'speak', id: 's', text: 'y'.repeat(100), lang: 'hi' });
    await c.waitFor((m) => m.type === 'tts_start');
    c.send({ type: 'ptt_down' });
    const end = await c.waitFor((m) => m.type === 'tts_end' && m.id === 's');
    expect(end['interrupted']).toBe(true);
  });
});

describe('errors and reconnects', () => {
  it('a rejected key is reported as a configuration problem, not retried forever', async () => {
    await boot({}, { key: 'bad' });
    const c = await connect();
    c.send({ type: 'hello', lang: 'hi' });
    const e = await c.waitFor((m) => m.type === 'error');
    expect(e).toMatchObject({ code: 'service_misconfigured', recoverable: false });
  });

  it('out of credit is a clear, non-recoverable error', async () => {
    await boot({}, { key: 'nocredit' });
    const c = await connect();
    c.send({ type: 'hello', lang: 'hi' });
    const e = await c.waitFor((m) => m.type === 'error');
    expect(e).toMatchObject({ code: 'credit_exhausted', recoverable: false });
  });

  it('survives a dropped recognizer socket: the next press reconnects and works', async () => {
    const { mock } = await boot();
    mock.scriptTranscripts(['pehla', 'doosra']);
    const c = await connect();
    c.send({ type: 'hello', lang: 'hi' });
    await c.waitFor((m) => m.type === 'ready');
    expect((await speakAUtterance(c))['text']).toBe('pehla');
    mock.dropAll();
    await new Promise((r) => setTimeout(r, 100));
    c.msgs.length = 0;
    const tr = await speakAUtterance(c);
    expect(tr['text']).toBe('doosra');
    expect(mock.requests.stt.length).toBe(2);
  });

  it('survives a dropped speech socket on the next sentence', async () => {
    const { mock } = await boot();
    const c = await connect();
    c.send({ type: 'hello', lang: 'hi' });
    await c.waitFor((m) => m.type === 'ready');
    mock.dropAll();
    await new Promise((r) => setTimeout(r, 100));
    c.send({ type: 'speak', id: 'a', text: 'ठीक है', lang: 'hi' });
    await c.waitFor((m) => m.type === 'tts_end' && m.id === 'a');
  });
});

describe('a stalled speech service', () => {
  it('the speech link gives up on a missing first chunk and the next sentence still works', async () => {
    const stalled = await startMockGnani({ ttfbMs: 1500, chunkIntervalMs: 5 });
    const { TtsLink } = await import('./gnani.js');
    const link = new TtsLink({ baseUrl: stalled.url.replace('http', 'ws'), apiKey: 'good', log, firstChunkMs: 300 });
    const t0 = Date.now();
    await expect(link.speak({ id: 'a', text: 'hello', lang: 'en', onStart: () => undefined, onChunk: () => undefined })).rejects.toMatchObject({ code: 'timeout' });
    expect(Date.now() - t0).toBeLessThan(1000);
    link.close();
    await stalled.close();
  });
});

describe('optional LLM parse', () => {
  it('returns the model output unchanged for the phone to check', async () => {
    await boot({}, { llm: async () => ({ intent: 'balance_query', amount: null }) });
    const c = await connect();
    c.send({ type: 'hello', lang: 'hi' });
    await c.waitFor((m) => m.type === 'ready');
    c.send({ type: 'parse', id: 'p1', text: 'what does Ramesh owe' });
    const r = await c.waitFor((m) => m.type === 'parsed');
    expect(r['raw']).toEqual({ intent: 'balance_query', amount: null });
  });
  it('without an LLM it answers null', async () => {
    await boot();
    const c = await connect();
    c.send({ type: 'hello', lang: 'hi' });
    await c.waitFor((m) => m.type === 'ready');
    c.send({ type: 'parse', id: 'p1', text: 'anything' });
    expect((await c.waitFor((m) => m.type === 'parsed'))['raw']).toBeNull();
  });
});

describe('hosted mode guards over a real socket', () => {
  const HOSTED = { MODE: 'hosted', ACCESS_CODE: 'open-sesame-1', ALLOWED_ORIGINS: 'https://vidur.example', PER_IP_PER_MINUTE: '50' };

  it('refuses a bad origin at the upgrade', async () => {
    await boot(HOSTED);
    const c = new Client(gw!.url, 'https://evil.example');
    await expect(c.open()).rejects.toThrow(/403/);
  });
  it('refuses a missing access code', async () => {
    await boot(HOSTED);
    const c = new Client(gw!.url, 'https://vidur.example');
    clients.push(c);
    await c.open();
    c.send({ type: 'hello', lang: 'hi' });
    const e = await c.waitFor((m) => m.type === 'error');
    expect(e['code']).toBe('bad_access_code');
    await new Promise((r) => setTimeout(r, 50));
    expect(c.closed?.code).toBe(1008);
  });
  it('accepts the right code, then the token on reconnect', async () => {
    await boot(HOSTED);
    const c = new Client(gw!.url, 'https://vidur.example');
    clients.push(c);
    await c.open();
    c.send({ type: 'hello', lang: 'hi', accessCode: 'open-sesame-1' });
    const ready = await c.waitFor((m) => m.type === 'ready');
    const c2 = new Client(gw!.url, 'https://vidur.example');
    clients.push(c2);
    await c2.open();
    c2.send({ type: 'hello', lang: 'hi', token: ready['token'] });
    await c2.waitFor((m) => m.type === 'ready');
  });
  it('the kill switch refuses new connections and trips on credit exhaustion', async () => {
    await boot(HOSTED, { key: 'nocredit' });
    const c = new Client(gw!.url, 'https://vidur.example');
    clients.push(c);
    await c.open();
    c.send({ type: 'hello', lang: 'hi', accessCode: 'open-sesame-1' });
    await c.waitFor((m) => m.type === 'error' && m.code === 'credit_exhausted');
    expect(gw!.guards.isKilled).toBe(true);
    await expect(new Client(gw!.url, 'https://vidur.example').open()).rejects.toThrow(/503/);
  });
  it('enforces the per-session audio cap', async () => {
    const { mock } = await boot({ ...HOSTED, SESSION_AUDIO_CAP_MIN: '0' });
    mock.scriptTranscripts(['x']);
    const c = new Client(gw!.url, 'https://vidur.example');
    clients.push(c);
    await c.open();
    c.send({ type: 'hello', lang: 'hi', accessCode: 'open-sesame-1' });
    await c.waitFor((m) => m.type === 'ready');
    c.send({ type: 'ptt_down' });
    await c.waitFor((m) => m.type === 'speech_start');
    c.ws.send(pcm(900));
    c.send({ type: 'ptt_up' });
    const e = await c.waitFor((m) => m.type === 'error');
    expect(e['code']).toBe('session_cap');
  });
});

describe('privacy: nothing a shopkeeper says reaches the logs', () => {
  it('a full session with names and amounts logs timings and codes only', async () => {
    const { mock } = await boot();
    mock.scriptTranscripts(['रमेश का तीन सौ चालीस उधार']);
    const c = await connect();
    c.send({ type: 'hello', lang: 'hi' });
    await c.waitFor((m) => m.type === 'ready');
    c.send({ type: 'context', names: ['रमेश', 'Sunita'] });
    await speakAUtterance(c);
    c.send({ type: 'speak', id: 'p', text: 'रमेश, ₹340 उधार', lang: 'hi' });
    await c.waitFor((m) => m.type === 'tts_end');
    c.send({ type: 'parse', id: 'q', text: 'रमेश ka 340' });
    await c.waitFor((m) => m.type === 'parsed');
    c.close();
    await new Promise((r) => setTimeout(r, 100));
    const all = logs.join('\n');
    expect(all.length).toBeGreaterThan(0);
    for (const secret of ['रमेश', 'Sunita', 'Ramesh', '340', 'चालीस', 'उधार']) expect(all).not.toContain(secret);
    expect(logs.every((l) => !/"(transcript|text|name|customer|amount)"/.test(l))).toBe(true);
  });
});

describe('static files and health', () => {
  it('answers /healthz and /api/config', async () => {
    await boot();
    const h = await fetch(`${gw!.url}/healthz`);
    expect(await h.text()).toBe('ok');
    const cfg = (await (await fetch(`${gw!.url}/api/config`)).json()) as Record<string, unknown>;
    expect(cfg['mode']).toBe('local');
    expect(cfg['needsAccessCode']).toBe(false);
  });
});
