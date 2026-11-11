import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { startMockGnani, type MockGnani } from './index.js';

let mock: MockGnani;

beforeEach(async () => {
  mock = await startMockGnani({ ttfbMs: 5, chunkIntervalMs: 1, sttLatencyMs: 5 });
});

afterEach(async () => {
  await mock.close();
});

interface MockMessage {
  type: string;
  [key: string]: unknown;
}

function connectStt(
  key = 'test-key',
  headers: Record<string, string> = {},
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${mock.url.replace('http', 'ws')}/stt/v3/stream`, {
      headers: {
        'x-api-key-id': key,
        model: 'prisma-v3.0',
        language_code: 'hi-IN',
        format: 'codemix',
        'x-sample-rate': '16000',
        ...headers,
      },
    });
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as MockMessage;
      if (m.type === 'connected') resolve(ws);
    });
    ws.on('unexpected-response', (_req, res) => reject(new Error(`stt http ${res.statusCode}`)));
    ws.on('error', reject);
  });
}

function connectTts(key = 'test-key'): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${mock.url.replace('http', 'ws')}/api/v1/tts`, {
      headers: { 'X-API-Key-ID': key },
    });
    ws.on('open', () => resolve(ws));
    ws.on('unexpected-response', (_req, res) => reject(new Error(`tts http ${res.statusCode}`)));
    ws.on('error', reject);
  });
}

function expectHttpError(url: string, headers: Record<string, string>, status: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${mock.url.replace('http', 'ws')}${url}`, { headers });
    ws.on('open', () => reject(new Error('expected the upgrade to be refused')));
    ws.on('unexpected-response', (_req, res) => {
      try {
        expect(res.statusCode).toBe(status);
        resolve();
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    ws.on('error', () => {
      // ws surfaces the refused upgrade as an error on some platforms; check via unexpected-response only
    });
  });
}

function waitForMessage(ws: WebSocket, pred: (m: MockMessage) => boolean, timeoutMs = 3000): Promise<MockMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for message')), timeoutMs);
    const handler = (d: WebSocket.RawData) => {
      const m = JSON.parse(d.toString()) as MockMessage;
      if (pred(m)) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(m);
      }
    };
    ws.on('message', handler);
  });
}

describe('mock-gnani auth', () => {
  it('refuses bad STT keys with 401 before the socket opens', async () => {
    await expectHttpError('/stt/v3/stream', { 'x-api-key-id': 'bad' }, 401);
  });

  it('refuses nocredit STT keys with 402', async () => {
    await expectHttpError('/stt/v3/stream', { 'x-api-key-id': 'nocredit' }, 402);
  });

  it('refuses ratelimit STT keys with 429', async () => {
    await expectHttpError('/stt/v3/stream', { 'x-api-key-id': 'ratelimit' }, 429);
  });

  it('refuses bad TTS keys with 401', async () => {
    await expectHttpError('/api/v1/tts', { 'X-API-Key-ID': 'bad' }, 401);
  });

  it('accepts ordinary keys and records the upgrade headers', async () => {
    const ws = await connectStt();
    expect(mock.requests.stt).toHaveLength(1);
    expect(mock.requests.stt[0]?.headers['language_code']).toBe('hi-IN');
    ws.close();
  });
});

describe('mock-gnani STT', () => {
  it('replies with a bad-frame-size error for non-1024-byte binary frames', async () => {
    const ws = await connectStt();
    const errPromise = waitForMessage(ws, (m) => m.type === 'error');
    ws.send(Buffer.alloc(1000));
    const err = await errPromise;
    expect(err.message).toBe('bad frame size');
    ws.close();
  });

  it('on commit: speech_start, then a scripted transcript with v3 shape (no output field)', async () => {
    mock.scriptTranscripts(['तीन सौ चालीस रुपये']);
    const ws = await connectStt();
    for (let i = 0; i < 3; i++) ws.send(Buffer.alloc(1024));
    const startP = waitForMessage(ws, (m) => m.type === 'speech_start');
    const transcriptP = waitForMessage(ws, (m) => m.type === 'transcript');
    ws.send(JSON.stringify({ type: 'commit' }));
    const start = await startP;
    expect(typeof start.utterance_id).toBe('string');
    const transcript = await transcriptP;
    expect(transcript.text).toBe('तीन सौ चालीस रुपये');
    expect(transcript.audio_duration_ms).toBe(96); // 3 frames * 32 ms
    expect(transcript.is_final).toBe(true);
    expect(transcript.segment_index).toBe(1);
    expect(transcript.detected_language_code).toBe('hi-IN');
    expect(transcript).not.toHaveProperty('output');
    ws.close();
  });

  it('falls back to "mock transcript" when the queue is empty; later commits dequeue FIFO', async () => {
    mock.scriptTranscripts(['first']);
    const ws = await connectStt();
    const t1 = waitForMessage(ws, (m) => m.type === 'transcript');
    ws.send(JSON.stringify({ type: 'commit' }));
    expect((await t1).text).toBe('first');
    const t2 = waitForMessage(ws, (m) => m.type === 'transcript');
    ws.send(JSON.stringify({ type: 'commit' }));
    expect((await t2).text).toBe('mock transcript');
    ws.close();
  });

  it('acks update_settings with settings_updated', async () => {
    const ws = await connectStt();
    const ackP = waitForMessage(ws, (m) => m.type === 'settings_updated');
    ws.send(JSON.stringify({ type: 'update_settings', format: 'transcribe' }));
    const ack = await ackP;
    expect(ack.config).toMatchObject({ format: 'transcribe', language_code: 'hi-IN' });
    ws.close();
  });
});

describe('mock-gnani TTS', () => {
  const ttsRequest = (text: string) => ({
    text,
    voice: 'Avinash',
    model: 'timbre-v3.0',
    language: 'hi-IN',
    speed: 1.0,
    audio_config: { sample_rate: 16000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'raw' },
  });

  it('emits start -> audio chunks -> two completes in order', async () => {
    const ws = await connectTts();
    const messages: MockMessage[] = [];
    const done = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('tts timed out')), 3000);
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString()) as MockMessage;
        messages.push(m);
        if (m.type === 'complete' && typeof m.message === 'string') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    ws.send(JSON.stringify(ttsRequest('नमस्ते'))); // 6 chars -> 480 ms -> 15,360 bytes -> 6 chunks
    await done;

    expect(messages[0]?.type).toBe('start');
    const audioMessages = messages.filter((m) => m.type === 'audio');
    expect(audioMessages.length).toBe(6);
    const decoded = Buffer.concat(
      audioMessages.map((m) => Buffer.from((m.data as { audio: string }).audio, 'base64')),
    );
    expect(decoded.length).toBe(15_360);
    for (const [i, m] of audioMessages.entries()) {
      expect((m.data as { chunk_index: number }).chunk_index).toBe(i + 1);
    }
    const completes = messages.filter((m) => m.type === 'complete');
    expect(completes).toHaveLength(2);
    expect((completes[0]?.data as { is_final: boolean }).is_final).toBe(true);
    expect((completes[0]?.data as { audio: string }).audio).toBe('');
    expect(completes[1]?.message).toBe('Streaming completed');
    expect(mock.requests.tts).toHaveLength(1);
    ws.close();
  });

  it('enforces a minimum audio length of 400 ms', async () => {
    const ws = await connectTts();
    const messages: MockMessage[] = [];
    const done = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('tts timed out')), 3000);
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString()) as MockMessage;
        messages.push(m);
        if (m.type === 'complete' && typeof m.message === 'string') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    ws.send(JSON.stringify(ttsRequest('hi'))); // 2 chars -> 400 ms minimum -> 12,800 bytes -> 5 chunks
    await done;
    const audioMessages = messages.filter((m) => m.type === 'audio');
    expect(audioMessages.length).toBe(5);
    ws.close();
  });

  it('serves two queued requests strictly in order', async () => {
    const ws = await connectTts();
    const starts: string[] = [];
    let completesSeen = 0;
    const done = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('tts timed out')), 5000);
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString()) as MockMessage;
        if (m.type === 'start') starts.push(m.request_id as string);
        if (m.type === 'complete' && typeof m.message === 'string') {
          completesSeen += 1;
          if (completesSeen === 2) {
            clearTimeout(timer);
            resolve();
          }
        }
      });
    });
    ws.send(JSON.stringify(ttsRequest('first request text')));
    ws.send(JSON.stringify(ttsRequest('second request text')));
    await done;
    expect(starts).toHaveLength(2);
    expect(mock.requests.tts).toHaveLength(2);
    expect((mock.requests.tts[0] as { text: string }).text).toBe('first request text');
    expect((mock.requests.tts[1] as { text: string }).text).toBe('second request text');
    ws.close();
  });

  it('an abandoned request keeps streaming to its end before the next one starts', async () => {
    const ws = await connectTts();
    const events: { type: string; requestId?: unknown }[] = [];
    const done = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('tts timed out')), 5000);
      let activeRequestId: unknown;
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString()) as MockMessage;
        if (m.type === 'start') {
          activeRequestId = m.request_id;
          events.push({ type: 'start', requestId: m.request_id });
        } else if (m.type === 'audio') {
          events.push({ type: 'audio', requestId: activeRequestId });
        } else if (m.type === 'complete' && typeof m.message === 'string') {
          events.push({ type: 'complete', requestId: m.request_id });
          if (events.filter((e) => e.type === 'complete').length === 2) {
            clearTimeout(timer);
            resolve();
          }
        }
      });
    });
    // long first request (well past 400 ms), short second one
    const longText = 'a'.repeat(50); // 50 chars -> 4000 ms -> 160 chunks at 1 ms
    ws.send(JSON.stringify(ttsRequest(longText)));
    ws.send(JSON.stringify(ttsRequest('short')));
    await done;

    const starts = events.filter((e) => e.type === 'start');
    expect(starts).toHaveLength(2);
    // every event of request 1 (start..audio..complete) precedes request 2's start
    const secondStart = events.findIndex((e) => e.type === 'start' && e.requestId === starts[1]!.requestId);
    const firstComplete = events.findIndex((e) => e.type === 'complete' && e.requestId === starts[0]!.requestId);
    expect(firstComplete).toBeGreaterThan(-1);
    expect(firstComplete).toBeLessThan(secondStart);
    const firstAudio = events.filter((e) => e.type === 'audio' && e.requestId === starts[0]!.requestId);
    expect(firstAudio.length).toBe(50); // 50 chars -> 4000 ms -> 128,000 bytes -> 50 chunks of 2560
    ws.close();
  });
});

describe('mock-gnani dropAll', () => {
  it('terminates every open socket', async () => {
    const stt = await connectStt();
    const tts = await connectTts();
    const closed = new Promise<void>((resolve) => stt.on('close', () => resolve()));
    const closedTts = new Promise<void>((resolve) => tts.on('close', () => resolve()));
    mock.dropAll();
    await closed;
    await closedTts;
  });
});
