/**
 * The contract between the phone app, its screens, and the showcase page.
 * Screens are pure: they render a view model and call callbacks. They never touch audio, storage or the network.
 */
export type Lang = 'hi' | 'en' | 'kn';
export type Theme = 'light' | 'dark';
export type FrameKind = 'notch' | 'no-notch' | 'punch-hole';

/** Every state is visibly and audibly distinct. */
export type Phase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'needs_answer' | 'offline';

export interface CustomerRow {
  id: string;
  name: string;
  aliases: string[];
  /** Integer paise. Positive means the customer owes money. */
  balancePaise: number;
  lastActivityAt: number | null;
  reminderOptIn: boolean;
}

export interface FeedItem {
  id: string;
  customerName: string;
  kind: 'credit' | 'payment' | 'note';
  paise: number | null;
  /** When the money moved (can be backdated), epoch ms. */
  at: number;
  /** When the entry was written down, epoch ms. */
  recordedAt: number;
  /** An entry can be undone for 10 seconds after it is saved. */
  undoableUntil: number | null;
  /** Said by the shopkeeper, only kept in memory and purged after 24 hours. Optional. */
  heard?: string;
}

export interface EntryCardVM {
  state: 'listening' | 'heard' | 'saved' | 'needs_answer';
  heard?: string;
  /** What the agent said or asked. Fixed template text. */
  agentLine?: string;
  paise?: number;
  customerName?: string;
  kind?: 'credit' | 'payment' | 'note';
  /** Set when the open question is a yes or no, so the card can show two big buttons. */
  answers?: 'yes_no';
}

export interface ErrorVM {
  /** Always says what to do next, in the shopkeeper's language. */
  text: string;
  actionLabel?: string;
}

export interface HomeVM {
  phase: Phase;
  shopName: string;
  /** Epoch ms, for the date under the greeting. */
  now: number;
  online: boolean;
  mockMode: boolean;
  card: EntryCardVM | null;
  creditTodayPaise: number;
  paymentTodayPaise: number;
  peopleToday: number;
  feed: FeedItem[];
  error: ErrorVM | null;
}

export interface CustomerDetailVM {
  customer: CustomerRow;
  entries: { id: string; kind: 'credit' | 'payment'; paise: number; at: number; recordedAt: number; undoableUntil: number | null }[];
  notes: { id: string; text: string; dueAt: number | null }[];
  canRemind: boolean;
  reminderBlockedReason: 'no_consent' | 'too_soon' | 'nothing_due' | null;
}

export interface SettingsVM {
  lang: Lang;
  theme: Theme;
  shopName: string;
  encrypted: boolean;
  retentionHours: number;
}

export type Screen = 'home' | 'customers' | 'customer' | 'reminders' | 'settings' | 'onboarding' | 'keypad' | 'history';

export interface HistoryVM {
  items: FeedItem[];
}

/** Shown for a few seconds after an entry is removed, so the removal can be taken back. */
export interface ToastVM {
  text: string;
  actionLabel: string;
  restoreToken: string;
}

/** Where the Add entry screen starts: a customer and a direction already chosen. */
export interface AddPreset {
  customerId?: string;
  kind?: 'credit' | 'payment';
}

/** Callbacks the screens may call. */
export interface Actions {
  micDown(): void;
  micUp(): void;
  undo(entryId: string): void;
  openCustomer(id: string): void;
  navigate(screen: Screen): void;
  setLang(lang: Lang): void;
  setTheme(theme: Theme): void;
  setConsent(customerId: string, optIn: boolean): void;
  prepareReminder(customerId: string): void;
  deleteAll(): void;
  saveKeypadEntry(input: { customerId: string | null; newName: string | null; kind: 'credit' | 'payment'; paise: number; at?: number }): void;
  /** Opens the Add entry screen. */
  openAddEntry(preset?: AddPreset): void;
  /** Removes one entry by hand. It is reversed, not erased, so `restoreEntry` can bring it back. */
  removeEntry(entryId: string): void;
  restoreEntry(restoreToken: string): void;
  dismissToast(): void;
  /** Taps Yes or No for the open question. Same as saying it. */
  answer(a: 'yes' | 'no'): void;
  retry(): void;
  finishOnboarding(opts: { lang: Lang; demoData: boolean }): void;
}

/** Every interactive element carries data-feature="<id>", so the showcase can explain it. */
export const FEATURE_IDS = [
  'mic-button', 'ai-badge', 'totals', 'feed', 'entry-card', 'undo', 'customer-list', 'customer-detail', 'balance', 'reminder-gate', 'consent-toggle',
  'language-switch', 'theme-switch', 'delete-all', 'keypad', 'offline-banner', 'onboarding-disclosure', 'encrypted-badge', 'disambiguation', 'confirm-amount', 'state-indicator',
  'timestamp', 'add-entry', 'remove-entry', 'answer-buttons', 'history',
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

/** Showcase to phone, and phone to showcase, over postMessage. Always check event.origin. */
/** The showcase asks the phone to show one moment, so the page and the phone tell the same story. */
export type Scene = 0 | 1 | 2 | 3;
export type BridgeDown = { type: 'vidur:set'; theme?: Theme; lang?: Lang; frame?: FrameKind } | { type: 'vidur:scene'; scene: Scene };
export type BridgeUp =
  | { type: 'vidur:ready' }
  | { type: 'vidur:feature'; id: FeatureId }
  | { type: 'vidur:telemetry'; transcript?: string; parsed?: string; sttMs?: number; firstAudioMs?: number; phase?: Phase };
