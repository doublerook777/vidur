import { Dialogue, Ledger, amountToSpoken, canRemind, groundLlmOutput, say, seedDemoLedger, type LlmParser, type Reply } from '@vidur/core';

import { bytesToPcm16 } from '../audio/pcm.js';
import type { Actions, AddPreset, CustomerDetailVM, CustomerRow, EntryCardVM, ErrorVM, FeedItem, Lang, Phase, Screen, Theme, ToastVM } from '../contract.js';
import { GatewayClient, type GatewayError, type Transcript } from '../net/gateway.js';
import { Vault } from '../storage/vault.js';
import { LABELS } from '../ui/labels.js';
import { errorMessage } from './messages.js';
import { Store } from './store.js';
import { UNDO_MS, customerDetail, customerRows, feed, ledgerTotals, todayTotals } from './viewmodels.js';

export interface AudioIn {
  open(): Promise<void>;
  begin(sink: (frame: ArrayBuffer) => void): void;
  end(): void;
  close(): void;
}
export interface AudioOut {
  open(): Promise<void>;
  resume?(): Promise<void>;
  push(pcm: Int16Array): void;
  flush(): void;
  close(): void;
  onBusy: ((busy: boolean) => void) | null;
}

export interface Telemetry {
  transcript?: string;
  parsed?: string;
  sttMs?: number;
  firstAudioMs?: number;
  phase?: Phase;
}

export interface SessionState {
  loaded: boolean;
  onboarded: boolean;
  screen: Screen;
  openCustomerId: string | null;
  lang: Lang;
  theme: Theme;
  shopName: string;
  phase: Phase;
  online: boolean;
  mockMode: boolean;
  card: EntryCardVM | null;
  error: ErrorVM | null;
  credit: number;
  payment: number;
  people: number;
  /** All time, over every customer: shown at the top of the Customers screen. */
  allCredit: number;
  allPayment: number;
  feed: FeedItem[];
  /** Every entry, newest first, for the All entries screen. */
  history: FeedItem[];
  addPreset: AddPreset | null;
  toast: ToastVM | null;
  customers: CustomerRow[];
  detail: CustomerDetailVM | null;
  shareReminder: { customerId: string; text: string } | null;
  /** Milliseconds from releasing the button to the first audio of the reply, for the last turn. */
  lastEndToAudioMs: number | null;
}

export interface SessionOptions {
  gatewayUrl: string;
  accessCode?: string;
  WebSocketImpl?: typeof WebSocket;
  vault: Vault;
  capture: AudioIn;
  playback: AudioOut;
  clock?: () => number;
  onTelemetry?: (t: Telemetry) => void;
  backoffMs?: number[];
}

/** A fresh install starts in the phone's own language (English, Kannada), and in Hindi for anything else. */
function deviceLang(): Lang {
  const tag = typeof navigator === 'undefined' ? '' : (navigator.language || '').toLowerCase();
  if (tag.startsWith('kn')) return 'kn';
  if (tag.startsWith('en')) return 'en';
  return 'hi';
}

const initial = (): SessionState => ({
  loaded: false, onboarded: false, screen: 'onboarding', openCustomerId: null, lang: 'hi', theme: 'light', shopName: '', phase: 'idle', online: false, mockMode: false,
  card: null, error: null, credit: 0, payment: 0, people: 0, allCredit: 0, allPayment: 0, feed: [], history: [], addPreset: null, toast: null, customers: [], detail: null, shareReminder: null, lastEndToAudioMs: null,
});

/** A recording whose loudest sample stays under this (of 32767) is silence: nothing was said. Speech peaks well above 1,000. */
const SILENT_PEAK = 250;

export class PhoneSession {
  readonly store = new Store<SessionState>(initial());
  private ledger!: Ledger;
  private dialogue!: Dialogue;
  private gateway!: GatewayClient;
  private readonly now: () => number;
  private pressing = false;
  private pttUpAt = 0;
  private awaitingFirstAudio = false;
  private active = new Set<string>();
  private speaking = false;
  private replyCounter = 0;
  private idCounter = 0;
  private llmAvailable = false;
  private undoTimer: ReturnType<typeof setTimeout> | null = null;
  private purgeTimer: ReturnType<typeof setInterval> | null = null;

  private constructor(private o: SessionOptions) {
    this.now = o.clock ?? Date.now;
  }

  static async create(o: SessionOptions): Promise<PhoneSession> {
    const s = new PhoneSession(o);
    await s.init();
    return s;
  }

  get state(): SessionState {
    return this.store.get();
  }

  private newId = (): string => `${this.now().toString(36)}-${(++this.idCounter).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  private async init(): Promise<void> {
    this.ledger = await Ledger.load(this.o.vault.ledgerStore, this.now, this.newId);
    const meta = (await this.o.vault.getMeta<{ lang: Lang; theme: Theme; shopName: string; onboarded: boolean }>('settings')) ?? { lang: deviceLang(), theme: 'light' as Theme, shopName: '', onboarded: false };
    this.store.update({ lang: meta.lang, theme: meta.theme, shopName: meta.shopName, onboarded: meta.onboarded, screen: meta.onboarded ? 'home' : 'onboarding', loaded: true });
    this.buildDialogue();
    this.connect();
    // The server streams a reply much faster than it plays, so audio keeps playing from the buffer after the
    // last chunk arrives. The speaker, not the socket, says when the agent has really stopped talking.
    this.o.playback.onBusy = (busy) => {
      this.speaking = busy;
      if (this.pressing) return;
      if (busy) this.setPhase('speaking');
      else if (this.active.size === 0 && this.state.phase === 'speaking') this.setPhase(this.dialogue.hasPending() ? 'needs_answer' : 'idle');
    };
    this.purgeTimer = setInterval(() => void this.o.vault.purgeTranscripts(this.now()), 60 * 60 * 1000);
    this.refresh();
  }

  private buildDialogue(): void {
    const llm: LlmParser | undefined = this.llmAvailable
      ? async (text) => {
          const raw = await this.gateway.parse(text);
          return raw ? groundLlmOutput(raw, text) : null;
        }
      : undefined;
    this.dialogue = new Dialogue({ ledger: this.ledger, lang: this.state.lang, clock: this.now, ...(llm ? { llm } : {}) });
  }

  private connect(): void {
    this.gateway = new GatewayClient(
      {
        url: this.o.gatewayUrl,
        lang: this.state.lang,
        ...(this.o.accessCode ? { accessCode: this.o.accessCode } : {}),
        ...(this.o.WebSocketImpl ? { WebSocketImpl: this.o.WebSocketImpl } : {}),
        ...(this.o.backoffMs ? { backoffMs: this.o.backoffMs } : {}),
      },
      {
        onState: (s) => {
          this.store.update({ online: s === 'open' });
          if (s !== 'open' && this.state.phase !== 'listening') this.setPhase('offline');
          else if (s === 'open' && this.state.phase === 'offline') this.setPhase('idle');
        },
        onReady: (info) => {
          this.llmAvailable = info.llm;
          this.buildDialogueKeepingState();
          // A degraded hello already came with its own, more specific error (out of credit, bad key). Keep that one.
          this.store.update({ mockMode: info.mode === 'mock', error: info.degraded ? this.state.error ?? errorMessage('network', this.state.lang) : null });
          if (info.degraded) this.setPhase('offline'); // the speech service is unusable right now; the keypad still works
          this.sendContext();
        },
        onTranscript: (t) => void this.onTranscript(t),
        onTtsStart: (id) => {
          // Events for a sentence that was interrupted are ignored, so they cannot undo "listening".
          if (!this.active.has(id) || this.pressing) return;
          this.speaking = true;
          this.setPhase('speaking');
        },
        onTtsEnd: (id) => {
          if (!this.active.delete(id)) return;
          // Still playing from the buffer? Then onBusy(false) will finish the state.
          if (this.active.size === 0 && !this.pressing && !this.speaking) this.setPhase(this.dialogue.hasPending() ? 'needs_answer' : 'idle');
        },
        onAudio: (b) => {
          if (this.active.size === 0) return; // late audio of an interrupted sentence
          if (this.awaitingFirstAudio) {
            this.awaitingFirstAudio = false;
            const ms = Math.round(performance.now() - this.pttUpAt);
            this.store.update({ lastEndToAudioMs: ms });
            this.o.onTelemetry?.({ firstAudioMs: ms });
          }
          this.o.playback.push(bytesToPcm16(b));
        },
        onError: (e) => this.onGatewayError(e),
      },
    );
    this.gateway.connect();
  }

  private buildDialogueKeepingState(): void {
    // Only rebuilt when the LLM becomes available, and never while a question is open.
    if (!this.dialogue.hasPending()) this.buildDialogue();
  }

  private onGatewayError(e: GatewayError): void {
    if (e.recoverable && (e.code === 'stt_timeout' || e.code === 'speech_error') && this.takeSilentReply()) return; // the reply to a silent recording
    this.store.update({ error: errorMessage(e.code, this.state.lang) });
    if (!e.recoverable) this.setPhase('offline');
    // A failed turn must not leave the "thinking" or "speaking" pill on screen: the person can simply try again.
    else if (this.state.phase === 'thinking' || this.state.phase === 'speaking') this.setPhase(this.dialogue.hasPending() ? 'needs_answer' : 'idle');
  }

  private setPhase(phase: Phase): void {
    if (this.state.phase === phase) return;
    this.store.update({ phase });
    this.o.onTelemetry?.({ phase });
  }

  private sendContext(): void {
    const names: string[] = [];
    for (const c of this.ledger.customers()) names.push(c.name, ...c.aliases);
    this.gateway.context(names);
  }

  /** Recomputes everything the screens show from the ledger. */
  refresh(): void {
    const now = this.now();
    const t = todayTotals(this.ledger, now);
    const open = this.state.openCustomerId;
    const all = ledgerTotals(this.ledger);
    this.store.update({ credit: t.credit, payment: t.payment, people: t.people, allCredit: all.credit, allPayment: all.payment, feed: feed(this.ledger, now), history: feed(this.ledger, now, 500), customers: customerRows(this.ledger), detail: open ? customerDetail(this.ledger, open, now) : null });
    if (this.undoTimer) clearTimeout(this.undoTimer);
    if (this.state.feed[0]?.undoableUntil) this.undoTimer = setTimeout(() => this.refresh(), UNDO_MS + 50); // the undo button disappears on its own
  }

  // ---------------------------------------------------------------- one turn

  private async onTranscript(t: Transcript): Promise<void> {
    if (t.audioMs > 0 && this.takeSilentReply()) return; // the reply to a silent recording
    this.o.onTelemetry?.({ transcript: t.text, sttMs: t.sttMs });
    if (!t.text.trim()) {
      this.store.update({ card: null, error: errorMessage('didnt_hear', this.state.lang) });
      this.setPhase('idle');
      return;
    }
    this.store.update({ card: { state: 'heard', heard: t.text }, error: null });
    await this.o.vault.putTranscript(this.newId(), t.text, this.now()).catch(() => undefined);
    const before = this.ledger.lastEntry()?.id;
    const replies = await this.dialogue.handle(t.text);
    this.afterReplies(replies, before, t.text);
  }

  private afterReplies(replies: Reply[], lastBefore: string | undefined, heard: string | undefined): void {
    const lines = replies.filter((r) => r.key !== 'disclosure').map((r) => r.text);
    const last = this.ledger.lastEntry();
    const saved = last && last.id !== lastBefore ? last : null;
    const customerName = saved ? this.ledger.customer(saved.customerId)?.name : undefined;
    this.store.update({
      card: {
        state: this.dialogue.hasPending() ? 'needs_answer' : saved ? 'saved' : 'heard',
        ...(this.isYesNo() ? { answers: 'yes_no' as const } : {}),
        ...(heard ? { heard } : {}),
        agentLine: lines.join(' '),
        ...(saved ? { paise: saved.paise, kind: saved.kind } : {}),
        ...(customerName ? { customerName } : {}),
      },
    });
    if (replies.some((r) => r.key === 'note_saved' || r.key === 'note_saved_plain')) {
      const noteCustomerId = this.newestNoteCustomer();
      if (noteCustomerId && this.state.card) this.store.update({ card: { ...this.state.card, noteCustomerId } });
    }
    const share = replies.find((r) => r.action)?.action;
    if (share) this.store.update({ shareReminder: { customerId: share.customerId, text: share.text } });
    this.o.onTelemetry?.({ parsed: lines.join(' | ') });
    this.refresh();
    this.sendContext();
    this.speak(replies);
  }

  private speak(replies: Reply[]): void {
    if (this.quiet) {
      this.setPhase(this.dialogue.hasPending() ? 'needs_answer' : 'idle');
      return;
    }
    if (!this.gateway.canSend) {
      this.setPhase(this.dialogue.hasPending() ? 'needs_answer' : this.state.online ? 'idle' : 'offline');
      return;
    }
    for (const r of replies) {
      const id = `r${++this.replyCounter}`;
      this.active.add(id);
      this.gateway.speak(id, r.text, r.lang);
    }
    if (!replies.length) this.setPhase(this.dialogue.hasPending() ? 'needs_answer' : 'idle');
  }

  // ---------------------------------------------------------------- actions

  private bargeIn(): void {
    if (this.speaking || this.active.size > 0) {
      this.o.playback.flush();
      this.gateway.interrupt();
      this.active.clear();
      this.speaking = false;
      this.dialogue.interrupt();
    }
  }

  readonly actions: Actions = {
    micDown: () => void this.micDown(),
    micUp: () => this.micUp(),
    undo: (id) => void this.undo(id),
    openCustomer: (id) => {
      this.store.update({ openCustomerId: id, screen: 'customer' });
      this.refresh();
    },
    navigate: (screen) => {
      this.store.update({ screen, ...(screen !== 'customer' ? { openCustomerId: null } : {}) });
      this.refresh();
    },
    setLang: (lang) => void this.setLang(lang),
    setTheme: (theme) => {
      this.store.update({ theme });
      void this.saveSettings();
    },
    setConsent: (id, optIn) => void this.ledger.setConsent(id, optIn).then(() => this.refresh()),
    prepareReminder: (id) => void this.prepareReminder(id),
    deleteAll: () => void this.deleteAll(),
    saveKeypadEntry: (i) => void this.saveKeypad(i),
    openAddEntry: (preset) => {
      this.store.update({ addPreset: preset ?? null, screen: 'keypad' });
    },
    removeEntry: (id) => void this.removeEntry(id),
    restoreEntry: (token) => void this.restoreEntry(token),
    dismissToast: () => this.dismissToast(),
    answer: (a) => void this.answer(a),
    cancelAnswer: () => this.cancelAnswer(),
    retry: () => {
      this.store.update({ error: null });
      this.gateway.close();
      this.connect();
    },
    finishOnboarding: (o) => void this.finishOnboarding(o),
  };

  /** Called from the first mic press, which is a user gesture, so the browser allows audio to start. */
  async micDown(): Promise<void> {
    if (this.pressing) return;
    this.pressing = true;
    this.bargeIn();
    try {
      await this.o.capture.open();
      await this.o.playback.open();
      await this.o.playback.resume?.();
    } catch {
      this.pressing = false;
      this.store.update({ error: errorMessage('mic_denied', this.state.lang), phase: 'idle' });
      return;
    }
    if (!this.pressing) return; // released while the permission prompt was showing
    // Just after the page loads or the language changes the connection may still be opening. Give it a moment.
    for (let waited = 0; !this.gateway.canSend && waited < 1500 && this.pressing; waited += 50) await new Promise((r) => setTimeout(r, 50));
    if (!this.pressing) return;
    if (!this.gateway.canSend) {
      this.pressing = false;
      this.store.update({ error: errorMessage('network', this.state.lang) });
      this.setPhase('offline');
      return;
    }
    this.store.update({ error: null, card: { state: 'listening' } });
    this.setPhase('listening');
    this.gateway.pttDown();
    this.peak = 0;
    this.o.capture.begin((f) => {
      this.trackPeak(f);
      this.gateway.sendAudio(f);
    });
    // The very first press of a session also plays the AI disclosure afterwards, via the dialogue engine.
  }

  /** The customer who got the most recent note: the card points the shopkeeper to it. */
  private newestNoteCustomer(): string | null {
    let best: { id: string; at: number } | null = null;
    for (const c of this.ledger.customers()) {
      for (const n of this.ledger.notes(c.id)) if (!best || n.recordedAt >= best.at) best = { id: c.id, at: n.recordedAt };
    }
    return best?.id ?? null;
  }

  private cancelAnswer(): void {
    this.bargeIn();
    const replies = this.dialogue.cancelPending();
    this.store.update({ card: { state: 'heard', agentLine: replies.map((r) => r.text).join(' ') }, error: null });
    this.setPhase('idle');
    this.sendContext();
  }

  private peak = 0;
  private silentUntil = 0;

  private trackPeak(frame: ArrayBuffer): void {
    const v = new Int16Array(frame);
    for (let i = 0; i < v.length; i++) {
      const a = Math.abs(v[i]!);
      if (a > this.peak) this.peak = a;
    }
  }

  /** True once, right after a silent recording: its late reply from the speech service is dropped. */
  private takeSilentReply(): boolean {
    if (this.silentUntil && Date.now() < this.silentUntil) {
      this.silentUntil = 0;
      return true;
    }
    this.silentUntil = 0;
    return false;
  }

  micUp(): void {
    if (!this.pressing) return;
    this.pressing = false;
    this.pttUpAt = performance.now();
    this.awaitingFirstAudio = true;
    this.o.capture.end();
    setTimeout(() => this.gateway.pttUp(), 45); // lets the last audio frame go out first
    if (this.peak < SILENT_PEAK) {
      // Nothing was said. Say so now, and ignore the one reply the speech service still sends for this recording.
      this.silentUntil = Date.now() + 15_000;
      this.store.update({ card: null, error: errorMessage('didnt_hear', this.state.lang) });
      this.setPhase('idle');
      return;
    }
    this.silentUntil = 0;
    this.setPhase('thinking');
  }

  /** True when the open question is a yes or no, so the screen can show two buttons. */
  private isYesNo(): boolean {
    const k = this.dialogue.pendingKind();
    return k === 'new_customer' || k === 'confirm_amount' || k === 'near' || k === 'consent';
  }

  /** Tapping Yes or No does exactly what saying it does: the words go through the same dialogue. */
  private async answer(a: 'yes' | 'no'): Promise<void> {
    if (!this.isYesNo()) return;
    const words: Record<Lang, [string, string]> = { hi: ['हाँ', 'नहीं'], en: ['yes', 'no'], kn: ['ಹೌದು', 'ಇಲ್ಲ'] };
    const text = words[this.state.lang][a === 'yes' ? 0 : 1];
    this.bargeIn();
    await this.onTranscript({ text, lang: this.state.lang, sttMs: 0, audioMs: 0 });
  }

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.store.update({ toast: null });
  }

  /** Removing is a reversal in the event log: the entry stays on record as removed and can be brought back for a while. */
  private async removeEntry(entryId: string): Promise<void> {
    let token: string;
    try {
      token = await this.ledger.reverse(entryId);
    } catch {
      return;
    }
    this.store.update({ card: null });
    const t = LABELS[this.state.lang];
    this.store.update({ toast: { text: t.removed, actionLabel: t.undo, restoreToken: token } });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.dismissToast(), 8000);
    this.refresh();
  }

  private async restoreEntry(token: string): Promise<void> {
    try {
      await this.ledger.reverse(token);
    } catch {
      /* already restored */
    }
    this.dismissToast();
    this.refresh();
  }

  private quiet = false;

  /**
   * Shows one moment of the story for the showcase page: 0 home with the demo khata, 1 a real question from the dialogue,
   * 2 the entries with their times, 3 settings with the encryption badge. The question is silent and nothing is saved by it.
   */
  async showScene(scene: 0 | 1 | 2 | 3): Promise<void> {
    if (!this.state.onboarded) await this.finishOnboarding({ lang: this.state.lang, demoData: true });
    if (this.state.phase === 'listening') return; // never move the screen under a press
    if (scene === 2) return void this.actions.navigate('history');
    if (scene === 3) return void this.actions.navigate('settings');
    this.actions.navigate('home');
    this.store.update({ card: null });
    if (scene === 1) {
      this.quiet = true;
      await this.onTranscript({ text: 'Kiran ka 100 udhaar', lang: this.state.lang, sttMs: 0, audioMs: 0 });
      this.quiet = false;
    }
  }

  private async undo(entryId: string): Promise<void> {
    await this.ledger.reverse(entryId);
    this.store.update({ card: null });
    this.refresh();
  }

  private async setLang(lang: Lang): Promise<void> {
    // An agent line already on screen was written in the old language: redo the greeting, drop anything else.
    const card = this.state.card;
    const wasGreeting = card?.agentLine === say(this.state.lang, 'disclosure');
    this.store.update({ lang, ...(card?.agentLine ? { card: wasGreeting ? { state: 'heard' as const, agentLine: say(lang, 'disclosure') } : null } : {}) });
    await this.saveSettings();
    this.gateway.setLang(lang);
    this.gateway.close();
    this.connect();
    this.buildDialogue();
  }

  private async saveSettings(): Promise<void> {
    const s = this.state;
    await this.o.vault.putMeta('settings', { lang: s.lang, theme: s.theme, shopName: s.shopName, onboarded: s.onboarded });
  }

  private async prepareReminder(id: string): Promise<void> {
    const gate = canRemind(this.ledger, id, this.now());
    if (!gate.ok) return this.refresh();
    const name = this.ledger.customer(id)?.name ?? '';
    const text = say(this.state.lang, 'reminder_text', { name, amount: amountToSpoken(this.ledger.balance(id), this.state.lang, 'digits') });
    await this.ledger.recordReminder(id);
    this.store.update({ shareReminder: { customerId: id, text } });
    this.refresh();
  }

  private async saveKeypad(i: { customerId: string | null; newName: string | null; kind: 'credit' | 'payment'; paise: number; at?: number }): Promise<void> {
    let id = i.customerId;
    // The shopkeeper typed the name themselves, so that is the "yes" a spoken new name has to ask for.
    if (!id && i.newName?.trim()) id = (await this.ledger.createCustomer(i.newName.trim())).id;
    if (!id || !Number.isInteger(i.paise) || i.paise <= 0) return;
    const now = this.now();
    const at = i.at !== undefined && Number.isFinite(i.at) ? Math.min(i.at, now) : now;
    await this.ledger.postEntry({ customerId: id, kind: i.kind, paise: i.paise, at });
    const name = this.ledger.customer(id)?.name ?? '';
    this.store.update({ card: { state: 'saved', paise: i.paise, kind: i.kind, customerName: name }, screen: this.state.openCustomerId ? 'customer' : 'home', addPreset: null });
    this.refresh();
  }

  private async finishOnboarding(o: { lang: Lang; demoData: boolean }): Promise<void> {
    this.store.update({ lang: o.lang, onboarded: true, screen: 'home' });
    if (o.demoData && this.ledger.customers().length === 0) await seedDemoLedger(this.ledger, this.now());
    await this.saveSettings();
    this.gateway.setLang(o.lang);
    this.gateway.close();
    this.connect();
    this.buildDialogue();
    this.refresh();
    // The disclosure is spoken right away, because the Start button was a tap and audio is allowed.
    try {
      await this.o.playback.open();
      await this.o.playback.resume?.();
    } catch {
      /* the text is on screen either way */
    }
    const replies = this.dialogue.start();
    this.store.update({ card: { state: 'heard', agentLine: replies.map((r) => r.text).join(' ') } });
    const speakWhenReady = (n = 0): void => {
      if (this.gateway.canSend) this.speak(replies);
      else if (n < 20) setTimeout(() => speakWhenReady(n + 1), 150);
    };
    speakWhenReady();
  }

  private async deleteAll(): Promise<void> {
    this.gateway.close();
    await this.o.vault.deleteAll();
    this.o.vault = await Vault.open(undefined, undefined, undefined);
    this.ledger = await Ledger.load(this.o.vault.ledgerStore, this.now, this.newId);
    this.store.set({ ...initial(), loaded: true, lang: this.state.lang, theme: this.state.theme });
    this.buildDialogue();
    this.connect();
    this.refresh();
  }

  /** Test and diagnostics hook. */
  get debug(): { ledger: Ledger; dialogue: Dialogue } {
    return { ledger: this.ledger, dialogue: this.dialogue };
  }

  dispose(): void {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.gateway.close();
    this.o.capture.close();
    this.o.playback.close();
  }
}
