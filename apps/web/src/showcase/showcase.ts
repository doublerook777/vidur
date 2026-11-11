/**
 * Showcase page wiring.
 *
 * Down-bridge (showcase -> phone iframe): BridgeDown { type: 'vidur:set', theme?, lang?, frame? }
 *   posted to the iframe's contentWindow with targetOrigin = location.origin.
 * Up-bridge (phone -> showcase): window 'message' events. Any message whose
 *   event.origin !== location.origin is IGNORED. Payloads are rendered with
 *   textContent only — never innerHTML.
 */
import { FEATURES } from './features.js';
import type { BridgeDown, BridgeUp, FeatureId, FrameKind, Lang, Theme } from '../phone/contract.js';
import { FEATURE_IDS } from '../phone/contract.js';

const iframe = document.getElementById('phoneApp') as HTMLIFrameElement | null;
const frameEl = document.getElementById('phoneFrame') as HTMLElement | null;

const featureTitle = document.getElementById('featureTitle');
const featureWhat = document.getElementById('featureWhat');
const featureWhy = document.getElementById('featureWhy');

const tTranscript = document.getElementById('tTranscript');
const tParsed = document.getElementById('tParsed');
const tStt = document.getElementById('tStt');
const tFirstAudio = document.getElementById('tFirstAudio');
const tState = document.getElementById('tState');

const state = {
  frame: 'notch' as FrameKind,
  theme: 'light' as Theme,
  lang: 'hi' as Lang,
};

function postToPhone(message: BridgeDown): void {
  const target = iframe?.contentWindow;
  if (!target) return;
  target.postMessage(message, window.location.origin);
}

function sendState(): void {
  postToPhone({ type: 'vidur:set', theme: state.theme, lang: state.lang, frame: state.frame });
}

function setPressed(selector: string, activeValue: string, attr: string): void {
  for (const btn of document.querySelectorAll<HTMLButtonElement>(selector)) {
    btn.setAttribute('aria-pressed', String(btn.dataset[attr] === activeValue));
  }
}

function applyFrame(frame: FrameKind): void {
  state.frame = frame;
  if (frameEl) frameEl.dataset['frame'] = frame;
  setPressed('[data-frame]', frame, 'frame');
  sendState();
}

function applyTheme(theme: Theme): void {
  state.theme = theme;
  setPressed('[data-theme]', theme, 'theme');
  sendState();
}

function applyLang(lang: Lang): void {
  state.lang = lang;
  setPressed('[data-lang]', lang, 'lang');
  sendState();
}

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-frame]')) {
  btn.addEventListener('click', () => {
    const v = btn.dataset['frame'];
    if (v === 'notch' || v === 'no-notch' || v === 'punch-hole') applyFrame(v);
  });
}
for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-theme]')) {
  btn.addEventListener('click', () => {
    const v = btn.dataset['theme'];
    if (v === 'light' || v === 'dark') applyTheme(v);
  });
}
for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
  btn.addEventListener('click', () => {
    const v = btn.dataset['lang'];
    if (v === 'hi' || v === 'en' || v === 'kn') applyLang(v);
  });
}

function isFeatureId(value: unknown): value is FeatureId {
  return typeof value === 'string' && (FEATURE_IDS as readonly string[]).includes(value);
}

function setText(el: HTMLElement | null, text: string): void {
  if (el) el.textContent = text;
}

function showFeature(id: FeatureId): void {
  const entry = FEATURES[id];
  setText(featureTitle, entry.title);
  setText(featureWhat, entry.what);
  setText(featureWhy, entry.why);
}

function showTelemetry(t: Extract<BridgeUp, { type: 'vidur:telemetry' }>): void {
  if (t.transcript !== undefined) setText(tTranscript, t.transcript);
  if (t.parsed !== undefined) setText(tParsed, t.parsed);
  if (t.sttMs !== undefined) setText(tStt, `${String(t.sttMs)} ms`);
  if (t.firstAudioMs !== undefined) setText(tFirstAudio, `${String(t.firstAudioMs)} ms`);
  if (t.phase !== undefined) setText(tState, t.phase);
}

window.addEventListener('message', (event: MessageEvent) => {
  // Ignore anything not from our own origin.
  if (event.origin !== window.location.origin) return;
  const data = event.data as Partial<BridgeUp> | null;
  if (typeof data !== 'object' || data === null) return;

  if (data.type === 'vidur:ready') {
    sendState();
    return;
  }
  if (data.type === 'vidur:feature' && isFeatureId((data as { id?: unknown }).id)) {
    showFeature((data as { id: FeatureId }).id);
    return;
  }
  if (data.type === 'vidur:telemetry') {
    showTelemetry(data as Extract<BridgeUp, { type: 'vidur:telemetry' }>);
  }
});

// Push initial state once the iframe has loaded (and on load, for good measure).
iframe?.addEventListener('load', sendState);
sendState();
