import { render } from 'preact';
import type * as preact from 'preact';
import { useEffect, useReducer, useState } from 'preact/hooks';

import './phone/ui/phone.css';
import { MicCapture } from './phone/audio/capture.js';
import { Playback } from './phone/audio/playback.js';
import type { BridgeDown, BridgeUp, FeatureId, FrameKind, HomeVM, SettingsVM } from './phone/contract.js';
import { FEATURE_IDS } from './phone/contract.js';
import { PhoneSession, type SessionState, type Telemetry } from './phone/session/controller.js';
import { Vault } from './phone/storage/vault.js';
import { CustomerDetail } from './phone/ui/CustomerDetail.js';
import { Customers } from './phone/ui/Customers.js';
import { History } from './phone/ui/History.js';
import { Toast } from './phone/ui/Toast.js';
import { Home } from './phone/ui/Home.js';
import { Keypad } from './phone/ui/Keypad.js';
import { Onboarding } from './phone/ui/Onboarding.js';
import { Reminders } from './phone/ui/Reminders.js';
import { Settings } from './phone/ui/Settings.js';

const embedded = window.parent !== window;
const post = (m: BridgeUp): void => {
  if (embedded) window.parent.postMessage(m, window.location.origin);
};

const SAFE: Record<FrameKind, [string, string]> = { notch: ['44px', '34px'], 'no-notch': ['0px', '0px'], 'punch-hole': ['32px', '24px'] };

function applyFrame(frame: FrameKind): void {
  const [top, bottom] = SAFE[frame];
  const r = document.documentElement;
  r.style.setProperty('--safe-top', top);
  r.style.setProperty('--safe-bottom', bottom);
  r.dataset['frame'] = frame;
}

function useStore(session: PhoneSession): SessionState {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => session.store.subscribe(() => force(undefined)), [session]);
  return session.state;
}

function homeVM(s: SessionState): HomeVM {
  return {
    phase: s.phase, shopName: s.shopName, now: Date.now(), online: s.online, mockMode: s.mockMode, card: s.card, creditTodayPaise: s.credit, paymentTodayPaise: s.payment,
    peopleToday: s.people, feed: s.feed, error: s.error,
  };
}

function App({ session }: { session: PhoneSession }) {
  const s = useStore(session);
  const a = session.actions;

  useEffect(() => {
    document.documentElement.dataset['theme'] = s.theme;
    document.documentElement.lang = s.lang;
  }, [s.theme, s.lang]);

  // Reminders are shared by the shopkeeper themselves. Nothing is ever sent automatically.
  useEffect(() => {
    const r = s.shareReminder;
    if (!r) return;
    session.store.update({ shareReminder: null });
    if (navigator.share) void navigator.share({ text: r.text }).catch(() => undefined);
    else void navigator.clipboard?.writeText(r.text).catch(() => undefined);
  }, [s.shareReminder, session]);

  const settings: SettingsVM = { lang: s.lang, theme: s.theme, shopName: s.shopName, encrypted: true, retentionHours: 24 };
  const screen = ((): preact.JSX.Element => {
  switch (s.screen) {
    case 'onboarding':
      return <Onboarding vm={{ lang: s.lang }} actions={a} lang={s.lang} />;
    case 'customers':
      return <Customers vm={{ customers: s.customers }} actions={a} lang={s.lang} />;
    case 'customer':
      return s.detail ? <CustomerDetail vm={s.detail} actions={a} lang={s.lang} /> : <Customers vm={{ customers: s.customers }} actions={a} lang={s.lang} />;
    case 'reminders':
      return <Reminders vm={{ customers: s.customers }} actions={a} lang={s.lang} />;
    case 'settings':
      return <Settings vm={settings} actions={a} lang={s.lang} />;
    case 'keypad':
      return <Keypad vm={{ customers: s.customers, preset: s.addPreset }} actions={a} lang={s.lang} />;
    case 'history':
      return <History vm={{ items: s.history }} actions={a} lang={s.lang} />;
    default:
      return <Home vm={homeVM(s)} actions={a} lang={s.lang} />;
  }
  })();
  return (
    <>
      {screen}
      {s.toast && <Toast vm={s.toast} actions={a} lang={s.lang} />}
    </>
  );
}

function AccessGate({ onCode }: { onCode: (c: string) => void }) {
  const [v, setV] = useState('');
  return (
    <main class="screen">
      <h1>Vidur</h1>
      <p>Enter the access code for this demo.</p>
      <input aria-label="Access code" value={v} onInput={(e) => setV((e.target as HTMLInputElement).value)} style="font-size:20px;padding:12px;width:100%" />
      <button class="btn" style="min-height:56px;margin-top:12px" onClick={() => onCode(v.trim())}>Start</button>
    </main>
  );
}

async function boot(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) return;
  let needsCode = false;
  try {
    const cfg = (await (await fetch('/api/config')).json()) as { needsAccessCode?: boolean };
    needsCode = Boolean(cfg.needsAccessCode);
  } catch {
    /* the gateway may be down; the app still opens for the keypad */
  }
  let code = '';
  try {
    code = sessionStorage.getItem('vidur-code') ?? '';
  } catch {
    /* storage can be blocked */
  }
  if (needsCode && !code) {
    await new Promise<void>((resolve) => {
      render(<AccessGate onCode={(c) => { code = c; try { sessionStorage.setItem('vidur-code', c); } catch { /* ignore */ } resolve(); }} />, root);
    });
  }

  const telemetryRelay = (t: Telemetry): void => post({ type: 'vidur:telemetry', ...(t.transcript !== undefined ? { transcript: t.transcript } : {}), ...(t.parsed !== undefined ? { parsed: t.parsed } : {}), ...(t.sttMs !== undefined ? { sttMs: t.sttMs } : {}), ...(t.firstAudioMs !== undefined ? { firstAudioMs: t.firstAudioMs } : {}), ...(t.phase !== undefined ? { phase: t.phase } : {}) });

  const vault = await Vault.open();
  const playback = new Playback();
  (window as unknown as { __vidurPlayback: Playback }).__vidurPlayback = playback;
  const session = await PhoneSession.create({
    gatewayUrl: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`,
    ...(code ? { accessCode: code } : {}),
    vault,
    capture: new MicCapture(),
    playback,
    onTelemetry: telemetryRelay,
  });
  render(<App session={session} />, root);
  (window as unknown as { __vidur: PhoneSession }).__vidur = session; // used by the browser tests

  applyFrame('no-notch');
  window.addEventListener('message', (e: MessageEvent<BridgeDown>) => {
    if (e.origin !== window.location.origin || e.source !== window.parent) return;
    const m = e.data;
    if (!m || m.type !== 'vidur:set') return;
    if (m.theme) session.actions.setTheme(m.theme);
    if (m.lang) session.actions.setLang(m.lang);
    if (m.frame) applyFrame(m.frame);
  });
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-feature]');
    const id = el?.dataset['feature'] as FeatureId | undefined;
    if (id && (FEATURE_IDS as readonly string[]).includes(id)) post({ type: 'vidur:feature', id });
  }, true);
  post({ type: 'vidur:ready' });
}

void boot();
