import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket as NodeWebSocket } from 'ws';

import { loadConfig } from '../../../../server/src/config.js';
import { createLogger } from '../../../../server/src/logger.js';
import { startMockGnani, type MockGnani } from '../../../../server/src/mock-gnani/index.js';
import { createGateway, type Gateway } from '../../../../server/src/server.js';
import { GatewayClient, type GatewayError } from './gateway.js';

let gw: Gateway | null = null;
let mock: MockGnani | null = null;
const clients: GatewayClient[] = [];
const log = createLogger(() => undefined, { strict: true });

async function boot(env: Record<string, string> = {}, key = 'good') {
  mock = await startMockGnani({ ttfbMs: 5, chunkIntervalMs: 15 });
  const config = { ...loadConfig({ MODE: 'local', GNANI_API_KEY: key, PORT: '0', ...env }), gnaniBaseUrl: mock.url.replace('http', 'ws') };
  gw = await createGateway({ config, log, llm: async () => ({ intent: 'out_of_scope' }) });
}
const until = async (f: () => boolean, ms = 3000): Promise<void> => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 10)); } };
const client = (ev: ConstructorParameters<typeof GatewayClient>[1] = {}, extra: object = {}) => {
  const c = new GatewayClient({ url: gw!.url.replace('http', 'ws') + '/ws', lang: 'hi', WebSocketImpl: NodeWebSocket as unknown as typeof WebSocket, backoffMs: [50, 100], ...extra }, ev);
  clients.push(c);
  return c;
};
afterEach(async () => { clients.splice(0).forEach((c) => c.close()); await gw?.close(); await mock?.close(); gw = mock = null; });

describe('GatewayClient against the real gateway and the mock Gnani', () => {
  it('connects, runs a turn, and receives audio', async () => {
    await boot();
    mock!.scriptTranscripts(['Ramesh ka 340 udhaar']);
    let transcript = ''; let started = ''; let ended = ''; let audio = 0;
    const c = client({ onTranscript: (t) => (transcript = t.text), onTtsStart: (id) => (started = id), onTtsEnd: (id) => (ended = id), onAudio: (b) => (audio += b.byteLength) });
    c.connect();
    await until(() => c.canSend);
    c.pttDown();
    await new Promise((r) => setTimeout(r, 50));
    for (let i = 0; i < 30; i++) c.sendAudio(new Int16Array(512).fill(5).buffer);
    c.pttUp();
    await until(() => transcript !== '');
    expect(transcript).toBe('Ramesh ka 340 udhaar');
    c.speak('a', 'Ramesh, ₹340 उधार', 'hi');
    await until(() => ended === 'a');
    expect(started).toBe('a');
    expect(audio).toBeGreaterThan(5000);
  });

  it('reconnects after a drop and keeps working', async () => {
    await boot();
    const states: string[] = [];
    const c = client({ onState: (s) => states.push(s) });
    c.connect();
    await until(() => c.canSend);
    (c as unknown as { ws: { close(): void } }).ws.close();
    await until(() => states.includes('closed'));
    await until(() => c.canSend, 4000);
    expect(states.filter((s) => s === 'open').length).toBe(2);
  });

  it('a non-recoverable error stops the reconnect loop', async () => {
    await boot({}, 'nocredit');
    const errors: GatewayError[] = [];
    const states: string[] = [];
    const c = client({ onError: (e) => errors.push(e), onState: (s) => states.push(s) });
    c.connect();
    await until(() => errors.length > 0);
    expect(errors[0]).toMatchObject({ code: 'credit_exhausted', recoverable: false });
    const opens = states.filter((s) => s === 'connecting').length;
    await new Promise((r) => setTimeout(r, 400));
    expect(states.filter((s) => s === 'connecting').length).toBe(opens);
  });

  it('parse returns the model output, or null when it cannot', async () => {
    await boot();
    const c = client();
    c.connect();
    await until(() => c.canSend);
    expect(await c.parse('what does ramesh owe')).toEqual({ intent: 'out_of_scope' });
    c.close();
    expect(await c.parse('x')).toBeNull();
  });

  it('interrupt reaches the gateway and stops the audio', async () => {
    await boot();
    let ended: { interrupted: boolean } | null = null; let audio = 0;
    const c = client({ onTtsEnd: (_id, how) => (ended = how), onAudio: (b) => (audio += b.byteLength) });
    c.connect();
    await until(() => c.canSend);
    c.speak('long', 'z'.repeat(150), 'hi');
    await until(() => audio > 0);
    c.interrupt();
    await until(() => ended !== null);
    expect(ended!.interrupted).toBe(true);
    const at = audio;
    await new Promise((r) => setTimeout(r, 300));
    expect(audio).toBe(at);
  });
});
