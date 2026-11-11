// Live smoke test: the real browser, the real gateway, real Gnani speech-to-text and text-to-speech. Spends a few credits.
// The fake microphone loops eval/audio/t14/c00.wav (a Timbre-made Hindi clip, "Ramesh ka 340 udhaar") plus silence.
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { chromium } from 'playwright-core';

const PORT = 8103; const BASE = `http://127.0.0.1:${PORT}`;
const EXE = process.env.CHROME ?? `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn('npx', ['tsx', 'apps/server/src/index.ts'], { env: { ...process.env, MODE: 'local', PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
for (let i = 0; i < 80; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch {} await sleep(250); }
const browser = await chromium.launch({ executablePath: EXE, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-audio-capture=eval/audio/t14/c00.wav', '--autoplay-policy=no-user-gesture-required'] });
let ok = false;
// This machine's network is flaky (sockets sometimes drop mid-press), so the smoke test gets up to three attempts.
async function attempt(n) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  const st = (expr) => page.evaluate(`(() => { const s = window.__vidur.state; return ${expr}; })()`);
  const waitFor = async (expr, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await st(expr)) return true; await sleep(100); } return false; };
  console.log(`--- attempt ${n}`);
  await page.goto(`${BASE}/app.html`);
  await page.waitForSelector('button.btn-primary');
  await page.locator('button.btn-primary').click(); // Hindi, demo data
  await page.waitForSelector('[data-feature="mic-button"]');
  console.log('mock mode label shown:', await st('s.mockMode'), '(must be false: this is real speech)');
  await waitFor('s.online', 8000);
  await waitFor("s.phase === 'speaking'", 8000);
  const disclosureAt = Date.now();
  const finished = await waitFor("s.phase === 'idle'", 20000);
  console.log('AI disclosure spoken by real Timbre and finished:', finished, `(${Date.now() - disclosureAt} ms of speech)`);
  await waitFor('s.online', 12000);
  const b = await page.locator('[data-feature="mic-button"]').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await sleep(14000); await page.mouse.up();
  const got = await waitFor('s.lastEndToAudioMs !== null', 15000);
  await waitFor("s.phase === 'idle' || s.phase === 'needs_answer'", 15000);
  const s = await st('({ e2a: s.lastEndToAudioMs, card: s.card, error: s.error?.text, online: s.online })');
  console.log('real speech turn: reply audio arrived:', got, '| release to first audio:', s.e2a, 'ms | error:', s.error ?? 'none');
  console.log('heard:', s.card?.heard);
  console.log('what the agent said:', s.card?.agentLine);
  await ctx.close();
  return got;
}
try {
  for (let n = 1; n <= 3 && !ok; n++) ok = await attempt(n);
} finally {
  await browser.close(); server.kill();
  console.log('gateway log lines with Devanagari:', log.split('\n').filter((l) => /[\u0900-\u097f]/.test(l)).length);
}
process.exit(ok ? 0 : 1);
