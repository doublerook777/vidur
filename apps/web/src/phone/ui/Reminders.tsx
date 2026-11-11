import type { CustomerRow } from '../contract.js';
import { formatRupees } from './format.js';
import { LABELS } from './labels.js';
import { IconReminders } from './icons.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';
import { BottomNav } from './BottomNav.js';

export interface RemindersVM {
  customers: CustomerRow[];
}

export function Reminders({ vm, actions, lang }: ScreenProps<RemindersVM>) {
  const t = LABELS[lang];
  return (
    <main class="screen screen-reminders">
      <header class="screen-header">
        <h1 class="screen-title">{t.remindersTitle}</h1>
        <AiBadge vm={{}} actions={actions} lang={lang} />
      </header>

      <ul class="reminder-list" aria-label={t.remindersTitle}>
        {vm.customers.map((c) => (
          <li key={c.id} class="reminder-row" data-feature="reminder-gate">
            <span class="reminder-info">
              <span class="reminder-name">{c.name}</span>
              <span class="reminder-balance">{formatRupees(Math.abs(c.balancePaise))}</span>
            </span>
            <span class="reminder-actions">
              <button
                type="button"
                role="switch"
                aria-checked={c.reminderOptIn}
                aria-label={`${t.reminderOptIn} — ${c.name}`}
                class={`toggle${c.reminderOptIn ? ' toggle-on' : ''}`}
                data-feature="consent-toggle"
                onClick={() => actions.setConsent(c.id, !c.reminderOptIn)}
              >
                <span class="toggle-knob" />
              </button>
              <button
                type="button"
                class="icon-btn btn-reminder-send"
                aria-label={`${t.remind} — ${c.name}`}
                disabled={!c.reminderOptIn}
                onClick={() => actions.prepareReminder(c.id)}
              >
                <IconReminders size={24} />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <BottomNav vm={{ current: 'reminders' }} actions={actions} lang={lang} />
    </main>
  );
}
