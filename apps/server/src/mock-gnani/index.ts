import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';

import { WebSocketServer, WebSocket } from 'ws';

export interface MockGnani {
  /** http://127.0.0.1:<port> — pass to a ws client with the same paths as the real service */
  url: string;
  close(): Promise<void>;
  /** Enqueue scripted transcript texts. FIFO; when the queue is empty, 'mock transcript' is returned. */
  scriptTranscripts(texts: string[]): void;
  requests: {
    stt: { headers: Record<string, string> }[];
    tts: unknown[];
  };
  /** Terminate every open socket, to simulate a network drop. */
  dropAll(): void;
}

export interface MockGnaniOptions {
  port?: number;
  ttfbMs?: number;
  chunkIntervalMs?: number;
  sttLatencyMs?: number;
}

const FRAME_BYTES = 1024;

function authStatusFor(key: string | undefined): 0 | 401 | 402 | 429 {
  if (key === 'bad') return 401;
  if (key === 'nocredit') return 402;
  if (key === 'ratelimit') return 429;
  return 0;
}

/** Quiet 440 Hz sine, PCM16LE mono 16 kHz. */
function sinePcm16(totalBytes: number): Buffer {
  const buf = Buffer.alloc(totalBytes);
  const amplitude = Math.floor(0.05 * 32767);
  const sampleCount = Math.floor(totalBytes / 2);
  for (let i = 0; i < sampleCount; i++) {
    const t = i / 16000;
    const v = Math.round(amplitude * Math.sin(2 * Math.PI * 440 * t));
    buf.writeInt16LE(v, i * 2);
  }
  return buf;
}

export async function startMockGnani(opts: MockGnaniOptions = {}): Promise<MockGnani> {
  const { port = 0, ttfbMs = 20, chunkIntervalMs = 5, sttLatencyMs = 10 } = opts;

  const transcriptQueue: string[] = [];
  const requests: MockGnani['requests'] = { stt: [], tts: [] };
  const sockets = new Set<WebSocket>();

  const wss = new WebSocketServer({ noServer: true });

  const handleStt = (ws: WebSocket, headers: Record<string, string>): void => {
    const requestId = randomUUID();
    let frameCount = 0;
    const languageCode = headers['language_code'] ?? '';
    const format = headers['format'] ?? 'verbatim';

    const send = (obj: unknown): void => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
    };

    send({
      type: 'connected',
      message: 'STT service ready',
      request_id: requestId,
      config: {
        sample_rate: 16000,
        chunk_size: 512,
        partials_enabled: false,
        language_code: languageCode,
        format,
      },
      timestamp: new Date().toISOString(),
    });

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        if (data.length !== FRAME_BYTES) {
          send({ type: 'error', message: 'bad frame size' });
          return;
        }
        frameCount += 1;
        return;
      }
      let msg: { type?: string } & Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString()) as typeof msg;
      } catch {
        send({ type: 'error', message: 'unparseable control frame' });
        return;
      }
      if (msg.type === 'commit') {
        const utteranceId = randomUUID();
        send({ type: 'speech_start', utterance_id: utteranceId, t_ms: 0 });
        const frames = frameCount;
        frameCount = 0;
        const text = transcriptQueue.length > 0 ? transcriptQueue.shift()! : 'mock transcript';
        const t0 = Date.now();
        setTimeout(() => {
          send({
            type: 'transcript',
            text,
            audio_duration_ms: frames * 32,
            segment_id: `${requestId}-seg-1`,
            segment_index: 1,
            utterance_id: utteranceId,
            is_final: true,
            latency: Date.now() - t0 + sttLatencyMs,
            prefetched: false,
            timestamp: new Date().toISOString(),
            detected_language_code: languageCode.split(',')[0] ?? '',
          });
        }, sttLatencyMs);
        return;
      }
      if (msg.type === 'update_settings') {
        const rest = Object.fromEntries(Object.entries(msg).filter(([k]) => k !== 'type'));
        send({
          type: 'settings_updated',
          timestamp: new Date().toISOString(),
          config: {
            language_code: languageCode,
            format,
            ...rest,
          },
        });
        return;
      }
      send({ type: 'error', message: `unsupported control frame: ${String(msg.type)}` });
    });
  };

  const handleTts = (ws: WebSocket): void => {
    let processing: Promise<void> | null = null;
    // Requests on one socket run strictly one after another; an in-flight request cannot be cancelled.

    const send = (obj: unknown): void => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
    };

    const runTtsRequest = async (req: Record<string, unknown>): Promise<void> => {
      const requestId = randomUUID();
      const text = typeof req.text === 'string' ? req.text : '';
      const durationMs = Math.max(400, text.length * 80);
      const totalBytes = Math.floor((durationMs / 1000) * 16000 * 2);
      const pcm = sinePcm16(totalBytes);
      const chunkBytes = 2560;

      send({ type: 'start', message: 'Streaming started', request_id: requestId });
      await new Promise((r) => setTimeout(r, ttfbMs));

      let chunkIndex = 0;
      for (let offset = 0; offset < pcm.length; offset += chunkBytes) {
        chunkIndex += 1;
        const slice = pcm.subarray(offset, Math.min(offset + chunkBytes, pcm.length));
        send({
          type: 'audio',
          data: { chunk_index: chunkIndex, audio: slice.toString('base64'), is_final: false },
        });
        await new Promise((r) => setTimeout(r, chunkIntervalMs));
      }
      send({ type: 'complete', data: { chunk_index: chunkIndex + 1, audio: '', is_final: true } });
      send({ type: 'complete', message: 'Streaming completed', request_id: requestId });
    };

    ws.on('message', (data: Buffer) => {
      let req: Record<string, unknown>;
      try {
        req = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        send({ type: 'error', message: 'unparseable request' });
        return;
      }
      requests.tts.push(req);
      const run = (processing ?? Promise.resolve()).then(() => runTtsRequest(req));
      processing = run.catch(() => undefined);
    });
  };

  const server: Server = createServer();

  server.on('upgrade', (req, socket, head) => {
    const path = (req.url ?? '').split('?')[0];
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers[k.toLowerCase()] = v;
    }

    if (path !== '/stt/v3/stream' && path !== '/api/v1/tts') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    // Node lowercases header names, so both x-api-key-id (STT) and X-API-Key-ID (TTS) arrive as x-api-key-id.
    const key = headers['x-api-key-id'];
    const status = authStatusFor(key);
    if (status !== 0) {
      socket.write(`HTTP/1.1 ${status} Unauthorized\r\ncontent-type: application/json\r\n\r\n{"detail":{"error_code":"AUTH","status_code":${status}}}`);
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      sockets.add(ws);
      ws.on('close', () => sockets.delete(ws));
      if (path === '/stt/v3/stream') {
        requests.stt.push({ headers });
        handleStt(ws, headers);
      } else {
        handleTts(ws);
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address !== null ? address.port : port;

  return {
    url: `http://127.0.0.1:${actualPort}`,
    requests,
    scriptTranscripts(texts: string[]): void {
      transcriptQueue.push(...texts);
    },
    dropAll(): void {
      for (const ws of sockets) ws.terminate();
    },
    async close(): Promise<void> {
      for (const ws of sockets) ws.terminate();
      await new Promise<void>((resolve) => {
        wss.close(() => {
          server.close(() => resolve());
        });
      });
    },
  };
}
