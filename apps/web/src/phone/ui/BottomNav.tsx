import type { ComponentChildren, ComponentType } from 'preact';

import type { Screen } from '../contract.js';
import type { ScreenProps } from './types.js';
import { LABELS, type LabelKey } from './labels.js';
import { IconCustomers, IconHome, IconReminders, IconSettings } from './icons.js';

export interface BottomNavVM {
  current: Screen;
}

const TABS: { screen: Screen; key: LabelKey; Icon: ComponentType<{ size?: number }> }[] = [
  { screen: 'home', key: 'navHome', Icon: IconHome },
  { screen: 'customers', key: 'navCustomers', Icon: IconCustomers },
  { screen: 'reminders', key: 'navReminders', Icon: IconReminders },
  { screen: 'settings', key: 'navSettings', Icon: IconSettings },
];

/**
 * The floating pill. On Home a voice circle (`orb`) sits in the middle and rises out of the top of the pill.
 * The active tab opens into a pill with its name; the others are just icons with a hidden name.
 */
export function BottomNav({ vm, actions, lang, orb }: ScreenProps<BottomNavVM> & { orb?: ComponentChildren }) {
  const t = LABELS[lang];
  const current = vm.current === 'history' || vm.current === 'keypad' ? 'home' : vm.current === 'customer' ? 'customers' : vm.current;
  const tabs = TABS.map(({ screen, key, Icon }) => (
    <button
      key={screen}
      type="button"
      class={`bottom-nav-btn${current === screen ? ' bottom-nav-btn-active' : ''}`}
      aria-current={current === screen ? 'page' : undefined}
      aria-label={t[key]}
      onClick={() => actions.navigate(screen)}
    >
      <Icon size={22} />
      <span class="bottom-nav-label">{t[key]}</span>
    </button>
  ));
  return (
    <>
      <div class="nav-scrim" aria-hidden="true" />
      <nav class={`bottom-nav${orb ? ' bottom-nav-with-orb' : ''}`} aria-label="Screens">
        <div class="bottom-nav-side">{tabs.slice(0, 2)}</div>
        {orb ? <div class="bottom-nav-orb">{orb}</div> : null}
        <div class="bottom-nav-side">{tabs.slice(2)}</div>
      </nav>
    </>
  );
}
