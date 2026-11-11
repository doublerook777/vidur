import type { CustomerDetailVM } from '../contract.js';
import { formatRupees } from './format.js';
import { LABELS } from './labels.js';
import { IconArrowDown, IconArrowUp, IconBack, IconReminders } from './icons.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';
import { BottomNav } from './BottomNav.js';

export function CustomerDetail({ vm, actions, lang }: ScreenProps<CustomerDetailVM>) {
  const t = LABELS[lang];
  const owed = vm.customer.balancePaise >= 0;
  const DirectionIcon = owed ? IconArrowUp : IconArrowDown;
  const directionWord = owed ? t.credit : t.payment;

  const blockedReason =
    vm.reminderBlockedReason === 'no_consent'
      ? t.reminderNoConsent
      : vm.reminderBlockedReason === 'too_soon'
        ? t.reminderTooSoon
        : vm.reminderBlockedReason === 'nothing_due'
          ? t.reminderNothingDue
          : null;

  return (
    <main class="screen screen-customer-detail" data-feature="customer-detail">
      <header class="screen-header">
        <button type="button" class="icon-btn" aria-label="Back" onClick={() => actions.navigate('customers')}>
          <IconBack size={24} />
        </button>
        <h1 class="screen-title">{vm.customer.name}</h1>
        <AiBadge vm={{}} actions={actions} lang={lang} />
      </header>

      <section class="balance-card" aria-label={t.balanceDue}>
        <span class="balance-label">{t.balanceDue}</span>
        <span class="balance-value" data-feature="balance">
          {formatRupees(Math.abs(vm.customer.balancePaise))}
        </span>
        <span class="balance-direction">
          <DirectionIcon size={20} />
          <span class="balance-direction-word">{directionWord}</span>
        </span>
      </section>

      <section class="detail-entries" aria-label={t.entriesTitle}>
        <h2 class="detail-section-title">{t.entriesTitle}</h2>
        {vm.entries.length === 0 ? (
          <p class="detail-empty">{t.entriesEmpty}</p>
        ) : (
          <ul class="detail-entry-list">
            {vm.entries.map((e) => {
              const EntryIcon = e.kind === 'credit' ? IconArrowUp : IconArrowDown;
              const word = e.kind === 'credit' ? t.credit : t.payment;
              return (
                <li key={e.id} class={`detail-entry detail-entry-${e.kind}`}>
                  <span class="detail-entry-icon" aria-hidden="true">
                    <EntryIcon size={20} />
                  </span>
                  <span class="detail-entry-word">{word}</span>
                  <span class="detail-entry-amount">{formatRupees(e.paise)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section class="detail-notes" aria-label={t.notesTitle}>
        <h2 class="detail-section-title">{t.notesTitle}</h2>
        {vm.notes.length === 0 ? (
          <p class="detail-empty">{t.noNotes}</p>
        ) : (
          <ul class="detail-note-list">
            {vm.notes.map((n) => (
              <li key={n.id} class="detail-note">
                <span class="detail-note-text">{n.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="detail-reminder" data-feature="reminder-gate" aria-label={t.remind}>
        <button
          type="button"
          class="btn btn-remind"
          disabled={!vm.canRemind}
          onClick={() => actions.prepareReminder(vm.customer.id)}
        >
          <IconReminders size={22} />
          <span>{t.remind}</span>
        </button>
        {blockedReason && <p class="detail-reminder-blocked">{blockedReason}</p>}
        <label class="consent-row">
          <span class="consent-label">{t.reminderOptIn}</span>
          <button
            type="button"
            role="switch"
            aria-checked={vm.customer.reminderOptIn}
            class={`toggle${vm.customer.reminderOptIn ? ' toggle-on' : ''}`}
            data-feature="consent-toggle"
            onClick={() => actions.setConsent(vm.customer.id, !vm.customer.reminderOptIn)}
          >
            <span class="toggle-knob" />
          </button>
        </label>
      </section>

      <BottomNav vm={{ current: 'customer' }} actions={actions} lang={lang} />
    </main>
  );
}
