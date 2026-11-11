import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

import type { Logger } from './logger.js';

export type GnaniErrorCode = 'auth' | 'no_credit' | 'rate_limited' | 'unavailable' | 'protocol' | 'timeout';

export class GnaniError extends Error {
  constructor(
    readonly code: GnaniErrorCode,
    readonly recoverable: boolean,
  ) {
    super(code);
  }
}

function fromStatus(status: number): GnaniError {
  if (status === 401 || status === 403) return new GnaniError('auth', false);
  if (status === 402) return new GnaniError('no_credit', false);
  if (status === 429) return new GnaniError('rate_limited', true);
  return new GnaniError('unavailable', true);
}

const FRAME = 1024; // 32 ms of 16 kHz PCM16 mono
export const STT_SESSION_CAP_MS = 15 * 60 * 1000;
const RECONNECT_BEFORE_CAP_MS = 14 * 60 * 1000;

export interface Transcript {
  text: string;
  lang: string;
  /** Milliseconds from commit to transcript. */
  sttMs: number;
  audioMs: number;
  /** True when the transcript has the Prisma v3 shape. A v2.5 fallback has an `output` field instead. */
  v3: boolean;
}

export interface LinkOptions {
  baseUrl: string;
  apiKey: string;
  log: Logger;
}

export const SPEECH_LANG = { hi: 'hi-IN', en: 'en-IN', kn: 'kn-IN' } as const;
export type Lang = keyof typeof SPEECH_LANG;

/** One warm speech-to-text socket for one phone. */
export class SttLink extends EventEmitter {
  private ws: WebSocket | null = null;
  private rest = Buffer.alloc(0);
  private connectedAt = 0;
  private pendingCommit: { resolve: (t: Transcript) => void; reject: (e: Error) => void; startedAt: number; timer: NodeJS.Timeout } | null = null;
  private frames = 0;
  private lang: Lang;

  constructor(
    private readonly o: LinkOptions,
    lang: Lang,
  ) {
    super();
    this.lang = lang;
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  /** True once the socket has been open long enough that it should be replaced before the 15 minute cap. */
  get isOld(): boolean {
    return this.isOpen && Date.now() - this.connectedAt > RECONNECT_BEFORE_CAP_MS;
  }

  connect(): Promise<void> {
    this.close();
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.o.baseUrl.replace(/\/$/, '')}/stt/v3/stream`, {
        headers: {
          'x-api-key-id': this.o.apiKey,
          model: 'prisma-v3.0',
          language_code: SPEECH_LANG[this.lang],
          format: 'codemix',
          'x-sample-rate': '16000',
          'x-idle-timeout-sec': '900',
        },
      });
      this.ws = ws;
      let settled = false;
      const fail = (e: GnaniError): void => {
        if (!settled) {
          settled = true;
          reject(e);
        }
      };
      ws.on('unexpected-response', (_req, res) => fail(fromStatus(res.statusCode ?? 500)));
      ws.on('error', () => fail(new GnaniError('unavailable', true)));
      ws.on('close', () => {
        if (this.ws === ws) this.ws = null;
        this.pendingCommit?.reject(new GnaniError('unavailable', true));
        this.finishCommit();
        this.emit('closed');
        fail(new GnaniError('unavailable', true));
      });
      ws.on('message', (data, isBinary) => {
        if (isBinary) return;
        let m: Record<string, unknown>;
        try {
          m = JSON.parse(data.toString()) as Record<string, unknown>;
        } catch {
          return;
        }
        if (m['type'] === 'connected' && !settled) {
          settled = true;
          this.connectedAt = Date.now();
          resolve();
        } else if (m['type'] === 'transcript') {
          const p = this.pendingCommit;
          if (!p) return;
          this.finishCommit();
          const v3 = 'detected_language_code' in m && !('output' in m);
          if (!v3) this.o.log.warn('stt_not_v3');
          p.resolve({
            text: typeof m['text'] === 'string' ? m['text'] : '',
            lang: typeof m['detected_language_code'] === 'string' ? m['detected_language_code'] : SPEECH_LANG[this.lang],
            sttMs: Date.now() - p.startedAt,
            audioMs: typeof m['audio_duration_ms'] === 'number' ? m['audio_duration_ms'] : this.frames * 32,
            v3,
          });
        } else if (m['type'] === 'error') {
          this.o.log.warn('stt_error_frame');
          const p = this.pendingCommit;
          if (p) {
            this.finishCommit();
            p.reject(new GnaniError('protocol', true));
          }
        }
      });
    });
  }

  private finishCommit(): void {
    if (this.pendingCommit) clearTimeout(this.pendingCommit.timer);
    this.pendingCommit = null;
  }

  /** Re-chunks arbitrary-sized PCM into exact 1,024-byte frames. The remainder waits for the next call. */
  sendAudio(pcm: Buffer): number {
    if (!this.isOpen) return 0;
    let buf = this.rest.length ? Buffer.concat([this.rest, pcm]) : pcm;
    let sent = 0;
    while (buf.length >= FRAME) {
      this.ws!.send(buf.subarray(0, FRAME));
      buf = buf.subarray(FRAME);
      sent++;
    }
    this.rest = Buffer.from(buf);
    this.frames += sent;
    return sent;
  }

  /** Ends the utterance now. Pads the last partial frame with silence, sends `commit`, waits for the transcript. */
  commit(timeoutMs = 6000): Promise<Transcript> {
    if (!this.isOpen) return Promise.reject(new GnaniError('unavailable', true));
    if (this.rest.length) {
      const pad = Buffer.alloc(FRAME);
      this.rest.copy(pad);
      this.ws!.send(pad);
      this.frames++;
      this.rest = Buffer.alloc(0);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.finishCommit();
        reject(new GnaniError('timeout', true));
      }, timeoutMs);
      this.pendingCommit = { resolve, reject, startedAt: Date.now(), timer };
      this.ws!.send(JSON.stringify({ type: 'commit' }));
    });
  }

  /** Called at the start of each utterance. */
  resetUtterance(): void {
    this.rest = Buffer.alloc(0);
    this.frames = 0;
  }

  setLang(lang: Lang): void {
    this.lang = lang;
    if (this.isOpen) this.ws!.send(JSON.stringify({ type: 'update_settings', language_code: SPEECH_LANG[lang] }));
  }

  /** Customer names help the recognizer. `bias` is the mid-session key for Prisma v3 (measured in the spike). */
  setBias(terms: string[]): void {
    if (this.isOpen) this.ws!.send(JSON.stringify({ type: 'update_settings', bias: terms.slice(0, 200) }));
  }

  close(): void {
    const ws = this.ws;
    this.ws = null;
    this.finishCommit();
    if (ws) {
      ws.removeAllListeners('close');
      ws.on('error', () => undefined);
      try {
        ws.terminate();
      } catch {
        /* already gone */
      }
    }
  }
}

const TTS_LANG: Record<Lang, string> = { hi: 'hi-en', en: 'auto', kn: 'kn-IN' };

interface Job {
  id: string;
  text: string;
  lang: Lang;
  onStart: () => void;
  onChunk: (pcm: Buffer) => void;
  resolve: (r: TtsResult) => void;
  reject: (e: Error) => void;
}
export interface TtsResult {
  outcome: 'done' | 'interrupted';
  firstChunkMs: number | null;
  audioMs: number;
}

/**
 * Text to speech. Timbre handles one request at a time and cannot cancel one, so to cut a sentence short the
 * socket is thrown away and a fresh warm one takes over (measured: waiting costs about 1.9 s, reopening about 125 ms).
 */
export class TtsLink {
  private ws: WebSocket | null = null;
  private queue: Job[] = [];
  private current: { job: Job; startedAt: number; first: number | null; bytes: number; timer: NodeJS.Timeout } | null = null;
  private opening: Promise<void> | null = null;

  constructor(private readonly o: LinkOptions) {}

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Opens the socket ahead of the first request. Safe to call repeatedly. */
  warm(): Promise<void> {
    if (this.isOpen) return Promise.resolve();
    if (this.opening) return this.opening;
    this.opening = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${this.o.baseUrl.replace(/\/$/, '')}/api/v1/tts`, { headers: { 'X-API-Key-ID': this.o.apiKey } });
      let settled = false;
      const done = (e?: GnaniError): void => {
        if (settled) return;
        settled = true;
        this.opening = null;
        if (e) reject(e);
        else resolve();
      };
      ws.on('open', () => {
        this.ws = ws;
        done();
      });
      ws.on('unexpected-response', (_q, res) => done(fromStatus(res.statusCode ?? 500)));
      ws.on('error', () => done(new GnaniError('unavailable', true)));
      ws.on('close', () => {
        if (this.ws === ws) {
          this.ws = null;
          this.failCurrent(new GnaniError('unavailable', true));
        }
        done(new GnaniError('unavailable', true));
      });
      ws.on('message', (d, isBinary) => {
        if (isBinary || this.ws !== ws) return;
        this.onMessage(d.toString());
      });
    });
    return this.opening;
  }

  speak(job: Omit<Job, 'resolve' | 'reject'>): Promise<TtsResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ ...job, resolve, reject });
      void this.pump();
    });
  }

  private async pump(): Promise<void> {
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift()!;
    try {
      await this.warm();
    } catch (e) {
      job.reject(e as Error);
      void this.pump();
      return;
    }
    const timer = setTimeout(() => this.failCurrent(new GnaniError('timeout', true)), 20_000);
    this.current = { job, startedAt: Date.now(), first: null, bytes: 0, timer };
    this.ws!.send(
      JSON.stringify({
        text: job.text,
        voice: 'Avinash',
        model: 'timbre-v3.0',
        language: TTS_LANG[job.lang],
        speed: 1,
        audio_config: { sample_rate: 16000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'raw' },
      }),
    );
  }

  private onMessage(raw: string): void {
    const cur = this.current;
    if (!cur) return;
    let m: { type?: string; message?: string; data?: { audio?: string } };
    try {
      m = JSON.parse(raw) as typeof m;
    } catch {
      return;
    }
    if (m.type === 'audio' && m.data?.audio) {
      const pcm = Buffer.from(m.data.audio, 'base64');
      if (!pcm.length) return;
      if (cur.first === null) {
        cur.first = Date.now() - cur.startedAt;
        cur.job.onStart();
      }
      cur.bytes += pcm.length;
      cur.job.onChunk(pcm);
    } else if (m.type === 'complete' && m.message) {
      // The first "complete" (is_final) is not the end; the one with a message is.
      this.settle('done');
    } else if (m.type === 'error') {
      this.o.log.warn('tts_error_frame');
      this.failCurrent(new GnaniError('protocol', true));
    }
  }

  private settle(outcome: 'done' | 'interrupted'): void {
    const cur = this.current;
    if (!cur) return;
    clearTimeout(cur.timer);
    this.current = null;
    cur.job.resolve({ outcome, firstChunkMs: cur.first, audioMs: Math.round(cur.bytes / 32) });
    void this.pump();
  }

  private failCurrent(e: Error): void {
    const cur = this.current;
    if (!cur) return;
    clearTimeout(cur.timer);
    this.current = null;
    cur.job.reject(e);
    void this.pump();
  }

  /**
   * Barge-in. Stops forwarding audio for the active request (and drops everything queued), throws the socket away,
   * and opens a fresh one in the background so the next sentence starts without waiting.
   */
  interrupt(): void {
    this.queue.forEach((j) => j.resolve({ outcome: 'interrupted', firstChunkMs: null, audioMs: 0 }));
    this.queue = [];
    const old = this.ws;
    this.ws = null;
    if (old) {
      old.removeAllListeners('message');
      old.removeAllListeners('close');
      old.on('error', () => undefined);
      try {
        old.terminate();
      } catch {
        /* already gone */
      }
    }
    this.settle('interrupted');
    this.opening = null;
    void this.warm().catch(() => undefined);
  }

  close(): void {
    this.queue = [];
    const old = this.ws;
    this.ws = null;
    if (old) {
      old.removeAllListeners();
      old.on('error', () => undefined);
      old.terminate();
    }
    this.failCurrent(new GnaniError('unavailable', false));
  }
}

export const newId = (): string => randomUUID();
