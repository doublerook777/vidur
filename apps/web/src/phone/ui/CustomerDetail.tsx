import type { CustomerDetailVM } from '../contract.js';
import { formatRupees } from './format.js';
import { LABELS } from './labels.js';
import { IconArrowDown, IconArrowUp, IconBack, IconPlus, IconReminders } from './icons.js';
import { EntryRow } from './Feed.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';
import { BottomNav } from './BottomNav.js';

export function CustomerDetail({ vm, actions, lang, now = Date.now() }: ScreenProps<CustomerDetailVM> & { now?: number }) {
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
        <div class="detail-section-head">
          <h2 class="detail-section-title">{t.entriesTitle}</h2>
          <button type="button" class="btn btn-small" data-feature="add-entry" onClick={() => actions.openAddEntry({ customerId: vm.customer.id })}>
            <IconPlus size={18} />
            <span>{t.addForCustomer}</span>
          </button>
        </div>
        {vm.entries.length === 0 ? (
          <p class="detail-empty">{t.entriesEmpty}</p>
        ) : (
          <ul class="detail-entry-list feed-list">
            {vm.entries.map((e) => (
              <EntryRow
                key={e.id}
                item={{ id: e.id, customerName: vm.customer.name, kind: e.kind, paise: e.paise, at: e.at, recordedAt: e.recordedAt, undoableUntil: e.undoableUntil }}
                undoable={e.undoableUntil !== null && e.undoableUntil > now}
                now={now}
                lang={lang}
                actions={actions}
              />
            ))}
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
