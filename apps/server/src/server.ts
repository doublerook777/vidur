import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';

import type { Config } from './config.js';
import { GnaniError, SttLink, TtsLink, type Lang } from './gnani.js';
import { Guards } from './guards.js';
import type { Logger } from './logger.js';

export interface GatewayDeps {
  config: Config;
  log: Logger;
  guards?: Guards;
  /** Optional LLM fallback. Returns the model's raw JSON, or null. */
  llm?: (text: string) => Promise<unknown>;
  /** Built phone app and showcase, served from the same origin as the socket. */
  staticDir?: string;
  /** Key for POST /admin/kill and /admin/revive. Without it those endpoints do not exist. */
  adminKey?: string;
}

export interface Gateway {
  port: number;
  url: string;
  guards: Guards;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

const CLIENT_CODE: Record<string, { code: string; recoverable: boolean }> = {
  auth: { code: 'service_misconfigured', recoverable: false },
  no_credit: { code: 'credit_exhausted', recoverable: false },
  rate_limited: { code: 'busy', recoverable: true },
  unavailable: { code: 'network', recoverable: true },
  protocol: { code: 'speech_error', recoverable: true },
  timeout: { code: 'stt_timeout', recoverable: true },
};

const LANGS = new Set(['hi', 'en', 'kn']);
const isLang = (x: unknown): x is Lang => typeof x === 'string' && LANGS.has(x);

export async function createGateway(deps: GatewayDeps): Promise<Gateway> {
  const { config, log } = deps;
  const guards = deps.guards ?? new Guards(config);
  const hosted = config.mode === 'hosted';

  const http: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      return;
    }
    if (url.pathname === '/api/config') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(
        JSON.stringify({ mode: config.mode, needsAccessCode: Boolean(config.accessCode), llm: Boolean(deps.llm), killed: guards.isKilled }),
      );
      return;
    }
    if (req.method === 'POST' && (url.pathname === '/admin/kill' || url.pathname === '/admin/revive')) {
      if (!deps.adminKey || req.headers['x-admin-key'] !== deps.adminKey) {
        res.writeHead(404).end();
        return;
      }
      if (url.pathname === '/admin/kill') guards.kill();
      else guards.revive();
      log.warn(url.pathname === '/admin/kill' ? 'kill_switch_on' : 'kill_switch_off');
      res.writeHead(200).end('ok');
      return;
    }
    serveStatic(deps.staticDir, url.pathname, res);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const sockets = new Set<WebSocket>();

  http.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    const verdict = guards.checkUpgrade({ ip: clientIp(req, hosted), origin: req.headers.origin, host: req.headers.host });
    if (!verdict.ok) {
      log.warn('upgrade_refused', { code: verdict.code, status: verdict.status });
      socket.write(`HTTP/1.1 ${verdict.status} Refused\r\nConnection: close\r\nX-Reason: ${verdict.code}\r\n\r\n`);
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      sockets.add(ws);
      ws.on('close', () => sockets.delete(ws));
      new ClientSession(ws, deps, guards).start();
    });
  });

  await new Promise<void>((resolve) => http.listen(config.port, config.host, resolve));
  const port = (http.address() as AddressInfo).port;
  log.info('gateway_listening', { port, mode: config.mode });

  return {
    port,
    url: `http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${port}`,
    guards,
    async close() {
      for (const s of sockets) s.terminate();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}

function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function serveStatic(dir: string | undefined, pathname: string, res: import('node:http').ServerResponse): void {
  if (!dir || !existsSync(dir)) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('The web app is not built. Run: npm run build');
    return;
  }
  const safe = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  let file = join(dir, safe || 'index.html');
  if (!file.startsWith(dir)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) file = join(dir, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'permissions-policy': 'microphone=(self)',
  });
  createReadStream(file).pipe(res);
}

/** One phone. Owns its warm STT socket, its warm TTS socket, and its audio accounting. */
class ClientSession {
  private readonly id = randomUUID();
  private stt: SttLink | null = null;
  private tts: TtsLink | null = null;
  private lang: Lang = 'hi';
  private ready = false;
  private pttActive = false;
  private pttUpAt = 0;
  private inbound: Buffer[] = [];
  private inboundBytes = 0;
  private sttReady: Promise<void> | null = null;
  private activeTts = new Set<string>();
  private idleTimer: NodeJS.Timeout | null = null;
  private parseCalls: number[] = [];
  private closed = false;

  constructor(
    private readonly ws: WebSocket,
    private readonly deps: GatewayDeps,
    private readonly guards: Guards,
  ) {}

  start(): void {
    this.guards.admit(this.id);
    this.deps.log.info('session_open', { sid: this.id.slice(0, 6) });
    this.ws.on('message', (data, isBinary) => void this.onMessage(data, isBinary));
    this.ws.on('close', (code) => {
      this.deps.log.info('client_socket_closed', { sid: this.id.slice(0, 6), code });
      this.cleanup();
    });
    this.ws.on('error', (e: Error & { code?: string }) => {
      this.deps.log.warn('client_socket_error', { sid: this.id.slice(0, 6), code: e.code ?? 'unknown' });
      this.cleanup();
    });
    this.idleTimer = setInterval(() => {
      if (this.stt?.isOld && !this.pttActive) void this.ensureStt(true);
    }, 30_000);
  }

  private cleanup(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.stt?.close();
    this.tts?.close();
    this.guards.release(this.id);
    this.deps.log.info('session_closed', { activeSessions: this.guards.activeSessions });
  }

  private json(obj: Record<string, unknown>): void {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(obj));
  }
  private fail(code: string, recoverable: boolean): void {
    this.json({ type: 'error', code, recoverable });
  }
  private failFrom(e: unknown): void {
    const g = e instanceof GnaniError ? e : new GnaniError('unavailable', true);
    const m = CLIENT_CODE[g.code] ?? { code: 'network', recoverable: true };
    this.fail(m.code, m.recoverable);
    // Out of credit in a public deployment: stop spending anything further.
    if (g.code === 'no_credit' && this.deps.config.mode === 'hosted') {
      this.guards.kill();
      this.deps.log.error('credit_exhausted_kill_switch');
    }
  }
  private budget(seconds: number): boolean {
    const v = this.guards.recordAudio(this.id, seconds);
    if (!v.ok) {
      this.fail(v.code, false);
      this.ws.close(1008, v.code);
      return false;
    }
    return true;
  }

  private ensureStt(force = false): Promise<void> {
    if (!force && this.stt?.isOpen) return Promise.resolve();
    if (this.sttReady) return this.sttReady;
    const key = this.deps.config.gnaniApiKey ?? '';
    const p = (async () => {
      let delay = 400;
      for (let attempt = 0; attempt < 4 && !this.closed; attempt++) {
        const link = new SttLink({ baseUrl: this.deps.config.gnaniBaseUrl, apiKey: key, log: this.deps.log }, this.lang);
        try {
          await link.connect();
          if (this.closed) {
            link.close(); // the phone left while we were connecting: do not leave a speech session open
            return;
          }
          this.stt?.close();
          this.stt = link;
          link.on('closed', () => {
            if (this.stt === link) this.deps.log.info('stt_closed');
          });
          return;
        } catch (e) {
          this.deps.log.warn('stt_connect_failed', { code: e instanceof GnaniError ? e.code : 'unknown', attempt });
          if (!(e instanceof GnaniError) || !e.recoverable) throw e;
          await new Promise((r) => setTimeout(r, delay)); // backoff on 429 and network errors
          delay *= 2;
        }
      }
      throw new GnaniError('unavailable', true);
    })().finally(() => {
      this.sttReady = null;
    });
    this.sttReady = p;
    return p;
  }

  private async onMessage(data: RawData, isBinary: boolean): Promise<void> {
    try {
      if (isBinary) return this.onAudio(data as Buffer);
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch {
        return this.fail('bad_message', true);
      }
      const type = m['type'];
      if (type === 'hello') return await this.onHello(m);
      if (!this.ready) return this.fail('no_hello', true);
      switch (type) {
        case 'ptt_down': return await this.onPttDown();
        case 'ptt_up': return await this.onPttUp();
        case 'context': return this.onContext(m);
        case 'speak': return await this.onSpeak(m);
        case 'interrupt': return this.onInterrupt();
        case 'parse': return await this.onParse(m);
        default: return this.fail('bad_message', true);
      }
    } catch (e) {
      this.failFrom(e);
    }
  }

  private async onHello(m: Record<string, unknown>): Promise<void> {
    const verdict = this.guards.checkHello({
      ...(typeof m['accessCode'] === 'string' ? { accessCode: m['accessCode'] } : {}),
      ...(typeof m['token'] === 'string' ? { token: m['token'] } : {}),
    });
    if (!verdict.ok) {
      this.fail(verdict.code, false);
      this.ws.close(1008, verdict.code);
      return;
    }
    this.lang = isLang(m['lang']) ? m['lang'] : 'hi';
    this.ready = true;
    const key = this.deps.config.gnaniApiKey ?? '';
    this.tts = new TtsLink({ baseUrl: this.deps.config.gnaniBaseUrl, apiKey: key, log: this.deps.log });
    // Both sockets are opened now, so the first turn has nothing to wait for.
    const warm = await Promise.allSettled([this.ensureStt(), this.tts.warm()]);
    if (this.closed) {
      this.stt?.close();
      this.tts?.close();
      return;
    }
    const bad = warm.find((r) => r.status === 'rejected');
    if (bad && bad.status === 'rejected') this.failFrom(bad.reason);
    this.deps.log.info('session_ready', { sid: this.id.slice(0, 6), degraded: Boolean(bad) });
    this.json({ type: 'ready', token: verdict.token, mode: this.deps.config.mode, llm: Boolean(this.deps.llm), degraded: Boolean(bad) });
  }

  private onAudio(buf: Buffer): void {
    if (!this.pttActive) return; // audio outside a press is dropped
    if (this.sttReady) {
      this.inbound.push(buf);
      this.inboundBytes += buf.length;
      return;
    }
    this.inboundBytes += buf.length;
    this.stt?.sendAudio(buf);
  }

  private async onPttDown(): Promise<void> {
    this.onInterrupt(); // pressing the button talks over the agent
    this.pttActive = true;
    this.inbound = [];
    this.inboundBytes = 0;
    const wait = this.ensureStt();
    this.stt?.resetUtterance();
    try {
      await wait;
    } catch (e) {
      this.pttActive = false;
      throw e;
    }
    this.stt?.resetUtterance();
    for (const b of this.inbound) this.stt?.sendAudio(b);
    this.inbound = [];
    this.json({ type: 'speech_start' });
  }

  private async onPttUp(): Promise<void> {
    if (!this.pttActive) return;
    this.pttActive = false;
    this.pttUpAt = Date.now();
    if (this.sttReady) await this.sttReady.catch(() => undefined);
    if (this.inboundBytes < 3200) {
      // Under 100 ms of audio: a tap, not speech.
      this.json({ type: 'transcript', text: '', lang: this.lang, sttMs: 0, audioMs: Math.round(this.inboundBytes / 32) });
      return;
    }
    if (!this.stt?.isOpen) await this.ensureStt();
    const t = await this.stt!.commit();
    if (!this.budget(t.audioMs / 1000)) return;
    this.json({ type: 'transcript', text: t.text, lang: t.lang, sttMs: t.sttMs, audioMs: t.audioMs, v3: t.v3 });
    this.json({ type: 'metric', name: 'release_to_transcript_ms', ms: Date.now() - this.pttUpAt });
    this.deps.log.info('turn_stt', { sttMs: t.sttMs, audioMs: t.audioMs });
  }

  private onContext(m: Record<string, unknown>): void {
    const terms: string[] = [];
    for (const key of ['names', 'keyterms']) {
      const arr = m[key];
      if (Array.isArray(arr)) for (const x of arr) if (typeof x === 'string' && x.length > 0 && x.length <= 40) terms.push(x);
    }
    this.stt?.setBias(terms);
  }

  private async onSpeak(m: Record<string, unknown>): Promise<void> {
    const id = typeof m['id'] === 'string' ? m['id'] : '';
    const text = typeof m['text'] === 'string' ? m['text'].slice(0, 300) : '';
    const lang = isLang(m['lang']) ? m['lang'] : this.lang;
    if (!id || !text || !this.tts) return this.fail('bad_message', true);
    this.activeTts.add(id);
    const asked = Date.now();
    let first = 0;
    try {
      const r = await this.tts.speak({
        id, text, lang,
        onStart: () => {
          if (!this.activeTts.has(id)) return;
          first = Date.now() - asked;
          this.json({ type: 'tts_start', id });
        },
        onChunk: (pcm) => {
          // Late chunks of an interrupted sentence are never forwarded.
          if (this.activeTts.has(id) && this.ws.readyState === this.ws.OPEN) this.ws.send(pcm, { binary: true });
        },
      });
      if (r.outcome === 'done' && this.activeTts.delete(id)) {
        this.json({ type: 'tts_end', id });
        this.json({ type: 'metric', name: 'tts_first_audio_ms', id, ms: first });
        this.budget(r.audioMs / 1000);
      }
    } catch (e) {
      this.activeTts.delete(id);
      this.json({ type: 'tts_end', id, failed: true });
      this.failFrom(e);
    }
  }

  private onInterrupt(): void {
    if (!this.activeTts.size) return;
    const ids = [...this.activeTts];
    this.activeTts.clear(); // from this line on, nothing for these ids is forwarded
    this.tts?.interrupt();
    for (const id of ids) this.json({ type: 'tts_end', id, interrupted: true });
  }

  private async onParse(m: Record<string, unknown>): Promise<void> {
    const id = typeof m['id'] === 'string' ? m['id'] : '';
    const text = typeof m['text'] === 'string' ? m['text'].slice(0, 500) : '';
    if (!this.deps.llm || !text) return this.json({ type: 'parsed', id, raw: null });
    const now = Date.now();
    this.parseCalls = this.parseCalls.filter((t) => now - t < 60_000);
    if (this.parseCalls.length >= 20) return this.json({ type: 'parsed', id, raw: null, limited: true });
    this.parseCalls.push(now);
    const raw = await this.deps.llm(text);
    this.json({ type: 'parsed', id, raw });
  }
}
