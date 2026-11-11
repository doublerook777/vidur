import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { Config } from './config.js';

export type Verdict = { ok: true } | { ok: false; status: number; code: string };

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Abuse and credit protection. Everything here is deterministic given a clock, so each limit has a test.
 * In `local` mode the credits belong to the person running it, so only the origin check applies.
 */
export class Guards {
  private readonly secret = randomBytes(32);
  private readonly perIp = new Map<string, number[]>();
  private readonly sessions = new Set<string>();
  private readonly sessionAudio = new Map<string, number>();
  private daily = { day: '', sec: 0 };
  private killed = false;

  constructor(
    private readonly cfg: Pick<Config, 'mode' | 'accessCode' | 'limits'>,
    private readonly clock: () => number = Date.now,
  ) {}

  private get strict(): boolean {
    return this.cfg.mode === 'hosted';
  }

  /** Switch the whole service off (credits are running out, or abuse). New sessions are refused, running ones get closed. */
  kill(): void {
    this.killed = true;
  }
  revive(): void {
    this.killed = false;
  }
  get isKilled(): boolean {
    return this.killed;
  }

  /** Checked on the HTTP upgrade, before a socket exists. */
  checkUpgrade(input: { ip: string; origin: string | undefined; host: string | undefined }): Verdict {
    if (this.killed) return { ok: false, status: 503, code: 'killed' };
    const { origin } = input;
    if (origin) {
      const sameHost = input.host !== undefined && (origin === `http://${input.host}` || origin === `https://${input.host}`);
      const allowed = this.cfg.limits.allowedOrigins.includes(origin);
      if (!allowed && !sameHost && !(this.cfg.mode !== 'hosted' && LOOPBACK.test(origin))) return { ok: false, status: 403, code: 'bad_origin' };
    } else if (this.strict) {
      return { ok: false, status: 403, code: 'bad_origin' };
    }
    if (this.strict) {
      const now = this.clock();
      const recent = (this.perIp.get(input.ip) ?? []).filter((t) => now - t < 60_000);
      if (recent.length >= this.cfg.limits.perIpPerMinute) {
        this.perIp.set(input.ip, recent);
        return { ok: false, status: 429, code: 'ip_rate_limit' };
      }
      recent.push(now);
      this.perIp.set(input.ip, recent);
    }
    if (this.sessions.size >= this.cfg.limits.maxSessions) return { ok: false, status: 503, code: 'busy' };
    return { ok: true };
  }

  /** Checked on the `hello` message. Returns a signed token to reuse when the phone reconnects. */
  checkHello(input: { accessCode?: string; token?: string }): { ok: true; token: string } | { ok: false; code: string } {
    if (this.killed) return { ok: false, code: 'killed' };
    if (this.cfg.accessCode) {
      const viaToken = input.token !== undefined && this.verifyToken(input.token);
      const viaCode = input.accessCode !== undefined && safeEqual(input.accessCode, this.cfg.accessCode);
      if (!viaToken && !viaCode) return { ok: false, code: 'bad_access_code' };
    }
    return { ok: true, token: this.signToken() };
  }

  private signToken(): string {
    const exp = this.clock() + 2 * 60 * 60 * 1000;
    const body = String(exp);
    return `${body}.${createHmac('sha256', this.secret).update(body).digest('hex')}`;
  }
  private verifyToken(token: string): boolean {
    const [body, sig] = token.split('.');
    if (!body || !sig) return false;
    const want = createHmac('sha256', this.secret).update(body).digest('hex');
    return safeEqual(sig, want) && Number(body) > this.clock();
  }

  admit(sessionId: string): void {
    this.sessions.add(sessionId);
  }
  release(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.sessionAudio.delete(sessionId);
  }
  get activeSessions(): number {
    return this.sessions.size;
  }

  /** Counts audio seconds (speech heard plus speech spoken). Returns a refusal once a cap is passed. */
  recordAudio(sessionId: string, seconds: number): Verdict {
    if (this.killed) return { ok: false, status: 503, code: 'killed' };
    if (!this.strict) return { ok: true };
    const used = (this.sessionAudio.get(sessionId) ?? 0) + seconds;
    this.sessionAudio.set(sessionId, used);
    const day = new Date(this.clock()).toISOString().slice(0, 10);
    if (this.daily.day !== day) this.daily = { day, sec: 0 };
    this.daily.sec += seconds;
    if (used > this.cfg.limits.sessionAudioCapSec) return { ok: false, status: 429, code: 'session_cap' };
    if (this.daily.sec > this.cfg.limits.dailyAudioCapSec) return { ok: false, status: 503, code: 'daily_cap' };
    return { ok: true };
  }
  get dailyAudioSec(): number {
    return this.daily.sec;
  }
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
