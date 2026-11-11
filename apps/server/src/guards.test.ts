import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';
import { Guards } from './guards.js';
import { createLogger, PrivacyLogError } from './logger.js';

const hosted = (extra: Record<string, string> = {}) => loadConfig({ MODE: 'hosted', GNANI_API_KEY: 'k', ACCESS_CODE: 'open-sesame-1', ...extra });
const ORIGIN = 'https://vidur.example';

describe('guards in hosted mode', () => {
  it('rejects a bad or missing origin', () => {
    const g = new Guards(hosted({ ALLOWED_ORIGINS: ORIGIN }));
    expect(g.checkUpgrade({ ip: '1.1.1.1', origin: ORIGIN, host: 'x' }).ok).toBe(true);
    expect(g.checkUpgrade({ ip: '1.1.1.1', origin: 'https://evil.example', host: 'x' })).toMatchObject({ ok: false, status: 403, code: 'bad_origin' });
    expect(g.checkUpgrade({ ip: '1.1.1.1', origin: undefined, host: 'x' })).toMatchObject({ ok: false, code: 'bad_origin' });
    expect(g.checkUpgrade({ ip: '1.1.1.1', origin: 'http://localhost:5173', host: 'x' }).ok).toBe(false); // loopback is not trusted when hosted
  });
  it('limits connections per IP per minute, and recovers', () => {
    let now = 0;
    const g = new Guards(hosted({ ALLOWED_ORIGINS: ORIGIN, PER_IP_PER_MINUTE: '3' }), () => now);
    const go = () => g.checkUpgrade({ ip: '9.9.9.9', origin: ORIGIN, host: 'h' });
    expect([go().ok, go().ok, go().ok]).toEqual([true, true, true]);
    expect(go()).toMatchObject({ ok: false, status: 429, code: 'ip_rate_limit' });
    expect(g.checkUpgrade({ ip: '8.8.8.8', origin: ORIGIN, host: 'h' }).ok).toBe(true); // another IP is unaffected
    now += 61_000;
    expect(go().ok).toBe(true);
  });
  it('limits concurrent sessions', () => {
    const g = new Guards(hosted({ ALLOWED_ORIGINS: ORIGIN, MAX_SESSIONS: '2', PER_IP_PER_MINUTE: '100' }));
    g.admit('a');
    g.admit('b');
    expect(g.checkUpgrade({ ip: '1.1.1.1', origin: ORIGIN, host: 'h' })).toMatchObject({ ok: false, code: 'busy' });
    g.release('a');
    expect(g.checkUpgrade({ ip: '1.1.1.1', origin: ORIGIN, host: 'h' }).ok).toBe(true);
  });
  it('needs the access code, and a signed token works for reconnects', () => {
    const g = new Guards(hosted());
    expect(g.checkHello({})).toEqual({ ok: false, code: 'bad_access_code' });
    expect(g.checkHello({ accessCode: 'wrong' })).toEqual({ ok: false, code: 'bad_access_code' });
    const ok = g.checkHello({ accessCode: 'open-sesame-1' });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(g.checkHello({ token: ok.token }).ok).toBe(true);
      expect(g.checkHello({ token: ok.token + 'x' }).ok).toBe(false);
      expect(g.checkHello({ token: '9999999999999.' + 'beef' }).ok).toBe(false);
    }
  });
  it('a token expires', () => {
    let now = 1_000;
    const g = new Guards(hosted(), () => now);
    const r = g.checkHello({ accessCode: 'open-sesame-1' });
    now += 3 * 60 * 60 * 1000;
    expect(r.ok && g.checkHello({ token: r.token }).ok).toBe(false);
  });
  it('caps audio per session and per day', () => {
    const g = new Guards(hosted({ SESSION_AUDIO_CAP_MIN: '1', DAILY_AUDIO_CAP_MIN: '2' }));
    expect(g.recordAudio('s1', 50).ok).toBe(true);
    expect(g.recordAudio('s1', 20)).toMatchObject({ ok: false, code: 'session_cap' });
    expect(g.recordAudio('s2', 50).ok).toBe(true); // total 120 s so far, at the daily cap
    expect(g.recordAudio('s3', 10)).toMatchObject({ ok: false, code: 'daily_cap' });
  });
  it('the daily cap resets the next day', () => {
    let now = Date.UTC(2026, 10, 11, 12);
    const g = new Guards(hosted({ SESSION_AUDIO_CAP_MIN: '100', DAILY_AUDIO_CAP_MIN: '1' }), () => now);
    expect(g.recordAudio('s', 70)).toMatchObject({ ok: false, code: 'daily_cap' });
    now += 24 * 3600 * 1000;
    expect(g.recordAudio('s', 10).ok).toBe(true);
  });
  it('the kill switch stops new sessions, hellos and audio', () => {
    const g = new Guards(hosted({ ALLOWED_ORIGINS: ORIGIN }));
    g.kill();
    expect(g.checkUpgrade({ ip: '1.1.1.1', origin: ORIGIN, host: 'h' })).toMatchObject({ ok: false, status: 503, code: 'killed' });
    expect(g.checkHello({ accessCode: 'open-sesame-1' })).toEqual({ ok: false, code: 'killed' });
    expect(g.recordAudio('s', 1)).toMatchObject({ ok: false, code: 'killed' });
    g.revive();
    expect(g.checkUpgrade({ ip: '1.1.1.1', origin: ORIGIN, host: 'h' }).ok).toBe(true);
  });
});

describe('guards in local mode', () => {
  const local = () => new Guards(loadConfig({ MODE: 'local', GNANI_API_KEY: 'k' }));
  it('allows this machine and has no daily cap', () => {
    const g = local();
    expect(g.checkUpgrade({ ip: '127.0.0.1', origin: 'http://localhost:5173', host: 'localhost:8080' }).ok).toBe(true);
    expect(g.checkUpgrade({ ip: '127.0.0.1', origin: undefined, host: 'localhost:8080' }).ok).toBe(true);
    expect(g.checkUpgrade({ ip: '127.0.0.1', origin: 'https://evil.example', host: 'localhost:8080' }).ok).toBe(false);
    expect(g.recordAudio('s', 1e6).ok).toBe(true);
    expect(g.checkHello({}).ok).toBe(true); // no access code needed
  });
});

describe('privacy logger', () => {
  const lines: string[] = [];
  const log = createLogger((l) => lines.push(l), { strict: true, now: () => 1 });
  it('accepts timings and codes', () => {
    log.info('turn', { sttMs: 184, ttsMs: 120, code: 'ok', recoverable: true });
    expect(JSON.parse(lines.at(-1)!)).toMatchObject({ event: 'turn', sttMs: 184 });
  });
  it.each(['transcript', 'text', 'customerName', 'name', 'utterance', 'amount', 'phone', 'prompt'])('refuses a field called %s', (k) => {
    expect(() => log.info('turn', { [k]: 'x' })).toThrow(PrivacyLogError);
  });
  it('refuses a value that looks like speech', () => {
    expect(() => log.info('turn', { detail: 'रमेश का 340 उधार' })).toThrow(PrivacyLogError);
    expect(() => log.info('turn', { detail: 'Ramesh ka 340 udhaar likh do aur Sunita ne 200 diye hain bhai sab theek' })).toThrow(PrivacyLogError);
  });
  it('in production it redacts instead of throwing, and counts what it dropped', () => {
    const out: string[] = [];
    const prod = createLogger((l) => out.push(l), { strict: false, now: () => 1 });
    prod.info('turn', { ms: 5, transcript: 'रमेश' });
    const j = JSON.parse(out[0]!) as Record<string, unknown>;
    expect(j['transcript']).toBeUndefined();
    expect(j['redacted']).toBe(1);
    expect(out[0]).not.toContain('रमेश');
  });
});
