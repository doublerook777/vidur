// End-to-end latency in a real browser with real Gnani speech: release of the mic button to the first audio of the reply.
// The fake microphone loops a Hindi clip, so every press contains the phrase. Spends credits (about 2 audio minutes).
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const N = Number(process.argv[2] ?? 20);
const LANG = process.argv[3] ?? 'hi'; // hi | en | kn (hinglish uses hi)
const CLIP = process.argv[4] ?? 'eval/audio/t14/c00.pcm';
const PORT = 8106; const BASE = `http://127.0.0.1:${PORT}`;
const EXE = process.env.CHROME ?? `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const server = spawn('npx', ['tsx', 'apps/server/src/index.ts'], { env: { ...process.env, MODE: 'local', PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
let slog = ''; server.stdout.on('data', (d) => (slog += d)); server.stderr.on('data', (d) => (slog += d));
for (let i = 0; i < 80; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch {} await sleep(250); }
const browser = await chromium.launch({ executablePath: EXE, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-audio-capture=eval/audio/loop35.wav', '--autoplay-policy=no-user-gesture-required'] });
const lat = []; let failed = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  const clipB64 = readFileSync(CLIP).toString('base64');
  await page.addInitScript((b64) => { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); window.__vidurTestClip = new Int16Array(u8.buffer); }, clipB64);
  const st = (e) => page.evaluate(`(() => { const s = window.__vidur.state; return ${e}; })()`);
  const waitFor = async (e, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await st(e)) return true; await sleep(80); } return false; };
  await page.goto(`${BASE}/app.html`);
  await page.waitForSelector('button.btn-primary');
  await page.locator('.lang-btn').nth({ hi: 0, en: 1, kn: 2 }[LANG] ?? 0).click();
  await page.locator('button.btn-secondary').click(); // clean start, no demo data
  await page.waitForSelector('[data-feature="mic-button"]');
  await waitFor("s.online && s.phase === 'speaking'", 8000);
  await waitFor("s.phase === 'idle'", 25000);
  for (let i = 0; i < N; i++) {
    await waitFor('s.online', 15000);
    await page.evaluate(() => window.__vidur.store.update({ lastEndToAudioMs: null }));
    const b = await page.locator('[data-feature="mic-button"]').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down(); await sleep(Math.round((readFileSync(CLIP).length / 32) + 250)); await page.mouse.up();
    const ok = await waitFor('s.lastEndToAudioMs !== null', 12000);
    if (ok) { const ms = await st('s.lastEndToAudioMs'); lat.push(ms); process.stdout.write(`${ms} `); } else { failed++; process.stdout.write('X '); if (failed <= 2) console.log('\n  state:', JSON.stringify(await st('({ phase: s.phase, online: s.online, err: s.error?.text, card: s.card })')).slice(0, 300)); }
    await waitFor("s.phase === 'idle' || s.phase === 'needs_answer'", 15000);
    if (i === 0 || i === N - 1) console.log('\n  heard:', await st('s.card?.heard'), '| agent:', await st('s.card?.agentLine'), '| first entry:', JSON.stringify(await st('s.feed[0] && [s.feed[0].customerName, s.feed[0].kind, s.feed[0].paise / 100]')));
    await sleep(300);
  }
  if (failed) console.log('gateway log tail:\n' + slog.split('\n').slice(-14).join('\n'));
  console.log(`\nturns ${N}, replied ${lat.length}, failed ${failed}`);
  console.log(`release to first audio (browser, real STT and TTS): p50 ${pct(lat, 50)} ms, p95 ${pct(lat, 95)} ms, max ${Math.max(...lat)} ms`);
} finally {
  await browser.close(); server.kill();
}
