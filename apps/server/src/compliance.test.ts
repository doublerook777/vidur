import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Repo-level proofs for the project's responsible-AI rules (each `describe` block below is one rule).
 * These search the shipped source, not the tests or docs.
 */
const root = new URL('../../../', import.meta.url).pathname;
const tracked = execFileSync('git', ['ls-files', 'apps', 'packages', 'scripts', 'e2e'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const source = tracked.filter((f) => /\.(ts|tsx|mjs|js|html|css)$/.test(f) && !/\.test\.|\/mock-gnani\/|tables\/|^e2e\//.test(f));
const read = (f: string): string => readFileSync(root + f, 'utf8');
const hits = (re: RegExp, files = source): string[] => files.flatMap((f) => read(f).split('\n').map((l, i) => ({ l, i })).filter(({ l }) => re.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('*')).map(({ i }) => `${f}:${i + 1}`));

describe('rule: no voice cloning', () => {
  it('no clone endpoint, no cloning code', () => {
    expect(hits(/voice[_ -]?clon|clone[_-]?voice|\/clone\b|voice_id_clone|instant[_-]?clone/i)).toEqual([]);
  });
  it('only the stock voices are ever requested', () => {
    const voices = hits(/voice:\s*['"]/);
    expect(voices.length).toBeGreaterThan(0);
    for (const loc of voices) {
      const [f, n] = loc.split(':');
      expect(read(f!).split('\n')[Number(n) - 1]).toMatch(/voice:\s*'(Avinash|Shivani)'/);
    }
  });
});

describe('rule: WebSocket streaming only, no telephony, no phone numbers', () => {
  it('no telephony provider, dialling or SMS code', () => {
    expect(hits(/twilio|exotel|plivo|vonage|knowlarity|\bsip:|\btel:|\bdial(ing|er)?\b|msisdn|\bsms\b|whatsapp\.(send|api)/i)).toEqual([]);
  });
  it('the ledger and screens have no phone-number field', () => {
    const ui = source.filter((f) => f.startsWith('apps/web/src/phone/') || f.startsWith('packages/core/src/ledger'));
    expect(hits(/phoneNumber|mobileNumber|type="tel"|type='tel'|inputMode="tel"/i, ui)).toEqual([]);
  });
  it('the only Gnani endpoints are the STT and TTS sockets', () => {
    const urls = hits(/vachana\.ai/);
    for (const loc of urls) {
      const [f, n] = loc.split(':');
      expect(read(f!).split('\n')[Number(n) - 1]).toMatch(/api\.vachana\.ai(['"`/.]|$)/);
    }
    // The gateway has exactly the two sockets. The doctor script probes the same two, nothing else.
    expect(hits(/\/stt\/v3\/stream|\/api\/v1\/tts/, source.filter((f) => f.startsWith('apps/'))).length).toBe(2);
    expect(hits(/vachana\.ai/, source.filter((f) => f.startsWith('scripts/'))).every((l) => l.startsWith('scripts/doctor.mjs:'))).toBe(true);
    expect(hits(/vachana\.ai\/(api\/v1\/)?(agent|inya|assistant|call|voice-agent|dialog)/i)).toEqual([]);
  });
});

describe('rule: hosted agent platforms are not the core loop', () => {
  it('orchestration is our own code: no hosted agent SDK is a dependency', () => {
    const deps = tracked.filter((f) => f.endsWith('package.json')).map((f) => read(f)).join('\n') + read('package.json');
    expect(deps).not.toMatch(/livekit|vapi|retell|bland|pipecat|elevenlabs|openai-agents|@anthropic-ai\/claude-agent|langchain|langgraph/i);
  });
});

describe('rule: the API key stays on the server and out of git', () => {
  it('.env is git-ignored', () => {
    const ignore = read('.gitignore').split('\n').map((l) => l.trim());
    expect(ignore).toContain('.env');
    expect(ignore).toContain('.env.*');
    expect(ignore).toContain('!.env.example');
  });
  it('browser code never refers to the key or its header', () => {
    const web = source.filter((f) => f.startsWith('apps/web/'));
    expect(hits(/GNANI_API_KEY|x-api-key-id|X-API-Key-ID|LLM_API_KEY/i, web)).toEqual([]);
  });
  it('no key-shaped value is committed anywhere in the working tree', () => {
    const out = execFileSync('node', ['scripts/scan-secrets.mjs'], { cwd: root, encoding: 'utf8' });
    expect(out).toContain('ok');
  });
  it('.env.example has empty key lines only', () => {
    const ex = read('.env.example');
    expect(ex).toMatch(/^GNANI_API_KEY=$/m);
    expect(ex).toMatch(/^LLM_API_KEY=$/m);
  });
});

describe('rule: reminders are shopkeeper-triggered, opt-in and never sent by the app', () => {
  it('the app has no code that sends a message to a customer', () => {
    // The only outbound path for reminder text is the browser share sheet or the clipboard, started by the shopkeeper.
    const outbound = hits(/navigator\.share|clipboard\.writeText/, source);
    expect(outbound.length).toBeGreaterThan(0);
    expect(outbound.every((l) => l.startsWith('apps/web/src/main.tsx:'))).toBe(true);
    expect(hits(/setInterval|setTimeout|cron|schedule/i, ['packages/core/src/reminders/gate.ts'])).toEqual([]);
  });
  it('the reminder gate is the only place that decides, and it needs consent', () => {
    const gate = read('packages/core/src/reminders/gate.ts');
    expect(gate).toMatch(/no_consent/);
    expect(gate).toMatch(/REMINDER_MIN_GAP_MS = 7 \* 24/);
  });
});

describe('rule: data stays on the device or is encrypted; transcripts are purged', () => {
  it('the vault uses AES-GCM 256 with a non-extractable key and a 24 hour transcript limit', () => {
    const v = read('apps/web/src/phone/storage/vault.ts');
    expect(v).toMatch(/AES-GCM/);
    expect(v).toMatch(/length: 256/);
    expect(v).toMatch(/false \/\* not extractable \*\//);
    expect(v).toMatch(/TRANSCRIPT_TTL_MS = 24 \* 60 \* 60 \* 1000/);
  });
  it('the phone app does not use localStorage for ledger data', () => {
    const phone = source.filter((f) => f.startsWith('apps/web/src/'));
    const uses = hits(/localStorage/, phone);
    expect(uses).toEqual([]);
  });
  it('the server has no database and writes no files', () => {
    const server = source.filter((f) => f.startsWith('apps/server/src/') && !f.endsWith('index.ts'));
    expect(hits(/writeFile|appendFile|createWriteStream|sqlite|postgres|mongodb|redis|better-sqlite/i, server)).toEqual([]);
  });
});
