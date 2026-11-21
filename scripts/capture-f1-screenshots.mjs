import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 8130;
const BASE = `http://127.0.0.1:${PORT}`;
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EXE = process.env.CHROME ?? MAC_CHROME;

mkdirSync('references/screenshots/f1', { recursive: true });

const server = spawn('npx', ['tsx', 'apps/server/src/index.ts'], {
  env: { ...process.env, MODE: 'mock', PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) {
  try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch {}
  await sleep(250);
}

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox'],
});

const page = await browser.newPage({ viewport: { width: 360, height: 740 } });

for (const lang of ['en', 'hi', 'kn']) {
  // 1. Onboarding
  await page.goto(`${BASE}/app.html`);
  await page.waitForSelector('[data-feature="onboarding-disclosure"]');
  await page.evaluate((l) => window.__vidur.actions.setLang(l), lang);
  await sleep(200);
  await page.screenshot({ path: `references/screenshots/f1/onboarding-360-${lang}.png` });

  // Finish onboarding to Home
  await page.locator('#onboarding-shop').fill('Laxmi Store');
  await page.locator('#onboarding-owner').fill('Ramesh');
  await page.locator('button.btn-primary').click();
  await page.waitForSelector('[data-feature="totals"]');
  await sleep(200);

  // 2. B1 Totals on Home
  await page.screenshot({ path: `references/screenshots/f1/home-totals-b1-360-${lang}.png` });

  // 3. Complete profile card on Home
  await page.evaluate(() => window.__vidur.store.update({ showCompleteProfile: true }));
  await sleep(200);
  await page.screenshot({ path: `references/screenshots/f1/home-complete-profile-360-${lang}.png` });

  // 4. Settings (Profile & PIN)
  await page.evaluate(() => window.__vidur.actions.navigate('settings'));
  await sleep(200);
  await page.screenshot({ path: `references/screenshots/f1/settings-profile-360-${lang}.png` });

  // 5. Lock screen
  await page.evaluate(() => window.__vidur.actions.setPin('1234'));
  await sleep(150);
  await page.evaluate(() => window.__vidur.lock());
  await page.waitForSelector('[data-feature="lock-screen"]');
  await sleep(200);
  await page.screenshot({ path: `references/screenshots/f1/lock-360-${lang}.png` });

  // Unlock and clear
  await page.evaluate(() => window.__vidur.actions.unlock('1234'));
  await page.evaluate(() => window.__vidur.actions.deleteAll());
  await sleep(300);
}

console.log('Screenshots captured in references/screenshots/f1/');
await browser.close();
server.kill();
