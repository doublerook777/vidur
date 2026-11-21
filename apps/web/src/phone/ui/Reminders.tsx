import type { CustomerRow } from '../contract.js';
import { customerLabel, formatRupees } from './format.js';
import { LABELS } from './labels.js';
import { IconReminders } from './icons.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';
import { BottomNav } from './BottomNav.js';
import { reminderHint } from './reminderHint.js';

export interface RemindersVM {
  customers: CustomerRow[];
}

export function Reminders({ vm, actions, lang }: ScreenProps<RemindersVM>) {
  const t = LABELS[lang];
  const dueNowCustomers = vm.customers.filter((c) => c.canRemind && c.balancePaise > 0);

  return (
    <main class="screen screen-reminders">
      <header class="screen-header">
        <h1 class="screen-title">{t.remindersTitle}</h1>
        <AiBadge vm={{}} actions={actions} lang={lang} />
      </header>

      {dueNowCustomers.length > 0 && (
        <section class="reminders-due-now" data-feature="reminders-due-now" aria-label={t.dueNow}>
          <h2 class="due-now-title">{t.dueNow}</h2>
          <ul class="due-now-list">
            {dueNowCustomers.map((c) => (
              <li key={c.id} class="due-now-item">
                <span class="due-now-info">
                  <span class="due-now-name">{customerLabel(c, lang)}</span>
                  <span class="due-now-balance">{formatRupees(c.balancePaise)}</span>
                </span>
                <button
                  type="button"
                  class="btn btn-small btn-due-now-wa"
                  data-feature="due-now-wa"
                  aria-label={`${t.remindWhatsApp} — ${c.name}`}
                  onClick={() => actions.remindOnWhatsApp(c.id)}
                >
                  <IconReminders size={16} />
                  <span>{t.remindWhatsApp}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul class="reminder-list" aria-label={t.remindersTitle}>
        {vm.customers.map((c) => (
          <li key={c.id} class="reminder-row" data-feature="reminder-gate">
            <span class="reminder-info">
              <span class="reminder-name">{customerLabel(c, lang)}</span>
              <span class="reminder-balance">{formatRupees(Math.abs(c.balancePaise))}</span>
              {reminderHint(c.lastReminderAt, c.nextReminderAt, Date.now(), lang) && (
                <span class="reminder-sent-hint" data-feature="reminder-sent-hint">{reminderHint(c.lastReminderAt, c.nextReminderAt, Date.now(), lang)}</span>
              )}
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
                class="icon-btn btn-reminder-wa"
                data-feature="remind-whatsapp-row"
                aria-label={`${t.remindWhatsApp} — ${c.name}`}
                disabled={!c.canRemind}
                onClick={() => actions.remindOnWhatsApp(c.id)}
              >
                <IconReminders size={20} />
              </button>
              <button
                type="button"
                class="icon-btn btn-reminder-send"
                aria-label={`${t.remind} — ${c.name}`}
                disabled={!c.canRemind}
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
