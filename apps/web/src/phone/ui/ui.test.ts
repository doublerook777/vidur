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
  mockOnboardingVM,
  mockRemindersVM,
  mockSettingsVM,
  mockStateIndicatorVMs,
} from './preview.js';

const here = dirname(fileURLToPath(import.meta.url));

const renderedScreens: Record<string, string> = {
  home: renderToString(h(Home, {vm: mockHomeVM, actions: mockActions, lang: 'hi', })),
  homeOffline: renderToString(h(Home, {vm: mockOfflineHomeVM, actions: mockActions, lang: 'hi', })),
  customers: renderToString(h(Customers, {vm: mockCustomersVM, actions: mockActions, lang: 'hi', })),
  customerDetail: renderToString(h(CustomerDetail, {vm: mockCustomerDetailVM, actions: mockActions, lang: 'hi', })),
  reminders: renderToString(h(Reminders, {vm: mockRemindersVM, actions: mockActions, lang: 'hi', })),
  settings: renderToString(h(Settings, {vm: mockSettingsVM, actions: mockActions, lang: 'hi', })),
  onboarding: renderToString(h(Onboarding, {vm: mockOnboardingVM, actions: mockActions, lang: 'hi', })),
  keypad: renderToString(h(Keypad, {vm: mockKeypadVM, actions: mockActions, lang: 'hi', })),
};

const allRendered = Object.values(renderedScreens).join('\n');

describe('FEATURE_IDS coverage', () => {
  it.each(FEATURE_IDS.map((id) => [id] as const))('data-feature="%s" appears in some screen', (id) => {
    expect(allRendered).toContain(`data-feature="${id}"`);
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
  it('.mic and .btn declare a min size of at least 56px', () => {
    const css = readFileSync(join(here, 'phone.css'), 'utf8');
    const touchVar = /--touch:\s*56px/.test(css);
    expect(touchVar).toBe(true);

    const rule = (selector: RegExp) => {
      const m = css.match(selector);
      expect(m, `missing rule for ${selector}`).not.toBeNull();
      return m?.[0] ?? '';
    };

    const micRule = rule(/\.mic\s*\{[^}]*\}/);
    const btnRule = rule(/\.btn\s*\{[^}]*\}/);

    const minSize = (block: string) => {
      const minHeight = /min-height:\s*(var\(--touch\)|\d+px)/.exec(block)?.[1];
      const minWidth = /min-width:\s*(var\(--touch\)|\d+px)/.exec(block)?.[1];
      return { minHeight, minWidth };
    };

    const mic = minSize(micRule);
    const btn = minSize(btnRule);
    expect(mic.minHeight).toBe('var(--touch)');
    expect(btn.minHeight).toBe('var(--touch)');
    expect(btn.minWidth).toBe('var(--touch)');
  });
});

describe('mock preview renders every screen', () => {
  it('all screens render to non-trivial HTML', () => {
    for (const [name, html] of Object.entries(renderedScreens)) {
      expect(html.length, name).toBeGreaterThan(200);
    }
  });
});

