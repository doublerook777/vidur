import type { ComponentType } from 'preact';

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

export function BottomNav({ vm, actions, lang }: ScreenProps<BottomNavVM>) {
  const t = LABELS[lang];
  return (
    <nav class="bottom-nav" aria-label="Screens">
      {TABS.map(({ screen, key, Icon }) => (
        <button
          key={screen}
          type="button"
          class={`bottom-nav-btn${vm.current === screen ? ' bottom-nav-btn-active' : ''}`}
          aria-current={vm.current === screen ? 'page' : undefined}
          onClick={() => actions.navigate(screen)}
        >
          <Icon size={24} />
          <span class="bottom-nav-label">{t[key]}</span>
        </button>
      ))}
    </nav>
  );
}
