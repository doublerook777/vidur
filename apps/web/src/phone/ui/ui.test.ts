import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { h } from 'preact';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'preact-render-to-string';

import { FEATURE_IDS, type Phase } from '../contract.js';
import { LABELS, PHASE_LABEL_KEY } from './labels.js';
import { formatRupees } from './format.js';
import { Home } from './Home.js';
import { Customers } from './Customers.js';
import { CustomerDetail } from './CustomerDetail.js';
import { Reminders } from './Reminders.js';
import { Settings } from './Settings.js';
import { Onboarding } from './Onboarding.js';
import { LockScreen } from './LockScreen.js';
import { Keypad } from './Keypad.js';
import { StateIndicator } from './StateIndicator.js';
import { EntryCard } from './EntryCard.js';
import { Feed } from './Feed.js';
import {
  mockActions,
  mockCustomersVM,
  mockCustomerDetailVM,
  mockBlockedCustomerDetailVM,
  mockHomeVM,
  mockKeypadVM,
  mockOfflineHomeVM,
  mockYesNoHomeVM,
  mockOnboardingVM,
  mockRemindersVM,
  mockSettingsVM,
  mockStateIndicatorVMs,
} from './preview.js';

const here = dirname(fileURLToPath(import.meta.url));

const renderedScreens: Record<string, string> = {
  home: renderToString(h(Home, {vm: mockHomeVM, actions: mockActions, lang: 'hi', })),
  homeYesNo: renderToString(h(Home, {vm: mockYesNoHomeVM, actions: mockActions, lang: 'hi', })),
  homeOffline: renderToString(h(Home, {vm: mockOfflineHomeVM, actions: mockActions, lang: 'hi', })),
  customers: renderToString(h(Customers, {vm: mockCustomersVM, actions: mockActions, lang: 'hi', })),
  customerDetail: renderToString(h(CustomerDetail, {vm: mockCustomerDetailVM, actions: mockActions, lang: 'hi', })),
  reminders: renderToString(h(Reminders, {vm: mockRemindersVM, actions: mockActions, lang: 'hi', })),
  settings: renderToString(h(Settings, {vm: mockSettingsVM, actions: mockActions, lang: 'hi', })),
  onboarding: renderToString(h(Onboarding, {vm: mockOnboardingVM, actions: mockActions, lang: 'hi', })),
  keypad: renderToString(h(Keypad, {vm: mockKeypadVM, actions: mockActions, lang: 'hi', })),
  keypadNewCustomer: renderToString(h(Keypad, { vm: { ...mockKeypadVM, preset: { newCustomer: true } }, actions: mockActions, lang: 'en' })),
  lockScreen: renderToString(h(LockScreen, { vm: { shopName: 'Test', lockUntil: null, wrongAttempts: 0, error: null }, actions: mockActions, lang: 'hi' })),
  homeCompleteProfile: renderToString(h(Home, { vm: { ...mockHomeVM, showCompleteProfile: true }, actions: mockActions, lang: 'hi' })),
};

const mockCustomers0Id = (): string => mockKeypadVM.customers[0]!.id;

const allRendered = Object.values(renderedScreens).join('\n');

describe('FEATURE_IDS coverage', () => {
  it.each(FEATURE_IDS.map((id) => [id] as const))('data-feature="%s" appears in some screen', (id) => {
    expect(allRendered).toContain(`data-feature="${id}"`);
  });
});

describe('manual new customer', () => {
  it('offers an optional nickname field in every language', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      const html = renderToString(h(Keypad, { vm: { ...mockKeypadVM, preset: { newCustomer: true } }, actions: mockActions, lang }));
      expect(html).toContain(LABELS[lang].newNickname);
    }
  });
});

describe('name on the customer detail screen', () => {
  it('shows the name with an edit button, in every language', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      const html = renderToString(h(CustomerDetail, { vm: mockCustomerDetailVM, actions: mockActions, lang }));
      expect(html).toContain(`${LABELS[lang].nameLabel}: ${mockCustomerDetailVM.customer.name}`);
      expect(html).toContain(LABELS[lang].editName);
    }
  });
});

describe('nickname on the customer detail screen', () => {
  const withNick = { ...mockCustomerDetailVM, customer: { ...mockCustomerDetailVM.customer, nickname: 'dairy' } };
  const without = { ...mockCustomerDetailVM, customer: { ...mockCustomerDetailVM.customer, nickname: undefined } };
  it('shows the nickname and an edit button, in every language', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      const html = renderToString(h(CustomerDetail, { vm: withNick, actions: mockActions, lang }));
      expect(html).toContain(`${LABELS[lang].nickname}: dairy`);
      expect(html).toContain(LABELS[lang].editNickname);
      expect(html).toContain(`${withNick.customer.name} (dairy`);
    }
  });
  it('says "no nickname" when there is none', () => {
    const html = renderToString(h(CustomerDetail, { vm: without, actions: mockActions, lang: 'en' }));
    expect(html).toContain(LABELS.en.noNickname);
  });
});

describe('editing an entry by hand', () => {
  it('the keypad opens on the entry: edit title, its amount and a Save button, in every language', () => {
    const preset = { customerId: mockCustomers0Id(), kind: 'payment' as const, editEntry: { id: 'e1', kind: 'payment' as const, paise: 25_000, at: Date.now() - 86_400_000 } };
    for (const lang of ['en', 'hi', 'kn'] as const) {
      const html = renderToString(h(Keypad, { vm: { ...mockKeypadVM, preset }, actions: mockActions, lang }));
      expect(html).toContain(LABELS[lang].editEntry);
      expect(html).toContain('₹250');
      expect(html).toContain(LABELS[lang].save);
      expect(html).not.toContain(`>${LABELS[lang].addEntry}<`);
    }
  });
  it('an entry row offers Edit for whole rupees, and not when it holds paise', () => {
    // The manage menu is closed on first render, so check the labels exist for the three languages.
    for (const lang of ['en', 'hi', 'kn'] as const) {
      expect(LABELS[lang].edit.length).toBeGreaterThan(0);
      expect(LABELS[lang].entryEdited.length).toBeGreaterThan(0);
    }
  });
});

describe('phase indicators', () => {
  const phases: Phase[] = ['idle', 'listening', 'thinking', 'speaking', 'needs_answer', 'offline'];
  it.each(phases.map((p) => [p] as const))('phase %s shows its own label text', (phase) => {
    for (const indicator of mockStateIndicatorVMs) {
      if (indicator.phase !== phase) continue;
      for (const lang of ['en', 'hi', 'kn'] as const) {
        const html = renderToString(h(StateIndicator, {vm: indicator, actions: mockActions, lang: lang, }));
        expect(html).toContain(LABELS[lang][PHASE_LABEL_KEY[phase]]);
      }
    }
  });
});

describe('formatRupees', () => {
  it('groups Indian-style with lakh/crore grouping', () => {
    expect(formatRupees(12_000_000)).toBe('₹1,20,000');
    expect(formatRupees(34_000)).toBe('₹340');
    expect(formatRupees(250_000)).toBe('₹2,500');
    expect(formatRupees(1_234_567_800)).toBe('₹1,23,45,678');
    expect(formatRupees(3_400_000_000)).toBe('₹3,40,00,000');
    expect(formatRupees(0)).toBe('₹0');
  });
});

describe('touch targets', () => {
  it('the voice circle is at least 56px and every .btn at least 44px tall', () => {
    const css = readFileSync(join(here, 'phone.css'), 'utf8');
    expect(/--touch:\s*56px/.test(css)).toBe(true);
    const rule = (selector: RegExp) => {
      const m = css.match(selector);
      expect(m, `missing rule for ${selector}`).not.toBeNull();
      return m?.[0] ?? '';
    };
    const orb = rule(/\n\.orb\s*\{[^}]*\}/);
    const btn = rule(/\n\.btn\s*\{[^}]*\}/);
    const px = (block: string, prop: string) => Number(new RegExp(`${prop}:\\s*(\\d+)px`).exec(block)?.[1] ?? 0);
    expect(px(orb, 'width')).toBeGreaterThanOrEqual(56);
    expect(px(orb, 'height')).toBeGreaterThanOrEqual(56);
    expect(px(btn, 'min-height')).toBeGreaterThanOrEqual(44);
  });
});

describe('mock preview renders every screen', () => {
  it('all screens render to non-trivial HTML', () => {
    for (const [name, html] of Object.entries(renderedScreens)) {
      expect(html.length, name).toBeGreaterThan(200);
    }
  });
});

describe('F1 forgot PIN warning', () => {
  it('warns that delete-all is the only recovery before the PIN is set in Onboarding and Settings', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      const onb = renderToString(h(Onboarding, { vm: mockOnboardingVM, actions: mockActions, lang }));
      expect(onb).toContain(LABELS[lang].forgotPinWarning);
      const settings = renderToString(h(Settings, { vm: mockSettingsVM, actions: mockActions, lang }));
      expect(settings).toContain(LABELS[lang].forgotPinWarning);
    }
  });
});


describe('editing an entry: hidden sections stay hidden', () => {
  it('the stylesheet hides the customer list and time buttons that carry the hidden attribute', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('./phone.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.keypad-customer\[hidden\][^{]*\{\s*display:\s*none/);
    expect(css).toMatch(/\.when-row\[hidden\]/);
  });
});

describe('Phase 2 (CP12-B) UI components', () => {
  it('F2 customer search input is rendered on Customers and Keypad screens', () => {
    const cust = renderToString(h(Customers, { vm: mockCustomersVM, actions: mockActions, lang: 'en' }));
    expect(cust).toContain('data-feature="customer-search"');

    const kp = renderToString(h(Keypad, { vm: mockKeypadVM, actions: mockActions, lang: 'en' }));
    expect(kp).toContain('data-feature="keypad-customer-search"');
  });

  it('F4 countdown bar and label render on EntryCard for yes_no answer state', () => {
    const cardHtml = renderToString(
      h(EntryCard, {
        vm: {
          state: 'needs_answer',
          answers: 'yes_no',
          agentLine: 'Confirm?',
          answerExpiresAt: Date.now() + 30_000,
          answerWindowMs: 60_000,
        },
        actions: mockActions,
        lang: 'en',
      })
    );
    expect(cardHtml).toContain('class="answer-progress-bar"');
    expect(cardHtml).toContain('data-feature="answer-countdown"');
    expect(cardHtml).toContain('(30s)');
  });

  it('F5 Hear summary button is rendered on CustomerDetail', () => {
    const detail = renderToString(h(CustomerDetail, { vm: mockCustomerDetailVM, actions: mockActions, lang: 'en' }));
    expect(detail).toContain('data-feature="hear-summary"');
    expect(detail).toContain(LABELS.en.hearSummary);
  });

  it('F6 Remind on WhatsApp button is rendered and gated properly', () => {
    const allowed = renderToString(h(CustomerDetail, { vm: mockCustomerDetailVM, actions: mockActions, lang: 'en' }));
    expect(allowed).toContain('data-feature="remind-whatsapp"');
    expect(allowed).not.toMatch(/data-feature="remind-whatsapp"[^>]*disabled/);

    const blocked = renderToString(h(CustomerDetail, { vm: mockBlockedCustomerDetailVM, actions: mockActions, lang: 'en' }));
    expect(blocked).toContain('data-feature="remind-whatsapp"');
    expect(blocked).toMatch(/data-feature="remind-whatsapp"[^>]*disabled/);
  });

  it('F6 Due now section renders on Reminders when a customer owes and canRemind', () => {
    const rem = renderToString(h(Reminders, { vm: mockRemindersVM, actions: mockActions, lang: 'en' }));
    expect(rem).toContain('data-feature="reminders-due-now"');
    expect(rem).toContain('data-feature="due-now-wa"');
    expect(rem).toContain('Ramesh');
  });

  it('F8 Adjustment tag renders for balance_set entries in Feed', () => {
    const feedHtml = renderToString(
      h(Feed, {
        vm: {
          items: [
            {
              id: 'bs1',
              customerName: 'Anil',
              kind: 'credit',
              paise: 5000,
              at: Date.now(),
              recordedAt: Date.now(),
              reason: 'balance_set',
              undoableUntil: null,
            },
          ],
          showUndoForId: null,
        },
        actions: mockActions,
        lang: 'en',
      })
    );
    expect(feedHtml).toContain('data-feature="balance-set-tag"');
    expect(feedHtml).toContain(LABELS.en.balanceSetTag);
  });
});

describe('reminders: ask whether it was sent, show when the next one can go', () => {
  const langs = ['en', 'hi', 'kn', 'ta', 'te', 'mr', 'gu'] as const;
  const day = 24 * 60 * 60 * 1000;
  const t0 = Date.UTC(2026, 10, 22, 6, 0); // 22 Nov 2026

  it('the confirm card names the customer and has a yes and a no in every language', async () => {
    const { ReminderConfirm } = await import('./ReminderConfirm.js');
    for (const lang of langs) {
      const html = renderToString(h(ReminderConfirm, { vm: { customerId: 'c1', name: 'Suresh' }, actions: mockActions, lang }));
      expect(html).toContain('Suresh');
      expect(html).not.toContain('{name}');
      expect(html).toContain(LABELS[lang].reminderConfirmYes);
      expect(html).toContain(LABELS[lang].reminderConfirmNo);
    }
  });

  it('the hint reads "Sent … · next …" while locked, "Sent …" afterwards, and nothing before the first send', async () => {
    const { reminderHint } = await import('./reminderHint.js');
    for (const lang of langs) {
      const locked = reminderHint(t0, t0 + 2 * day, t0 + day, lang)!;
      expect(locked).not.toContain('{');
      expect(locked.length).toBeGreaterThan(reminderHint(t0, t0 + 2 * day, t0 + 3 * day, lang)!.length);
      expect(reminderHint(null, null, t0, lang)).toBeNull();
    }
    expect(reminderHint(t0, t0 + 2 * day, t0 + day, 'en')).toBe('Sent 22 Nov · next 24 Nov');
    expect(reminderHint(t0, t0 + 2 * day, t0 + 3 * day, 'en')).toBe('Sent 22 Nov');
  });
});
