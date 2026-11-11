/**
 * The phone's connection to the speech gateway (one WebSocket, `/ws`). Reconnects with backoff, carries the
 * session token across reconnects, and exposes the protocol from PLAN section 2.3 as plain methods and callbacks.
 */
import type { Lang } from '../contract.js';

export type GatewayState = 'connecting' | 'open' | 'closed';

export interface Transcript {
  text: string;
  lang: string;
  sttMs: number;
  audioMs: number;
}
export interface GatewayError {
  code: string;
  recoverable: boolean;
}

export interface GatewayEvents {
  onState?(s: GatewayState): void;
  onReady?(info: { mode: string; llm: boolean; degraded: boolean }): void;
  onSpeechStart?(): void;
  onTranscript?(t: Transcript): void;
  onTtsStart?(id: string): void;
  onTtsEnd?(id: string, how: { interrupted: boolean; failed: boolean }): void;
  onAudio?(pcm: ArrayBuffer): void;
  onMetric?(name: string, ms: number, id?: string): void;
  onError?(e: GatewayError): void;
}

interface Options {
  url: string;
  lang: Lang;
  accessCode?: string;
  WebSocketImpl?: typeof WebSocket;
  /** Delays between reconnect attempts. */
  backoffMs?: number[];
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private token: string | undefined;
  private attempt = 0;
  private wantOpen = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private parseWaiters = new Map<string, (raw: unknown) => void>();
  private nextId = 1;
  state: GatewayState = 'closed';
  ready = false;

  constructor(
    private readonly o: Options,
    private readonly ev: GatewayEvents = {},
  ) {}

  setLang(lang: Lang): void {
    this.o.lang = lang;
  }

  connect(): void {
    this.wantOpen = true;
    this.open();
  }

  private setState(s: GatewayState): void {
    this.state = s;
    this.ev.onState?.(s);
  }

  private open(): void {
    if (this.ws && this.ws.readyState <= 1) return;
    this.setState('connecting');
    this.ready = false;
    const WS = this.o.WebSocketImpl ?? WebSocket;
    const ws = new WS(this.o.url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.send({ type: 'hello', lang: this.o.lang, ...(this.o.accessCode ? { accessCode: this.o.accessCode } : {}), ...(this.token ? { token: this.token } : {}) });
    };
    ws.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== 'string') {
        this.ev.onAudio?.(e.data as ArrayBuffer);
        return;
      }
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(e.data) as Record<string, unknown>;
      } catch {
        return;
      }
      this.handle(m);
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.ready = false;
      this.setState('closed');
      for (const [id, w] of this.parseWaiters) {
        w(null);
        this.parseWaiters.delete(id);
      }
      if (this.wantOpen) this.scheduleReconnect();
    };
    ws.onerror = () => undefined;
  }

  private scheduleReconnect(): void {
    const steps = this.o.backoffMs ?? [500, 1000, 2000, 4000, 8000];
    const delay = steps[Math.min(this.attempt, steps.length - 1)]!;
    this.attempt++;
    this.timer = setTimeout(() => this.open(), delay);
  }

  private handle(m: Record<string, unknown>): void {
    switch (m['type']) {
      case 'ready':
        this.ready = true;
        if (typeof m['token'] === 'string') this.token = m['token'];
        this.setState('open');
        this.ev.onReady?.({ mode: String(m['mode']), llm: Boolean(m['llm']), degraded: Boolean(m['degraded']) });
        break;
      case 'speech_start': this.ev.onSpeechStart?.(); break;
      case 'transcript':
        this.ev.onTranscript?.({ text: String(m['text'] ?? ''), lang: String(m['lang'] ?? ''), sttMs: Number(m['sttMs'] ?? 0), audioMs: Number(m['audioMs'] ?? 0) });
        break;
      case 'tts_start': this.ev.onTtsStart?.(String(m['id'])); break;
      case 'tts_end': this.ev.onTtsEnd?.(String(m['id']), { interrupted: m['interrupted'] === true, failed: m['failed'] === true }); break;
      case 'metric': this.ev.onMetric?.(String(m['name']), Number(m['ms']), typeof m['id'] === 'string' ? m['id'] : undefined); break;
      case 'parsed': {
        const w = this.parseWaiters.get(String(m['id']));
        if (w) {
          this.parseWaiters.delete(String(m['id']));
          w(m['raw'] ?? null);
        }
        break;
      }
      case 'error': {
        const e = { code: String(m['code']), recoverable: m['recoverable'] === true };
        // A refused hello (bad access code, killed) is final: do not hammer the server.
        if (!e.recoverable) this.wantOpen = false;
        this.ev.onError?.(e);
        break;
      }
    }
  }

  private send(o: Record<string, unknown>): void {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(o));
  }

  get canSend(): boolean {
    return this.ws?.readyState === 1 && this.ready;
  }

  pttDown(): void { this.send({ type: 'ptt_down' }); }
  pttUp(): void { this.send({ type: 'ptt_up' }); }
  sendAudio(frame: ArrayBuffer): void { if (this.ws?.readyState === 1) this.ws.send(frame); }
  speak(id: string, text: string, lang: Lang): void { this.send({ type: 'speak', id, text, lang }); }
  interrupt(): void { this.send({ type: 'interrupt' }); }
  context(names: string[], keyterms: string[] = []): void { this.send({ type: 'context', names, keyterms }); }

  /** Asks the optional LLM to read a sentence. Resolves with the model's raw output, or null. */
  parse(text: string, timeoutMs = 5000): Promise<unknown> {
    if (!this.canSend) return Promise.resolve(null);
    const id = `p${this.nextId++}`;
    return new Promise((resolve) => {
      const t = setTimeout(() => { this.parseWaiters.delete(id); resolve(null); }, timeoutMs);
      this.parseWaiters.set(id, (raw) => { clearTimeout(t); resolve(raw); });
      this.send({ type: 'parse', id, text });
    });
  }

  close(): void {
    this.wantOpen = false;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
  }
}
