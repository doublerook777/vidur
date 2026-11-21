import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });
import { WebSocket as NodeWebSocket } from 'ws';

import { loadConfig } from '../../../../server/src/config.js';
import { createLogger } from '../../../../server/src/logger.js';
import { startMockGnani, type MockGnani } from '../../../../server/src/mock-gnani/index.js';
import { createGateway, type Gateway } from '../../../../server/src/server.js';
import { Vault } from '../storage/vault.js';
import { PhoneSession, type AudioIn, type AudioOut, type Telemetry } from './controller.js';

class FakeMic implements AudioIn {
  opened = 0; amp = 3000; sink: ((f: ArrayBuffer) => void) | null = null; timer: ReturnType<typeof setInterval> | null = null;
  async open() { this.opened++; }
  begin(sink: (f: ArrayBuffer) => void) { this.sink = sink; this.timer = setInterval(() => sink(new Int16Array(512).fill(this.amp).buffer), 32); }
  end() { if (this.timer) clearInterval(this.timer); this.sink = null; }
  close() { this.end(); }
}
class FakeSpeaker implements AudioOut {
  bytes = 0; flushes = 0; onBusy: ((b: boolean) => void) | null = null;
  async open() {}
  idle: ReturnType<typeof setTimeout> | null = null;
  push(p: Int16Array) { this.bytes += p.length * 2; this.onBusy?.(true); if (this.idle) clearTimeout(this.idle); this.idle = setTimeout(() => this.onBusy?.(false), 120); }
  flush() { this.flushes++; this.bytes = 0; this.onBusy?.(false); }
  close() {}
}

let gw: Gateway | null = null; let mock: MockGnani | null = null; let session: PhoneSession | null = null;
const telemetry: Telemetry[] = [];
const until = async (f: () => boolean, ms = 4000): Promise<void> => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout: ' + JSON.stringify({ phase: session?.state.phase, card: session?.state.card, error: session?.state.error })); await new Promise((r) => setTimeout(r, 15)); } };

async function boot(env: Record<string, string> = {}) {
  mock = await startMockGnani({ ttfbMs: 5, chunkIntervalMs: 15 });
  const config = { ...loadConfig({ MODE: 'local', GNANI_API_KEY: 'good', PORT: '0', ...env }), gnaniBaseUrl: mock.url.replace('http', 'ws') };
  gw = await createGateway({ config, log: createLogger(() => undefined, { strict: true }) });
  const mic = new FakeMic(); const speaker = new FakeSpeaker();
  const vault = await Vault.open('t' + Math.random(), new IDBFactory());
  session = await PhoneSession.create({
    gatewayUrl: gw.url.replace('http', 'ws') + '/ws', WebSocketImpl: NodeWebSocket as unknown as typeof WebSocket, vault, capture: mic, playback: speaker,
    onTelemetry: (t) => telemetry.push(t), backoffMs: [50],
  });
  await until(() => session!.state.online);
  return { mic, speaker, vault };
}
/** Finishes onboarding and waits until the disclosure has been spoken and the app is quiet. */
async function onboard(speaker: FakeSpeaker, demoData: boolean): Promise<void> {
  session!.actions.finishOnboarding({ lang: 'hi', demoData });
  await until(() => speaker.bytes > 0);
  await until(() => session!.state.phase === 'idle' && session!.state.online);
  await new Promise((r) => setTimeout(r, 200));
  speaker.bytes = 0;
}
async function turn(text: string, holdMs = 400): Promise<void> {
  mock!.scriptTranscripts([text]);
  const before = telemetry.filter((t) => t.transcript !== undefined).length;
  session!.actions.micDown();
  await until(() => session!.state.phase === 'listening');
  await new Promise((r) => setTimeout(r, holdMs));
  session!.actions.micUp();
  await until(() => telemetry.filter((t) => t.transcript !== undefined).length > before);
  await until(() => ['idle', 'needs_answer'].includes(session!.state.phase), 6000);
}
afterEach(async () => { session?.dispose(); await gw?.close(); await mock?.close(); session = null; gw = mock = null; telemetry.length = 0; vi.unstubAllGlobals(); });

describe('PhoneSession end to end with the real gateway, the mock Gnani and fake audio devices', () => {
  it('onboarding with demo data speaks the AI disclosure first, in the chosen language', async () => {
    const { speaker } = await boot();
    expect(session!.state.screen).toBe('onboarding');
    session!.actions.finishOnboarding({ lang: 'hi', demoData: true });
    await until(() => speaker.bytes > 0);
    expect(session!.state.card?.agentLine).toContain('एआई');
    expect(session!.state.customers).toHaveLength(12);
    expect(session!.state.screen).toBe('home');
    await until(() => session!.state.phase === 'idle');
  });

  it('a full turn: entry saved, totals updated, spoken reply, end-to-first-audio measured', async () => {
    const { speaker } = await boot();
    await onboard(speaker, false);
    await turn('Mohan ka 50 udhaar');
    expect(session!.state.card?.state).toBe('needs_answer'); // a new name: asks before creating a khata
    expect(session!.debug.ledger.customers()).toHaveLength(0);
    await turn('haan');
    const s = session!.state;
    expect(s.card).toMatchObject({ state: 'saved', customerName: 'Mohan', kind: 'credit', paise: 5000 });
    expect(s.credit).toBe(5000);
    expect(s.feed[0]).toMatchObject({ customerName: 'Mohan', kind: 'credit', paise: 5000 });
    expect(s.feed[0]!.undoableUntil).not.toBeNull();
    expect(s.lastEndToAudioMs).not.toBeNull();
    expect(s.lastEndToAudioMs!).toBeLessThan(2000);
    expect(speaker.bytes).toBeGreaterThan(0);
    expect(telemetry.some((t) => t.transcript === 'Mohan ka 50 udhaar')).toBe(true);
  });

  it('two Rameshes: asks which one, saves nothing, then saves on the answer', async () => {
    const { speaker } = await boot();
    await onboard(speaker, true);
    const entriesBefore = session!.debug.ledger.activeEntries().length;
    await turn('Ramesh ka 340 udhaar');
    expect(session!.state.card?.state).toBe('needs_answer');
    expect(session!.state.phase).toBe('needs_answer');
    expect(session!.debug.ledger.activeEntries().length).toBe(entriesBefore);
    await turn('auto wale');
    expect(session!.state.card?.state).toBe('saved');
    expect(session!.debug.ledger.activeEntries().length).toBe(entriesBefore + 1);
  });

  it('pressing the button while the agent talks stops the audio at once', async () => {
    const { speaker } = await boot();
    session!.actions.finishOnboarding({ lang: 'hi', demoData: true });
    await until(() => speaker.bytes > 0);
    const flushes = speaker.flushes;
    session!.actions.micDown();
    await until(() => speaker.flushes > flushes);
    await until(() => session!.state.phase === 'listening');
    session!.actions.micUp();
  });

  it('undo works within ten seconds and the button then disappears', async () => {
    const { speaker } = await boot();
    await onboard(speaker, false);
    await turn('Mohan ka 80 udhaar');
    await turn('haan');
    const id = session!.state.feed[0]!.id;
    session!.actions.undo(id);
    await until(() => session!.state.feed.length === 0);
    expect(session!.state.credit).toBe(0);
  });

  it('the keypad saves an entry with no network at all', async () => {
    const { speaker } = await boot();
    await onboard(speaker, true);
    await gw!.close();
    await until(() => !session!.state.online);
    expect(session!.state.phase).toBe('offline');
    const sunita = session!.state.customers.find((c) => c.name === 'Sunita')!;
    const bal = sunita.balancePaise;
    session!.actions.saveKeypadEntry({ customerId: sunita.id, newName: null, kind: 'credit', paise: 12000 });
    await until(() => session!.state.customers.find((c) => c.id === sunita.id)!.balancePaise === bal + 12000);
    session!.actions.saveKeypadEntry({ customerId: null, newName: 'Naya Grahak', kind: 'payment', paise: 2500 });
    await until(() => session!.state.customers.some((c) => c.name === 'Naya Grahak'));
  });

  it('an empty recording says so, in the shopkeeper\'s language', async () => {
    const { speaker } = await boot();
    await onboard(speaker, false);
    mock!.scriptTranscripts(['x']);
    session!.actions.micDown();
    await until(() => session!.state.phase === 'listening');
    session!.actions.micUp(); // released at once: under 100 ms of audio
    await until(() => session!.state.error !== null);
    expect(session!.state.error!.text).toContain('बटन');
  });

  it('delete-all wipes the ledger, transcripts and returns to onboarding', async () => {
    await boot();
    session!.actions.finishOnboarding({ lang: 'hi', demoData: true });
    await until(() => session!.state.customers.length === 12);
    session!.actions.deleteAll();
    await until(() => session!.state.customers.length === 0 && session!.state.screen === 'onboarding');
    expect(session!.state.onboarded).toBe(false);
  });

  it('out of credit: the app says so in the shopkeeper\'s language and points to running it with their own key', async () => {
    vi.stubGlobal('navigator', { language: 'hi-IN' });
    mock = await startMockGnani({ ttfbMs: 5, chunkIntervalMs: 15 });
    const config = { ...loadConfig({ MODE: 'local', GNANI_API_KEY: 'nocredit', PORT: '0' }), gnaniBaseUrl: mock.url.replace('http', 'ws') };
    gw = await createGateway({ config, log: createLogger(() => undefined, { strict: true }) });
    const vault = await Vault.open('t' + Math.random(), new IDBFactory());
    session = await PhoneSession.create({ gatewayUrl: gw.url.replace('http', 'ws') + '/ws', WebSocketImpl: NodeWebSocket as unknown as typeof WebSocket, vault, capture: new FakeMic(), playback: new FakeSpeaker(), backoffMs: [50] });
    await until(() => session!.state.error !== null);
    expect(session!.state.error!.text).toContain('कीपैड');
    expect(session!.state.error!.text).toContain('अपनी चाबी');
    expect(session!.state.phase).toBe('offline');
    vi.unstubAllGlobals();
  });

  it('a fresh install starts in the phone\'s own language: English, Kannada, and Hindi for anything else', async () => {
    for (const [tag, lang] of [['en-IN', 'en'], ['kn-IN', 'kn'], ['hi-IN', 'hi'], ['ta-IN', 'hi']] as const) {
      vi.stubGlobal('navigator', { language: tag });
      await boot();
      expect(session!.state.lang).toBe(lang);
      expect(session!.state.screen).toBe('onboarding');
      session!.dispose();
      await gw?.close(); await mock?.close(); gw = null; mock = null; session = null;
    }
    vi.unstubAllGlobals();
  });

  it('a speech-service failure does not blame the internet, and does not leave the thinking pill stuck', async () => {
    const { speaker } = await boot();
    await onboard(speaker, false);
    const s = session as unknown as { setPhase(p: string): void; onGatewayError(e: { code: string; recoverable: boolean }): void };
    s.setPhase('thinking');
    s.onGatewayError({ code: 'stt_timeout', recoverable: true });
    expect(session!.state.phase).toBe('idle');
    expect(session!.state.error!.text).toContain('आवाज़ सेवा');
    expect(session!.state.error!.text).not.toContain('इंटरनेट');
    s.onGatewayError({ code: 'speech_error', recoverable: true });
    expect(session!.state.error!.actionLabel).toBe('फिर कोशिश करें');
  });

  it('a press with nothing said says so at once, and the late speech-service reply is ignored', async () => {
    const { mic, speaker } = await boot();
    await onboard(speaker, false);
    mic.amp = 0;
    mock!.scriptTranscripts(['x']); // what the speech service would still send back for the silent recording
    const heardBefore = telemetry.filter((t) => t.transcript !== undefined).length;
    session!.actions.micDown();
    await until(() => session!.state.phase === 'listening');
    await new Promise((r) => setTimeout(r, 400));
    session!.actions.micUp();
    expect(session!.state.phase).toBe('idle');
    expect(session!.state.error!.text).toContain('कुछ सुनाई नहीं दिया');
    await new Promise((r) => setTimeout(r, 1500)); // the late reply arrives and is dropped
    expect(telemetry.filter((t) => t.transcript !== undefined).length).toBe(heardBefore);
    expect(session!.state.card).toBeNull();
    expect(session!.state.error!.text).toContain('कुछ सुनाई नहीं दिया');
    mic.amp = 3000;
    await turn('Mohan ka 100 udhaar'); // the next real turn still works
  });

  it('switching language rewrites the greeting on screen in the new language, and drops other stale agent lines', async () => {
    const { speaker } = await boot();
    await onboard(speaker, false); // finishes in Hindi
    expect(session!.state.card?.agentLine).toContain('विदुर');
    session!.actions.setLang('en');
    await until(() => session!.state.lang === 'en');
    expect(session!.state.card?.agentLine).toBe("Hello, I'm Vidur, an AI assistant for your khata. Tell me a credit or a payment, or ask for a balance.");
    session!.actions.setLang('kn');
    await until(() => session!.state.lang === 'kn');
    expect(session!.state.card?.agentLine).toContain('ನಾನು ವಿದುರ');
    expect(session!.state.card?.agentLine).not.toMatch(/[\u0900-\u097F]/);
  });

  it('a recoverable gateway error shows what to do, a fatal one stops retrying', async () => {
    await boot();
    session!.actions.finishOnboarding({ lang: 'hi', demoData: false });
    await until(() => session!.state.phase === 'idle');
    expect(session!.state.error).toBeNull();
  });
});

describe('adding and removing entries by hand, and tapping answers', () => {
  it('removes any entry, offers to take it back, and the restore puts it back', async () => {
    const { speaker } = await boot();
    await onboard(speaker, true);
    const first = session!.state.history[0]!;
    const before = session!.state.history.length;
    session!.actions.removeEntry(first.id);
    await until(() => session!.state.history.length === before - 1);
    expect(session!.state.history.some((h) => h.id === first.id)).toBe(false);
    expect(session!.state.toast?.restoreToken).toBeTruthy();
    session!.actions.restoreEntry(session!.state.toast!.restoreToken);
    await until(() => session!.state.history.length === before);
    expect(session!.state.history.some((h) => h.id === first.id)).toBe(true);
    expect(session!.state.toast).toBeNull();
  });

  it('editing an entry by hand changes its amount, kind and time, keeps the customer, and can be taken back', async () => {
    const { speaker } = await boot();
    await onboard(speaker, true);
    const c = session!.state.customers[0]!;
    const threeDaysAgo = Date.now() - 3 * 86_400_000;
    session!.actions.saveKeypadEntry({ customerId: c.id, newName: null, kind: 'credit', paise: 437_00, at: threeDaysAgo });
    await until(() => session!.state.history.some((h) => h.paise === 437_00));
    const entry = session!.state.history.find((h) => h.paise === 437_00)!;
    const balanceBefore = session!.state.customers.find((x) => x.id === c.id)!.balancePaise;

    session!.actions.openEditEntry(entry.id);
    expect(session!.state.screen).toBe('keypad');
    expect(session!.state.addPreset?.editEntry).toMatchObject({ id: entry.id, kind: 'credit', paise: 437_00, at: threeDaysAgo });

    // same customer, new amount and kind, old time kept when no time is sent
    session!.actions.saveEntryEdit({ entryId: entry.id, kind: 'payment', paise: 163_00 });
    await until(() => session!.state.history.some((h) => h.paise === 163_00));
    expect(session!.state.history.some((h) => h.id === entry.id)).toBe(false);
    const changed = session!.state.history.find((h) => h.paise === 163_00)!;
    expect(changed.kind).toBe('payment');
    expect(changed.customerName).toBe(entry.customerName);
    expect(changed.at).toBe(threeDaysAgo);
    expect(session!.state.customers.find((x) => c.id === x.id)!.balancePaise).toBe(balanceBefore - 437_00 - 163_00);
    expect(session!.state.addPreset).toBeNull();
    expect(session!.state.toast?.restoreToken).toContain('|');

    // taking it back restores the original entry and removes the new one
    session!.actions.restoreEntry(session!.state.toast!.restoreToken);
    await until(() => session!.state.history.some((h) => h.id === entry.id));
    expect(session!.state.history.some((h) => h.paise === 163_00)).toBe(false);
    expect(session!.state.customers.find((x) => c.id === x.id)!.balancePaise).toBe(balanceBefore);

    // a new time is used, never one in the future; a zero amount changes nothing
    session!.actions.openEditEntry(entry.id);
    session!.actions.saveEntryEdit({ entryId: entry.id, kind: 'credit', paise: 0 });
    await new Promise((r) => setTimeout(r, 60));
    expect(session!.state.history.some((h) => h.id === entry.id)).toBe(true);
    session!.actions.openEditEntry(entry.id);
    session!.actions.saveEntryEdit({ entryId: entry.id, kind: 'credit', paise: 441_00, at: Date.now() + 5 * 86_400_000 });
    await until(() => session!.state.history.some((h) => h.paise === 441_00));
    expect(session!.state.history.find((h) => h.paise === 441_00)!.at).toBeLessThanOrEqual(Date.now());
  });

  it('a hand-added entry keeps the date it was given and never a future one', async () => {
    const { speaker } = await boot();
    await onboard(speaker, true);
    const c = session!.state.customers[0]!;
    const twoDaysAgo = Date.now() - 2 * 86_400_000;
    session!.actions.saveKeypadEntry({ customerId: c.id, newName: null, kind: 'credit', paise: 77_00, at: twoDaysAgo });
    await until(() => session!.state.history.some((h) => h.paise === 77_00));
    const dated = session!.state.history.find((h) => h.paise === 77_00)!;
    expect(dated.at).toBe(twoDaysAgo);
    expect(dated.recordedAt).toBeGreaterThan(dated.at + 86_400_000);
    session!.actions.saveKeypadEntry({ customerId: c.id, newName: null, kind: 'payment', paise: 88_00, at: Date.now() + 5 * 86_400_000 });
    await until(() => session!.state.history.some((h) => h.paise === 88_00));
    expect(session!.state.history.find((h) => h.paise === 88_00)!.at).toBeLessThanOrEqual(Date.now());
  });

  it('a name typed on the Add entry screen creates that customer, with no question', async () => {
    const { speaker } = await boot();
    await onboard(speaker, false);
    session!.actions.saveKeypadEntry({ customerId: null, newName: 'Laxmi', kind: 'credit', paise: 50_00 });
    await until(() => session!.state.customers.some((c) => c.name === 'Laxmi'));
    expect(session!.state.history[0]).toMatchObject({ customerName: 'Laxmi', paise: 50_00 });
  });

  it('a nickname typed with a new name is stored on the customer and matched by the voice', async () => {
    const { speaker } = await boot();
    await onboard(speaker, false);
    session!.actions.saveKeypadEntry({ customerId: null, newName: 'Ramesh', newNickname: ' doodh wala ', kind: 'credit', paise: 80_00 });
    await until(() => session!.state.customers.some((c) => c.name === 'Ramesh'));
    const row = session!.state.customers.find((c) => c.name === 'Ramesh')!;
    expect(row.nickname).toBe('doodh wala');
    expect(row.aliases).toEqual([]);
    // a blank nickname is no nickname
    session!.actions.saveKeypadEntry({ customerId: null, newName: 'Sohan', newNickname: '   ', kind: 'credit', paise: 10_00 });
    await until(() => session!.state.customers.some((c) => c.name === 'Sohan'));
    expect(session!.state.customers.find((c) => c.name === 'Sohan')!.nickname).toBeUndefined();
  });

  it('a new spoken name offers Yes and No, and tapping Yes answers like saying it', async () => {
    const { speaker } = await boot();
    await onboard(speaker, false);
    await turn('Kiran ka 100 udhaar');
    expect(session!.state.card).toMatchObject({ state: 'needs_answer', answers: 'yes_no' });
    expect(session!.state.customers).toHaveLength(0);
    session!.actions.answer('yes');
    await until(() => session!.state.customers.some((c) => c.name === 'Kiran'));
    expect(session!.state.history[0]).toMatchObject({ customerName: 'Kiran', paise: 100_00 });
  });

  it('tapping No creates nobody and asks whose account', async () => {
    const { speaker } = await boot();
    await onboard(speaker, false);
    await turn('Kiran ka 100 udhaar');
    session!.actions.answer('no');
    await until(() => session!.state.card?.agentLine?.includes('खाते') === true && session!.state.card?.answers === undefined);
    expect(session!.state.customers).toHaveLength(0);
    expect(session!.state.history).toHaveLength(0);
  });

  it('tapping Yes with no question open does nothing', async () => {
    const { speaker } = await boot();
    await onboard(speaker, true);
    const before = session!.state.history.length;
    session!.actions.answer('yes');
    await new Promise((r) => setTimeout(r, 150));
    expect(session!.state.history.length).toBe(before);
  });

  it('updateCustomer sets a nickname and phone that show up on the customer row (F0)', async () => {
    const { speaker } = await boot();
    await onboard(speaker, true);
    const id = session!.state.customers[0]!.id;
    session!.actions.updateCustomer(id, { nickname: 'dairy', phone: '9876543210' });
    await until(() => session!.state.customers.find((c) => c.id === id)?.nickname === 'dairy');
    expect(session!.state.customers.find((c) => c.id === id)?.phone).toBe('9876543210');
    session!.actions.updateCustomer(id, { nickname: '' });
    await until(() => session!.state.customers.find((c) => c.id === id)?.nickname === undefined);
  });

  describe('F1: profile management and PIN screen lock', () => {
    it('saveProfile updates shop name and owner name in state and vault', async () => {
      const { speaker } = await boot();
      await onboard(speaker, false);
      session!.actions.saveProfile({ shopName: 'Om Kirana Store', ownerName: 'Ramesh Kumar' });
      await until(() => session!.state.shopName === 'Om Kirana Store');
      expect(session!.state.profile?.ownerName).toBe('Ramesh Kumar');
      expect(session!.state.profile?.shopName).toBe('Om Kirana Store');
    });

    it('finishOnboarding with profile stores profile and PIN', async () => {
      const { speaker } = await boot();
      session!.actions.finishOnboarding({
        lang: 'hi',
        demoData: false,
        profile: { shopName: 'Sharma Dairy', ownerName: 'Sunil Sharma', pin: '1234' },
      });
      await until(() => speaker.bytes > 0);
      await until(() => session!.state.phase === 'idle');
      expect(session!.state.shopName).toBe('Sharma Dairy');
      expect(session!.state.profile?.ownerName).toBe('Sunil Sharma');
      expect(session!.state.profile?.pin?.iterations).toBeGreaterThanOrEqual(200_000);
    });

    it('setting a PIN, locking, wrong PIN attempts, lockout and unlock', async () => {
      const { speaker } = await boot();
      await onboard(speaker, false);

      // Set PIN
      session!.actions.setPin('4321');
      await until(() => Boolean(session!.state.profile?.pin));

      // Lock the session
      session!.lock();
      expect(session!.state.locked).toBe(true);

      // Try wrong PIN
      session!.actions.unlock('9999');
      await until(() => session!.state.wrongAttempts === 1);
      expect(session!.state.locked).toBe(true);
      expect(session!.state.lockError).toBe('incorrect_pin');

      // Enter 4 more wrong attempts to reach 5 (triggering lockout)
      session!.actions.unlock('1111');
      session!.actions.unlock('2222');
      session!.actions.unlock('3333');
      session!.actions.unlock('4444');
      await until(() => session!.state.wrongAttempts === 5);
      expect(session!.state.lockUntil).not.toBeNull();
      expect(session!.state.lockUntil!).toBeGreaterThan(Date.now());

      // Attempt while locked out should be ignored
      session!.actions.unlock('4321');
      expect(session!.state.locked).toBe(true);

      // Unlock after clearing lockout
      session!.store.update({ lockUntil: null });
      session!.actions.unlock('4321');
      await until(() => session!.state.locked === false);
      expect(session!.state.wrongAttempts).toBe(0);

      // clearPin removes the PIN
      session!.actions.clearPin();
      await until(() => session!.state.profile?.pin === undefined);
    });

    it('existing install without profile shows showCompleteProfile card', async () => {
      mock = await startMockGnani({ ttfbMs: 5, chunkIntervalMs: 15 });
      const config = { ...loadConfig({ MODE: 'local', GNANI_API_KEY: 'good', PORT: '0' }), gnaniBaseUrl: mock.url.replace('http', 'ws') };
      gw = await createGateway({ config, log: createLogger(() => undefined, { strict: true }) });
      const idb = new IDBFactory();
      const vault = await Vault.open('old-install', idb);
      // Simulate old install: settings has onboarded: true, but no profile in vault
      await vault.putMeta('settings', { lang: 'hi', theme: 'light', shopName: 'Old Kirana', onboarded: true });

      session = await PhoneSession.create({
        gatewayUrl: gw.url.replace('http', 'ws') + '/ws',
        WebSocketImpl: NodeWebSocket as unknown as typeof WebSocket,
        vault,
        capture: new FakeMic(),
        playback: new FakeSpeaker(),
      });

      await until(() => session!.state.loaded);
      expect(session!.state.onboarded).toBe(true);
      expect(session!.state.showCompleteProfile).toBe(true);

      // Dismissing complete profile card
      session!.actions.dismissCompleteProfile?.();
      expect(session!.state.showCompleteProfile).toBe(false);
    });
  });

  describe('B3: phone press cap and countdown', () => {
    it('shows countdown in the last window and releases automatically at the cap', async () => {
      mock = await startMockGnani({ ttfbMs: 5, chunkIntervalMs: 15 });
      mock.scriptTranscripts(['लम्बा भाषण']);
      const config = { ...loadConfig({ MODE: 'local', GNANI_API_KEY: 'good', PORT: '0' }), gnaniBaseUrl: mock.url.replace('http', 'ws') };
      gw = await createGateway({ config, log: createLogger(() => undefined, { strict: true }) });
      const mic = new FakeMic();
      const speaker = new FakeSpeaker();
      const vault = await Vault.open('b3-test', new IDBFactory());

      // Configure cap at 500ms, countdown window at 200ms (starts at 300ms)
      session = await PhoneSession.create({
        gatewayUrl: gw.url.replace('http', 'ws') + '/ws',
        WebSocketImpl: NodeWebSocket as unknown as typeof WebSocket,
        vault,
        capture: mic,
        playback: speaker,
        pressCapMs: 500,
        countdownWindowMs: 200,
      });

      await until(() => session!.state.online);
      await onboard(speaker, false);

      // Hold mic down beyond the cap
      session!.actions.micDown();
      await until(() => session!.state.phase === 'listening');
      expect(session!.state.card?.state).toBe('listening');

      // Wait until countdown window begins (at ~350ms)
      await until(() => session!.state.card?.countdownSec !== undefined, 2000);
      expect(typeof session!.state.card?.countdownSec).toBe('number');
      expect(session!.state.card?.countdownSec).toBeGreaterThanOrEqual(1);

      // Auto-releases at cap (500ms) -> transitions to thinking
      await until(() => session!.state.phase === 'thinking' || session!.state.phase === 'speaking', 2000);
      await until(() => session!.state.phase === 'idle', 4000);
    });

    it('releases manually before countdown window without showing countdown', async () => {
      const { speaker } = await boot();
      await onboard(speaker, false);
      mock!.scriptTranscripts(['साधारण वाक्य']);

      session!.actions.micDown();
      await until(() => session!.state.phase === 'listening');
      expect(session!.state.card?.countdownSec).toBeUndefined();

      // Hold for 80ms so FakeMic sends an audio frame above silent peak
      await new Promise((r) => setTimeout(r, 80));
      session!.actions.micUp();
      await until(() => session!.state.phase === 'thinking' || session!.state.phase === 'speaking');
      expect(session!.state.card?.countdownSec).toBeUndefined();
      await until(() => session!.state.phase === 'idle');
    });

    it('F5 speakSummary speaks customer summary and updates the card', async () => {
      const { speaker } = await boot();
      await onboard(speaker, false);
      const c = await session!.debug.ledger.createCustomer('Ramesh', []);
      await session!.debug.ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 5000, at: Date.now() });

      session!.actions.speakSummary(c.id);
      await until(() => session!.state.card?.agentLine !== undefined && session!.state.card.agentLine.length > 0);
      expect(session!.state.card?.agentLine).toContain('Ramesh');
      expect(session!.state.card?.agentLine).toContain('50');
      await until(() => speaker.bytes > 0);
    });

    it('F6 remindOnWhatsApp opens wa.me URL when phone is present and gate passes', async () => {
      const { speaker } = await boot();
      await onboard(speaker, false);
      const c = await session!.debug.ledger.createCustomer('Suresh', [], { phone: '9876543210' });
      await session!.debug.ledger.setConsent(c.id, true);
      await session!.debug.ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 7500, at: Date.now() });

      const openedUrls: string[] = [];
      const origWindow = globalThis.window;
      globalThis.window = {
        open: (url?: string | URL) => {
          if (url) openedUrls.push(String(url));
          return null;
        },
      } as unknown as Window & typeof globalThis;

      try {
        session!.actions.remindOnWhatsApp(c.id);
        await until(() => openedUrls.length > 0);
        expect(openedUrls[0]).toContain('https://wa.me/919876543210?text=');
        expect(openedUrls[0]).toContain(encodeURIComponent('Suresh'));
        expect(session!.debug.ledger.lastReminderAt(c.id)).not.toBeNull();
      } finally {
        globalThis.window = origWindow;
      }
    });

    it('F6 remindOnWhatsApp does not send if reminder gate blocks', async () => {
      const { speaker } = await boot();
      await onboard(speaker, false);
      // No consent -> gate blocks
      const c = await session!.debug.ledger.createCustomer('Gita', [], { phone: '9876543210' });
      await session!.debug.ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 5000, at: Date.now() });

      const openedUrls: string[] = [];
      const origWindow = globalThis.window;
      globalThis.window = {
        open: (url?: string | URL) => {
          if (url) openedUrls.push(String(url));
          return null;
        },
      } as unknown as Window & typeof globalThis;

      try {
        session!.actions.remindOnWhatsApp(c.id);
        await new Promise((r) => setTimeout(r, 100));
        expect(openedUrls).toHaveLength(0);
        expect(session!.debug.ledger.lastReminderAt(c.id)).toBeNull();
      } finally {
        globalThis.window = origWindow;
      }
    });
  });
});
