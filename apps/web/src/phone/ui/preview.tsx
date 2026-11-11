import type {
  Actions,
  CustomerDetailVM,
  CustomerRow,
  FeedItem,
  HomeVM,
  SettingsVM,
} from '../contract.js';
import type { CustomersVM } from './Customers.js';
import type { RemindersVM } from './Reminders.js';
import type { KeypadVM } from './Keypad.js';
import type { OnboardingVM } from './Onboarding.js';
import type { BottomNavVM } from './BottomNav.js';
import type { StateIndicatorVM } from './StateIndicator.js';
import type { EntryCardVM } from '../contract.js';
import type { FeedVM } from './Feed.js';

const noop = () => undefined;

/** Mock Actions: every callback a no-op. Real apps inject real callbacks. */
export const mockActions: Actions = {
  micDown: noop,
  micUp: noop,
  undo: noop,
  openCustomer: noop,
  navigate: noop,
  setLang: noop,
  setTheme: noop,
  setConsent: noop,
  prepareReminder: noop,
  deleteAll: noop,
  saveKeypadEntry: noop,
  retry: noop,
  finishOnboarding: noop,
};

const now = Date.now();

export const mockCustomers: CustomerRow[] = [
  { id: 'c1', name: 'Ramesh', aliases: ['Ramesh bhai'], balancePaise: 34000, lastActivityAt: now - 36e5, reminderOptIn: true },
  { id: 'c2', name: 'Sunita', aliases: [], balancePaise: 125000, lastActivityAt: now - 72e5, reminderOptIn: false },
  { id: 'c3', name: 'Kavya', aliases: ['Kavya atta wali'], balancePaise: -5000, lastActivityAt: now - 9e5, reminderOptIn: true },
  { id: 'c4', name: 'Mohan', aliases: [], balancePaise: 0, lastActivityAt: null, reminderOptIn: false },
];

export const mockFeed: FeedItem[] = [
  { id: 'f1', customerName: 'Ramesh', kind: 'credit', paise: 34000, at: now - 60_000, undoableUntil: now + 9_000, heard: 'Ramesh ka 340 udhaar' },
  { id: 'f2', customerName: 'Sunita', kind: 'payment', paise: 20000, at: now - 900_000, undoableUntil: null },
  { id: 'f3', customerName: 'Kavya', kind: 'note', paise: null, at: now - 1_800_000, undoableUntil: null, heard: 'Kavya kal degi' },
  { id: 'f4', customerName: 'Mohan', kind: 'credit', paise: 125000, at: now - 3_600_000, undoableUntil: null },
];

export const mockHomeVM: HomeVM = {
  phase: 'idle',
  online: true,
  mockMode: true,
  card: {
    state: 'needs_answer',
    heard: '340 udhaar',
    agentLine: 'Kaun se Ramesh? Doodh wale ya auto wale?',
    paise: 34000,
    customerName: 'Ramesh',
    kind: 'credit',
  },
  creditTodayPaise: 15_90_000,
  paymentTodayPaise: 4_50_000,
  peopleToday: 7,
  feed: mockFeed,
  error: { text: 'Internet slow hai. Entry phone par save hui.', actionLabel: 'Theek hai' },
};

export const mockOfflineHomeVM: HomeVM = { ...mockHomeVM, phase: 'offline', online: false, card: null, error: null };

export const mockCustomersVM: CustomersVM = { customers: mockCustomers };

export const mockCustomerDetailVM: CustomerDetailVM = {
  customer: mockCustomers[0]!,
  entries: [
    { id: 'e1', kind: 'credit', paise: 34000, at: now - 60_000, undoableUntil: null },
    { id: 'e2', kind: 'payment', paise: 10000, at: now - 86_400_000, undoableUntil: null },
    { id: 'e3', kind: 'credit', paise: 11000, at: now - 172_800_000, undoableUntil: null },
  ],
  notes: [
    { id: 'n1', text: 'Kal 500 dega', dueAt: now + 86_400_000 },
    { id: 'n2', text: 'Ghar aake dega', dueAt: null },
  ],
  canRemind: true,
  reminderBlockedReason: null,
};

export const mockBlockedCustomerDetailVM: CustomerDetailVM = {
  ...mockCustomerDetailVM,
  canRemind: false,
  reminderBlockedReason: 'no_consent',
  customer: { ...mockCustomers[0]!, reminderOptIn: false },
};

export const mockRemindersVM: RemindersVM = { customers: mockCustomers };

export const mockSettingsVM: SettingsVM = {
  lang: 'hi',
  theme: 'light',
  shopName: 'Laxmi General Store',
  encrypted: true,
  retentionHours: 24,
};

export const mockOnboardingVM: OnboardingVM = { lang: 'hi' };

export const mockKeypadVM: KeypadVM = { customers: mockCustomers };

export const mockFeedVM: FeedVM = { items: mockFeed, showUndoForId: 'f1' };

export const mockStateIndicatorVMs: StateIndicatorVM[] = [
  { phase: 'idle' },
  { phase: 'listening' },
  { phase: 'thinking' },
  { phase: 'speaking' },
  { phase: 'needs_answer' },
  { phase: 'offline' },
];

export const mockBottomNavVM: BottomNavVM = { current: 'home' };

export const mockEntryCardVM: EntryCardVM = mockHomeVM.card!;
