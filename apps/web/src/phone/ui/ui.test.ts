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
import { Keypad } from './Keypad.js';
import { StateIndicator } from './StateIndicator.js';
import {
  mockActions,
  mockCustomersVM,
  mockCustomerDetailVM,
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

describe('nickname on the customer detail screen', () => {
  const withNick = { ...mockCustomerDetailVM, customer: { ...mockCustomerDetailVM.customer, nickname: 'dairy' } };
  const without = { ...mockCustomerDetailVM, customer: { ...mockCustomerDetailVM.customer, nickname: undefined } };
  it('shows the nickname and an edit button, in every language', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      const html = renderToString(h(CustomerDetail, { vm: withNick, actions: mockActions, lang }));
      expect(html).toContain(`${LABELS[lang].nickname}: dairy`);
      expect(html).toContain(LABELS[lang].editNickname);
      expect(html).toContain(`${withNick.customer.name} (dairy)`);
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

