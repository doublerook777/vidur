import { useState } from 'preact/hooks';
import { nameKey } from '@vidur/core';

import type { CustomerDetailVM } from '../contract.js';
import { customerLabel, formatRupees } from './format.js';
import { LABELS } from './labels.js';
import { IconArrowDown, IconArrowUp, IconBack, IconPlus, IconReminders } from './icons.js';
import { EntryRow } from './Feed.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';
import { BottomNav } from './BottomNav.js';
import { reminderHint } from './reminderHint.js';

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

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(vm.customer.nickname ?? '');
  const trimmed = draft.trim();
  const taken = trimmed !== '' && (vm.takenNicknames ?? []).some((n) => nameKey(n) === nameKey(trimmed));
  const saveNickname = (): void => {
    if (taken) return;
    // An empty string clears the nickname.
    actions.updateCustomer(vm.customer.id, { nickname: trimmed });
    setEditing(false);
  };

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(vm.customer.name);
  const newName = nameDraft.trim();
  const namesakes = newName === '' ? [] : (vm.otherCustomers ?? []).filter((o) => nameKey(o.name) === nameKey(newName));
  // Two customers may share a name, but never the same name and the same nickname: the voice could not tell them apart.
  const myNick = vm.customer.nickname ?? '';
  const sameBoth = namesakes.some((o) => nameKey(o.nickname ?? '') === nameKey(myNick) && (myNick !== '' || (o.nickname ?? '') !== ''));
  const canRename = newName !== '' && !sameBoth;
  const saveName = (): void => {
    if (!canRename) return;
    if (newName !== vm.customer.name) actions.updateCustomer(vm.customer.id, { name: newName });
    setRenaming(false);
  };

  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState(vm.customer.phone ?? '');
  const [phoneError, setPhoneError] = useState(false);

  const savePhone = (): void => {
    const raw = phoneDraft.trim();
    if (!raw) {
      actions.updateCustomer(vm.customer.id, { phone: '' });
      setEditingPhone(false);
      setPhoneError(false);
      return;
    }
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      setPhoneError(true);
      return;
    }
    actions.updateCustomer(vm.customer.id, { phone: digits });
    setEditingPhone(false);
    setPhoneError(false);
  };

  return (
    <main class="screen screen-customer-detail" data-feature="customer-detail">
      <header class="screen-header">
        <button type="button" class="icon-btn" aria-label="Back" onClick={() => actions.navigate('customers')}>
          <IconBack size={24} />
        </button>
        <h1 class="screen-title">{customerLabel(vm.customer, lang)}</h1>
        <AiBadge vm={{}} actions={actions} lang={lang} />
      </header>

      <section class="detail-nickname" aria-label={t.nameLabel}>
        {renaming ? (
          <>
            <label class="keypad-new-name-label">
              <span class="keypad-new-name-title">{t.nameLabel}</span>
              <input
                type="text"
                class="keypad-new-name detail-name-input"
                value={nameDraft}
                onInput={(e) => setNameDraft((e.target as HTMLInputElement).value)}
                autocomplete="off"
                autoFocus
              />
            </label>
            {namesakes.length > 0 && !sameBoth && myNick === '' && <p class="keypad-hint" role="note">{t.nicknameHint}</p>}
            {sameBoth && <p class="keypad-hint" role="alert">{t.nicknameTaken}</p>}
            <div class="detail-nickname-actions">
              <button type="button" class="btn btn-small detail-name-save" disabled={!canRename} onClick={saveName}>
                {t.save}
              </button>
              <button
                type="button"
                class="btn btn-small"
                onClick={() => {
                  setNameDraft(vm.customer.name);
                  setRenaming(false);
                }}
              >
                {t.cancelEdit}
              </button>
            </div>
          </>
        ) : (
          <div class="detail-nickname-row">
            <span class="detail-nickname-value">{`${t.nameLabel}: ${vm.customer.name}`}</span>
            <button
              type="button"
              class="btn btn-small detail-name-edit"
              onClick={() => {
                setNameDraft(vm.customer.name);
                setRenaming(true);
              }}
            >
              {t.editName}
            </button>
          </div>
        )}
      </section>

      <section class="detail-nickname" aria-label={t.nickname}>
        {editing ? (
          <>
            <label class="keypad-new-name-label">
              <span class="keypad-new-name-title">{t.nickname}</span>
              <input
                type="text"
                class="keypad-new-name detail-nickname-input"
                value={draft}
                onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
                autocomplete="off"
                autoFocus
              />
            </label>
            {taken && <p class="keypad-hint" role="alert">{t.nicknameTaken}</p>}
            <div class="detail-nickname-actions">
              <button type="button" class="btn btn-small detail-nickname-save" disabled={taken} onClick={saveNickname}>
                {t.save}
              </button>
              <button
                type="button"
                class="btn btn-small"
                onClick={() => {
                  setDraft(vm.customer.nickname ?? '');
                  setEditing(false);
                }}
              >
                {t.cancelEdit}
              </button>
            </div>
          </>
        ) : (
          <div class="detail-nickname-row">
            <span class="detail-nickname-value">{vm.customer.nickname ? `${t.nickname}: ${vm.customer.nickname}` : t.noNickname}</span>
            <button
              type="button"
              class="btn btn-small detail-nickname-edit"
              onClick={() => {
                setDraft(vm.customer.nickname ?? '');
                setEditing(true);
              }}
            >
              {t.editNickname}
            </button>
          </div>
        )}
      </section>

      <section class="detail-nickname" aria-label={t.phoneLabel}>
        {editingPhone ? (
          <>
            <label class="keypad-new-name-label">
              <span class="keypad-new-name-title">{t.phoneLabel}</span>
              <input
                type="text"
                inputMode="numeric"
                class="keypad-new-name detail-phone-input"
                data-feature="phone-input"
                value={phoneDraft}
                onInput={(e) => {
                  setPhoneDraft((e.target as HTMLInputElement).value);
                  setPhoneError(false);
                }}
                autocomplete="tel"
                autoFocus
              />
            </label>
            {phoneError && <p class="keypad-hint" role="alert">{t.invalidPhone}</p>}
            <div class="detail-nickname-actions">
              <button type="button" class="btn btn-small detail-phone-save" onClick={savePhone}>
                {t.save}
              </button>
              <button
                type="button"
                class="btn btn-small"
                onClick={() => {
                  setPhoneDraft(vm.customer.phone ?? '');
                  setEditingPhone(false);
                  setPhoneError(false);
                }}
              >
                {t.cancelEdit}
              </button>
            </div>
          </>
        ) : (
          <div class="detail-nickname-row">
            <span class="detail-nickname-value">{vm.customer.phone ? `${t.phoneLabel}: ${vm.customer.phone}` : `${t.phoneLabel}: —`}</span>
            <button
              type="button"
              class="btn btn-small detail-phone-edit"
              data-feature="edit-phone"
              onClick={() => {
                setPhoneDraft(vm.customer.phone ?? '');
                setEditingPhone(true);
              }}
            >
              {t.editPhone}
            </button>
          </div>
        )}
      </section>

      <section class="balance-card" aria-label={t.balanceDue}>
        <span class="balance-label">{t.balanceDue}</span>
        <span class="balance-value" data-feature="balance">
          {formatRupees(Math.abs(vm.customer.balancePaise))}
        </span>
        <span class="balance-direction">
          <DirectionIcon size={20} />
          <span class="balance-direction-word">{directionWord}</span>
        </span>
        <button
          type="button"
          class="btn btn-hear-summary"
          data-feature="hear-summary"
          onClick={() => actions.speakSummary(vm.customer.id)}
        >
          <span>{t.hearSummary}</span>
        </button>
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
                item={{ id: e.id, customerName: vm.customer.name, kind: e.kind, paise: e.paise, at: e.at, recordedAt: e.recordedAt, reason: e.reason, undoableUntil: e.undoableUntil }}
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
        <div class="reminder-buttons-row">
          <button
            type="button"
            class="btn btn-remind btn-remind-wa"
            data-feature="remind-whatsapp"
            disabled={!vm.canRemind}
            onClick={() => actions.remindOnWhatsApp(vm.customer.id)}
          >
            <IconReminders size={22} />
            <span>{t.remindWhatsApp}</span>
          </button>
          <button
            type="button"
            class="btn btn-remind btn-remind-share"
            data-feature="remind-share"
            disabled={!vm.canRemind}
            onClick={() => actions.prepareReminder(vm.customer.id)}
          >
            <span>{t.remind}</span>
          </button>
        </div>
        {blockedReason && <p class="detail-reminder-blocked">{blockedReason}</p>}
        {reminderHint(vm.customer.lastReminderAt, vm.customer.nextReminderAt, Date.now(), lang) && (
          <p class="reminder-sent-hint" data-feature="reminder-sent-hint">{reminderHint(vm.customer.lastReminderAt, vm.customer.nextReminderAt, Date.now(), lang)}</p>
        )}
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
