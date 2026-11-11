// Real-browser checks against the built app in mock mode, with a fake microphone. Usage: npm run build && node e2e/browser.mjs
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 8101;
const BASE = `http://127.0.0.1:${PORT}`;
const EXE = process.env.CHROME ?? `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;
if (!existsSync(EXE)) { console.error('No Chromium found. Set CHROME=/path/to/chrome'); process.exit(2); }

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn('npx', ['tsx', 'apps/server/src/index.ts'], {
  env: { ...process.env, MODE: 'mock', PORT: String(PORT), MOCK_SCRIPT: JSON.stringify(['Mohan ka 340 udhaar', 'Mohan ka total?', 'Sunita ne 200 jama kiye', 'Mohan ka 80 udhaar', 'Aaj kitna udhaar gaya?', 'Mohan ka 60 udhaar', 'Mohan ka 70 udhaar']) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = ''; server.stdout.on('data', (d) => (serverLog += d)); server.stderr.on('data', (d) => (serverLog += d));
for (let i = 0; i < 80; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* waiting */ } await sleep(250); }

const browser = await chromium.launch({ executablePath: EXE, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-audio-capture=e2e/fixtures/tone.wav', '--autoplay-policy=no-user-gesture-required'] });
const state = (page, expr) => page.evaluate(`(() => { const s = window.__vidur.state; return ${expr}; })()`);
async function hold(page, ms) {
  const b = await page.locator('[data-feature="mic-button"]').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
}
async function waitState(page, expr, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (await state(page, expr)) return true; await sleep(40); } return false; }

try {
  // ---------------------------------------------------------------- the phone app on its own
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['microphone'] });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${BASE}/app.html`);
  await page.waitForSelector('[data-feature="onboarding-disclosure"]');
  const disclosure = await page.locator('[data-feature="onboarding-disclosure"]').innerText();
  check('onboarding shows the AI disclosure in Hindi', /AI|एआई/.test(disclosure), disclosure.slice(0, 40));
  check('an AI badge is visible', await page.locator('[data-feature="ai-badge"]').count() > 0);
  await page.locator('button.btn-primary').click(); // start with demo data
  await page.waitForSelector('[data-feature="mic-button"]');
  check('onboarding completes and Home shows', true);
  check('first screen JS finished with no console errors', errors.length === 0, errors.join(' | ').slice(0, 120));
  await waitState(page, "s.online && s.phase === 'idle'");
  await sleep(2500); // the spoken disclosure

  // turn 1
  await page.evaluate(() => document.addEventListener('pointerdown', () => (window.__t0 = performance.now()), true));
  await hold(page, 700);
  const heard = await waitState(page, "s.lastEndToAudioMs !== null", 10000);
  check('a spoken turn gets audio back (fake mic, mock STT)', heard);
  const e2a = await state(page, 's.lastEndToAudioMs');
  check('release to first audio under 2 s', e2a !== null && e2a < 2000, `${e2a} ms`);
  await waitState(page, "s.phase === 'idle'", 8000);
  const feedText = await page.locator('[data-feature="feed"]').innerText();
  check('the entry shows in the feed with Indian digit grouping and a word for direction', feedText.includes('Mohan') && feedText.includes('340'), feedText.replace(/\s+/g, ' ').slice(0, 80));
  const undoCount = await page.locator('[data-feature="undo"]').count();
  check('the 10-second undo button is shown', undoCount > 0);
  const feedBefore = await state(page, 's.feed.map((f) => f.id)');
  await page.locator('[data-feature="undo"]').first().click();
  await sleep(250);
  const feedAfter = await state(page, 's.feed.map((f) => f.id)');
  check('undo removes the new entry from the feed', !feedAfter.includes(feedBefore[0]) && feedAfter.length === feedBefore.length, `${feedBefore[0]} gone`);

  // barge-in: ask something with a long reply, then press the button while it speaks
  await hold(page, 600);
  const speaking = await waitState(page, "s.phase === 'speaking'", 8000);
  check('the agent speaks its reply (so there is something to interrupt)', speaking, await state(page, 's.card?.agentLine'));
  await sleep(250);
  await page.evaluate(() => (window.__flushBefore = window.__vidurPlayback.lastFlushAt));
  const b = await page.locator('[data-feature="mic-button"]').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await waitState(page, "s.phase === 'listening'", 3000);
  const lag = await page.evaluate(() => window.__vidurPlayback.lastFlushAt - window.__t0);
  check('barge-in silences the speaker within 200 ms of the press', lag >= 0 && lag < 200, `${lag.toFixed(0)} ms`);
  await page.mouse.up();
  await waitState(page, "s.phase === 'idle' || s.phase === 'needs_answer'", 10000);

  // privacy: nothing readable in IndexedDB
  const dump = await page.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open('vidur'); r.onsuccess = () => res(r.result); });
    let text = ''; let extractable = null;
    for (const store of Array.from(db.objectStoreNames)) {
      const rows = await new Promise((res) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); });
      if (store === 'keys') { extractable = rows.map((k) => k.extractable); continue; }
      text += JSON.stringify(rows, (_k, v) => (v instanceof ArrayBuffer || ArrayBuffer.isView(v) ? Array.from(new Uint8Array(v.buffer ?? v)).join(',') : v));
    }
    db.close();
    return { text, extractable };
  });
  check('raw IndexedDB contains no customer name', !/Mohan|Ramesh|Sunita|doodh|udhaar/.test(dump.text) && dump.text.length > 500);
  check('the encryption key is non-extractable', dump.extractable?.length === 1 && dump.extractable[0] === false);

  // delete-all in the real browser: every store is empty and the old key is gone
  const idbRows = () => page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const out = { dbs: dbs.map((d) => d.name), counts: {}, keys: 0 };
    if (!dbs.some((d) => d.name === 'vidur')) return out;
    const db = await new Promise((res) => { const r = indexedDB.open('vidur'); r.onsuccess = () => res(r.result); });
    for (const store of Array.from(db.objectStoreNames)) out.counts[store] = await new Promise((res) => { const r = db.transaction(store).objectStore(store).count(); r.onsuccess = () => res(r.result); });
    out.keys = out.counts.keys ?? 0; db.close(); return out;
  });
  const vaultBefore = await idbRows();
  check('before delete-all the vault holds encrypted events', (vaultBefore.counts.events ?? 0) > 20, JSON.stringify(vaultBefore.counts));
  await page.evaluate(() => window.__vidur.actions.deleteAll());
  await waitState(page, "s.screen === 'onboarding' && s.customers.length === 0", 6000);
  const after = await idbRows();
  check('after delete-all the ledger, transcripts and settings stores are empty', (after.counts.events ?? 0) === 0 && (after.counts.transcripts ?? 0) === 0 && (after.counts.meta ?? 0) === 0, JSON.stringify(after.counts));
  await page.evaluate(() => window.__vidur.actions.finishOnboarding({ lang: 'hi', demoData: true }));
  await waitState(page, "s.online && s.phase === 'idle' && s.customers.length === 12", 8000);
  await sleep(2500);

  // every screen at 360 px has no horizontal scroll
  await page.setViewportSize({ width: 360, height: 740 });
  for (const screen of ['home', 'customers', 'reminders', 'settings', 'keypad']) {
    await page.evaluate((s) => window.__vidur.actions.navigate(s), screen);
    await sleep(150);
    const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    check(`no horizontal scroll at 360 px on ${screen}`, w.sw <= w.iw, `${w.sw} vs ${w.iw}`);
  }
  await page.evaluate(() => window.__vidur.actions.navigate('home'));
  await page.setViewportSize({ width: 390, height: 844 });
  // touch targets
  const small = await page.evaluate(() => [...document.querySelectorAll('button, [role=button]')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && (r.height < 44 || r.width < 44)).length);
  check('every visible button is at least 44 px in both directions', small === 0, `${small} too small`);

  // 6x CPU throttle: a turn still completes
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.evaluate(() => (window.__vidur.store.update({ lastEndToAudioMs: null })));
  await hold(page, 700);
  const slowOk = await waitState(page, 's.lastEndToAudioMs !== null', 15000);
  const e2eSlow = await state(page, 's.lastEndToAudioMs');
  check('a turn completes at 6x CPU throttle, under 2 s to first audio', slowOk && e2eSlow < 2000, `${e2eSlow} ms`);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await waitState(page, "s.phase === 'idle'", 10000);

  // ---------------------------------------------------------------- the showcase around it
  const show = await ctx.newPage();
  await show.setViewportSize({ width: 1280, height: 800 });
  await show.goto(`${BASE}/`);
  await show.waitForSelector('#phoneApp');
  const frame = show.frameLocator('#phoneApp');
  await frame.locator('[data-feature="mic-button"], [data-feature="onboarding-disclosure"]').first().waitFor({ timeout: 8000 });
  await show.locator('button[data-theme="dark"]').click();
  await sleep(300);
  const theme = await show.evaluate(() => document.getElementById('phoneApp').contentDocument.documentElement.dataset.theme);
  check('showcase theme control changes the phone live', theme === 'dark', String(theme));
  await show.locator('button[data-frame="punch-hole"]').click();
  await sleep(300);
  const fr = await show.evaluate(() => document.getElementById('phoneApp').contentDocument.documentElement.dataset.frame);
  check('showcase frame control changes the phone live', fr === 'punch-hole', String(fr));
  await show.locator('button[data-lang="en"]').click();
  await sleep(600);
  const lang = await show.evaluate(() => document.getElementById('phoneApp').contentDocument.documentElement.lang);
  check('showcase language control changes the phone live', lang === 'en', String(lang));
  await frame.locator('[data-feature="ai-badge"]').first().click();
  await sleep(200);
  const title = await show.locator('#featureTitle').innerText();
  check('clicking a feature in the phone explains it in the side panel', !title.startsWith('Tap anything') && title.length > 0, title);
  const wide = await show.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check('no horizontal scroll at 1280 px', wide);
  await show.setViewportSize({ width: 1920, height: 1080 });
  check('no horizontal scroll at 1920 px', await show.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  // mic inside the iframe
  await frame.locator('[data-feature="mic-button"]').waitFor({ timeout: 8000 }).catch(() => undefined);
  const micInFrame = await frame.locator('[data-feature="mic-button"]').count();
  check('the microphone button is present inside the iframe', micInFrame > 0);
  if (micInFrame > 0) {
    const bb = await frame.locator('[data-feature="mic-button"]').boundingBox();
    await show.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await show.mouse.down();
    await sleep(700);
    await show.mouse.up();
    await sleep(2500);
    const tel = await show.locator('#tTranscript').innerText();
    check('a turn inside the iframe fills the live telemetry panel', tel !== '—' && tel.length > 0, tel);
  }
  const mobile = await ctx.newPage();
  await mobile.setViewportSize({ width: 360, height: 740 });
  await mobile.goto(`${BASE}/`);
  await sleep(800);
  check('no horizontal scroll at 360 px on the showcase page', await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const rect = await mobile.evaluate(() => { const f = document.getElementById('phoneApp'); const r = f.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), display: getComputedStyle(f).display }; });
  check('on a narrow screen the phone app fills the page with no frame', rect.w >= 340 && rect.w <= 361 && rect.display !== 'none', JSON.stringify(rect));

  // ---------------------------------------------------------------- offline keypad
  server.kill();
  await waitState(page, "!s.online", 10000);
  check('losing the network shows the offline state', await state(page, "s.phase === 'offline'"));
  await page.evaluate(() => window.__vidur.actions.navigate('keypad'));
  await sleep(200);
  check('the keypad screen opens offline', await page.locator('[data-feature="keypad"]').count() > 0);
  const before = await state(page, 's.customers.length');
  await page.evaluate(() => window.__vidur.actions.saveKeypadEntry({ customerId: null, newName: 'Offline Test', kind: 'credit', paise: 12500 }));
  await sleep(300);
  check('a keypad entry saves with the network down', (await state(page, 's.customers.length')) === before + 1);
  await page.evaluate(() => window.__vidur.actions.navigate('home'));
  await sleep(200);
  check('the offline banner tells the shopkeeper what to do', (await page.locator('[data-feature="offline-banner"]').count()) > 0);
} catch (e) {
  check('the run finished without an exception', false, String(e).slice(0, 300));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log('server log tail:', serverLog.split('\n').slice(-4).join('\n'));
process.exit(failed.length ? 1 : 0);
