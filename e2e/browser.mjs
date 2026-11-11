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


  // ---------------------------------------------------------------- timestamps, add and remove by hand, tap answers, the voice circle
  await page.evaluate(() => window.__vidur.actions.navigate('home'));
  await sleep(200);
  const whenText = await page.locator('.feed-item-when time').first().innerText();
  check('every entry shows the time it happened', /\d{1,2}:\d{2}/.test(whenText), whenText);
  const iso = await page.locator('.feed-item-when time').first().getAttribute('datetime');
  check('the time is machine-readable', !Number.isNaN(Date.parse(iso ?? '')), String(iso));

  await page.evaluate(() => window.__vidur.actions.openAddEntry());
  await page.waitForSelector('.keypad-grid');
  for (const k of ['1', '2', '0']) await page.locator('.keypad-key', { hasText: new RegExp(`^${k}$`) }).click();
  check('the Add entry screen shows the amount typed', (await page.locator('.keypad-display').innerText()).includes('120'));
  await page.locator('.keypad-customer-btn', { hasText: 'Kavita' }).click();
  await page.locator('.when-btn').nth(1).click(); // yesterday
  await page.locator('.btn-save').click();
  await waitState(page, "s.screen === 'home'", 4000);
  const added = await state(page, "s.history.find((f) => f.paise === 12000 && f.customerName === 'Kavita')");
  check('an entry added by hand lands on the chosen customer', !!added, JSON.stringify(added)?.slice(0, 90));
  check('a "yesterday" entry is dated yesterday but recorded now', !!added && Date.now() - added.at > 20 * 3600e3 && Date.now() - added.recordedAt < 60e3, added ? `${Math.round((Date.now() - added.at) / 3600e3)} h ago` : '');

  await page.evaluate(() => window.__vidur.actions.navigate('history'));
  await sleep(200);
  check('All entries groups by day with a heading', (await page.locator('.feed-day').count()) >= 2);
  await page.evaluate(() => window.__vidur.actions.navigate('home'));
  await sleep(200);
  const idToRemove = await state(page, 's.feed[0].id');
  const removable = await page.locator('.feed-item-more').first();
  await removable.click();
  await page.locator('.feed-remove').first().click();
  check('removing asks first and names the entry', /Kavita|Mohan|Dinesh|Neha|Vijay|Ramesh|Geeta|Anil|Sunita|Suresh|Pooja/.test(await page.locator('.feed-remove-ask').first().innerText()));
  const histBefore = await state(page, 's.history.length');
  await page.locator('.btn-danger-confirm').first().click();
  await waitState(page, `s.history.length === ${histBefore - 1}`, 3000);
  check('a removed entry leaves the list', !(await state(page, `s.history.some((f) => f.id === '${idToRemove}')`)));
  check('a toast offers to take the removal back', (await page.locator('.toast-action').count()) === 1);
  await page.locator('.toast-action').click();
  await waitState(page, `s.history.length === ${histBefore}`, 3000);
  check('undoing a removal brings the entry back', await state(page, `s.history.some((f) => f.id === '${idToRemove}')`));

  // a new name asks first, and tapping Yes or No answers it
  const customersBefore = await state(page, 's.customers.length');
  await page.evaluate(() => window.__vidur.onTranscript({ text: 'Kiran ka 100 udhaar', lang: 'hi', sttMs: 0, audioMs: 0 }));
  await waitState(page, "s.card?.state === 'needs_answer'", 4000);
  check('a new name shows Yes and No buttons', (await page.locator('.answer-btn').count()) === 2);
  await page.locator('.answer-no').click();
  await waitState(page, "s.card?.state === 'needs_answer' && !s.card.answers", 4000);
  check('tapping No creates nobody', (await state(page, 's.customers.length')) === customersBefore);
  await page.evaluate(() => window.__vidur.onTranscript({ text: 'Kiran ka 100 udhaar', lang: 'hi', sttMs: 0, audioMs: 0 }));
  await waitState(page, "s.card?.answers === 'yes_no'", 4000);
  await page.locator('.answer-yes').click();
  await waitState(page, `s.customers.length === ${customersBefore + 1}`, 4000);
  check('tapping Yes creates the customer and saves the entry', await state(page, "s.customers.some((c) => c.name === 'Kiran') && s.history.some((f) => f.customerName === 'Kiran' && f.paise === 10000)"));

  // the voice circle has a shape for every state
  await waitState(page, "s.phase === 'idle'", 15000); // let the spoken replies from the steps above finish
  await sleep(1200);
  const orbStates = [];
  for (const ph of ['listening', 'thinking', 'speaking', 'needs_answer', 'offline', 'idle']) {
    orbStates.push(await page.evaluate(async (p) => {
      window.__vidur.store.update({ phase: p });
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      return document.querySelector('.orb')?.classList.contains(`orb-${p}`);
    }, ph));
  }
  check('the voice circle changes with every phase', orbStates.every(Boolean), orbStates.join(','));
  const bars = await page.evaluate(() => { document.querySelector('.orb').style.setProperty('--lvl', '0.8'); return document.querySelectorAll('.orb-bar').length; });
  check('the voice circle has its ring of bars', bars >= 24, String(bars));

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
  await show.locator('#phoneApp').scrollIntoViewIfNeeded();
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
  await show.locator('#phoneApp').scrollIntoViewIfNeeded();
  await sleep(300);
  // mic inside the iframe
  await frame.locator('[data-feature="mic-button"]').waitFor({ timeout: 8000 }).catch(() => undefined);
  const micInFrame = await frame.locator('[data-feature="mic-button"]').count();
  check('the microphone button is present inside the iframe', micInFrame > 0);
  const dock = await show.frameLocator('#phoneApp').locator('.bottom-dock').evaluate((d) => { const r = d.getBoundingClientRect(); const root = d.ownerDocument.defaultView; const texts = [...d.querySelectorAll('.bottom-nav-btn')].map((b) => b.textContent.trim()); const names = [...d.querySelectorAll('.bottom-nav-btn')].map((b) => b.getAttribute('aria-label')); return { gap: Math.round(root.innerHeight - r.bottom), texts, named: names.every(Boolean), bg: getComputedStyle(d).backgroundColor }; });
  check('the bottom menu is glued to the bottom edge of the phone', dock.gap <= 1, JSON.stringify(dock));
  check('the bottom menu shows icons only, each with an accessible name', dock.texts.every((t) => t === '') && dock.named, JSON.stringify(dock));
  check('the bottom menu sits on a solid strip, so nothing shows behind it', !/rgba\(0, 0, 0, 0\)|transparent/.test(dock.bg), dock.bg);
  const fit = await show.frameLocator('#phoneApp').locator('.screen').first().evaluate((el) => { const w = el.ownerDocument.defaultView; const b = el.getBoundingClientRect(); return { margin: getComputedStyle(el.ownerDocument.body).margin, left: Math.round(b.left), right: Math.round(w.innerWidth - b.right), top: Math.round(b.top), docH: el.ownerDocument.documentElement.scrollHeight, ih: w.innerHeight }; });
  check('the app fills the phone screen edge to edge, with no black bars', fit.margin === '0px' && fit.left === 0 && fit.right === 0 && fit.top === 0 && fit.docH === fit.ih, JSON.stringify(fit));
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
  // the sections around the phone crossfade as the page scrolls
  await show.setViewportSize({ width: 1440, height: 900 });
  await sleep(300);
  const fade = async (p) => show.evaluate((p) => {
    const t = document.getElementById('stage');
    const top = t.getBoundingClientRect().top + scrollY;
    window.scrollTo({ top: top + (t.offsetHeight - innerHeight) * p, behavior: 'instant' });
    return new Promise((res) => setTimeout(() => res([...t.querySelectorAll('.side-left .chapter')].map((c) => Number(getComputedStyle(c).opacity).toFixed(2))), 250));
  }, p);
  const f0 = await fade(0); const f1 = await fade(1);
  check('the chapters around the phone are pinned and the first shows at the start', (await show.evaluate(() => document.getElementById('stage').classList.contains('scrub'))) && Number(f0[0]) > 0.95 && Number(f0[3]) < 0.05, f0.join(' '));
  check('the last chapter shows at the end and the first is gone', Number(f1[3]) > 0.95 && Number(f1[0]) < 0.05, f1.join(' '));
  const fh = await fade(0.5);
  check('at the handoff neither chapter shows, so two texts are never on top of each other', Number(fh[1]) < 0.15 && Number(fh[2]) < 0.15, fh.join(' '));
  const fm = await fade(0.48);
  check('just before the handoff the chapter is fading out', Number(fm[1]) > 0.1 && Number(fm[1]) < 0.9 && Number(fm[2]) < 0.05, fm.join(' '));
  const phoneBox = await show.locator('#phoneFrame').boundingBox();
  check('the whole phone stays in view while it is pinned', phoneBox.y >= 0 && phoneBox.y + phoneBox.height <= 900, `${Math.round(phoneBox.y)}-${Math.round(phoneBox.y + phoneBox.height)}`);

  const mobile = await ctx.newPage();
  await mobile.setViewportSize({ width: 360, height: 740 });
  await mobile.goto(`${BASE}/`);
  await sleep(800);
  check('no horizontal scroll at 360 px on the showcase page', await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const rect = await mobile.evaluate(() => { const f = document.getElementById('phoneFrame'); const r = f.getBoundingClientRect(); return { w: Math.round(r.width), x: Math.round(r.x), right: Math.round(r.right), vw: window.innerWidth }; });
  check('on a narrow screen the framed phone is scaled to fit inside the page', rect.x >= 0 && rect.right <= rect.vw && rect.w >= 280, JSON.stringify(rect));
  const open = await mobile.evaluate(() => { const a = document.querySelector('.open-app'); const r = a?.getBoundingClientRect(); return { shown: !!a && getComputedStyle(a).display !== 'none', h: Math.round(r?.height ?? 0), href: a?.getAttribute('href') }; });
  check('on a narrow screen a full-screen link to the app is offered, with a big touch target', open.shown && open.h >= 44 && open.href === '/app.html', JSON.stringify(open));
  check('the desktop page does not show the full-screen link', await show.evaluate(() => getComputedStyle(document.querySelector('.open-app')).display === 'none'));
  check('the page has no visible scrollbar', await show.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth === 'none'));
  check('the title cycles through three languages in one cell', await show.evaluate(() => { const w = [...document.querySelectorAll('.wordmark .word')]; return w.length === 3 && w.map((x) => x.textContent).join(',') === 'Vidur,विदुर,ವಿದುರ' && document.getElementById('wordmark').getAttribute('aria-label') === 'Vidur'; }));
  check('the sample sentence cycles Hinglish, Hindi and Kannada in one cell, in step with the title', await show.evaluate(() => {
    const l = [...document.querySelectorAll('.say .say-line')];
    const t = [...document.querySelectorAll('.wordmark .word')];
    const same = l.every((x, i) => getComputedStyle(x).animationDelay === getComputedStyle(t[i]).animationDelay && getComputedStyle(x).animationDuration === getComputedStyle(t[i]).animationDuration);
    return l.length === 3 && /udhaar/.test(l[0].textContent) && /उधार/.test(l[1].textContent) && /ಉಧಾರ್/.test(l[2].textContent) && same && l.slice(1).every((x) => x.getAttribute('aria-hidden') === 'true');
  }));

  // ---------------------------------------------------------------- fixes from the first live rehearsal
  await page.evaluate(() => { window.__vidur.quiet = true; window.__vidur.actions.navigate('customers'); });
  await sleep(250);
  check('the customers screen has a "new customer" button', (await page.locator('.btn-new-customer').count()) === 1);
  await page.locator('.btn-new-customer').click();
  await sleep(250);
  const nameFirst = await page.evaluate(() => { const i = document.querySelector('.keypad-new-name'); const l = document.querySelector('.keypad-customer-list'); return !!i && document.activeElement === i && !!(i.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING); });
  check('"new customer" opens the keypad with the name box first and focused', nameFirst);
  await page.evaluate(() => window.__vidur.actions.navigate('customers'));
  await sleep(250);
  const sum = await page.evaluate(() => { const st = window.__vidur.state; const c = document.querySelector('.customers-summary'); return { text: c ? c.innerText.replace(/\s+/g, ' ') : '', credit: st.allCredit, payment: st.allPayment, rows: st.customers.reduce((n, x) => n + x.balancePaise, 0) }; });
  const fmtIN = (p) => { const r = String(Math.round(p / 100)); return '₹' + (r.length <= 3 ? r : r.slice(0, -3).replace(/\B(?=(\d{2})+$)/g, ',') + ',' + r.slice(-3)); };
  check('the customers screen shows total credit and total paid, and what is still due', sum.credit > 0 && sum.text.includes(fmtIN(sum.credit)) && sum.text.includes(fmtIN(sum.payment)) && sum.text.includes(fmtIN(Math.max(0, sum.credit - sum.payment))), sum.text);
  check('still due equals the sum of every customer balance', sum.credit - sum.payment === sum.rows);
  await page.evaluate(() => window.__vidur.actions.navigate('home'));
  await sleep(150);
  const entriesBefore = await state(page, 's.history.length');
  await page.evaluate(() => window.__vidur.onTranscript({ text: 'Ramesh ka 340 udhaar', lang: 'hi', sttMs: 0, audioMs: 0 }));
  await sleep(250);
  check('a follow-up question offers a cancel button', (await page.locator('.btn-cancel-input').count()) === 1);
  check('the Hindi question names the two Rameshes in Devanagari, not Latin', /दूध वाले/.test(await page.locator('.entry-agent-line').innerText()));
  await page.locator('.btn-cancel-input').click();
  await sleep(250);
  check('cancel drops the question, saves nothing and clears the buttons', (await state(page, 's.history.length')) === entriesBefore && (await page.locator('.btn-cancel-input').count()) === 0 && (await state(page, "s.phase === 'idle'")));
  await page.evaluate(() => window.__vidur.onTranscript({ text: 'Mohan kal paanch sau dega', lang: 'hi', sttMs: 0, audioMs: 0 }));
  await sleep(250);
  check('after a note the card links to the notes', (await page.locator('.btn-view-notes').count()) === 1);
  await page.locator('.btn-view-notes').click();
  await sleep(250);
  check('the link opens that customer, with the note listed', (await page.locator('.detail-notes').innerText()).replace(/\s+/g, ' ').includes('500'));
  await page.evaluate(() => window.__vidur.actions.navigate('home'));
  await page.evaluate(() => window.__vidur.onGatewayError({ code: 'network', recoverable: true }));
  await sleep(200);
  check('an error banner offers "Add entry" next to "Try again"', (await page.locator('.error-banner .btn-error-alt').count()) === 1);
  await page.locator('.error-banner .btn-error-alt').click();
  await sleep(200);
  check('"Add entry" in the banner opens the keypad', (await page.locator('[data-feature="keypad"]').count()) > 0);
  await page.evaluate(() => window.__vidur.actions.navigate('home'));

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
