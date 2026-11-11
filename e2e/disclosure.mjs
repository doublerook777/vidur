// CP7 live check: a fresh session in Hindi and in Kannada says it is an AI as its very first spoken line.
// Reads the first `speak` message the phone sends to the gateway, and confirms real audio came back. Spends a few credits.
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { chromium } from 'playwright-core';

const PORT = 8108; const BASE = `http://127.0.0.1:${PORT}`;
const EXE = process.env.CHROME ?? `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MARK = { hi: /एआई|AI/, kn: /ಎಐ|AI/, en: /AI/ };
const server = spawn('npx', ['tsx', 'apps/server/src/index.ts'], { env: { ...process.env, MODE: 'local', PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
for (let i = 0; i < 80; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch {} await sleep(250); }
const browser = await chromium.launch({ executablePath: EXE, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
let bad = 0;
try {
  for (const [lang, idx] of [['hi', 0], ['kn', 2], ['en', 1]]) {
    let result = null;
    for (let attempt = 1; attempt <= 3 && !result; attempt++) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
      const page = await ctx.newPage();
      const speaks = []; let audioFrames = 0;
      page.on('websocket', (w) => { w.on('framesent', (f) => { if (typeof f.payload === 'string' && f.payload.includes('"type":"speak"')) speaks.push(JSON.parse(f.payload)); }); w.on('framereceived', (f) => { if (typeof f.payload !== 'string') audioFrames++; }); });
      await page.goto(`${BASE}/app.html`);
      await page.waitForSelector('button.btn-primary');
      await page.locator('.lang-btn').nth(idx).click();
      await page.locator('button.btn-secondary').click();
      for (let i = 0; i < 60 && (!speaks.length || audioFrames < 5); i++) await sleep(250);
      if (speaks.length && audioFrames >= 5) result = { text: speaks[0].text, lang: speaks[0].lang, audioFrames, count: speaks.length };
      await ctx.close();
    }
    const ok = result && MARK[lang].test(result.text) && result.lang === lang;
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${lang}: first spoken line = ${JSON.stringify(result?.text)}  (language ${result?.lang}, ${result?.audioFrames} audio chunks came back)`);
  }
} finally {
  await browser.close(); server.kill();
}
process.exit(bad ? 1 : 0);
