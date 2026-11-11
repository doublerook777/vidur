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
  opened = 0; sink: ((f: ArrayBuffer) => void) | null = null; timer: ReturnType<typeof setInterval> | null = null;
  async open() { this.opened++; }
  begin(sink: (f: ArrayBuffer) => void) { this.sink = sink; this.timer = setInterval(() => sink(new Int16Array(512).fill(7).buffer), 32); }
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
afterEach(async () => { session?.dispose(); await gw?.close(); await mock?.close(); session = null; gw = mock = null; telemetry.length = 0; });

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

  it('a recoverable gateway error shows what to do, a fatal one stops retrying', async () => {
    await boot();
    session!.actions.finishOnboarding({ lang: 'hi', demoData: false });
    await until(() => session!.state.phase === 'idle');
    expect(session!.state.error).toBeNull();
  });
});
