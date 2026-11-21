import type { Actions, Lang, ReminderConfirmVM } from '../contract.js';
import { LABELS } from './labels.js';
import { IconCheck, IconX } from './icons.js';

/**
 * Shown after a reminder was handed to WhatsApp or copied. WhatsApp cannot tell us whether the message was sent, so
 * the shopkeeper does. Only "yes" records the reminder (the 2-day lock); "no" leaves the customer free to remind again.
 */
export function ReminderConfirm({ vm, actions, lang }: { vm: ReminderConfirmVM; actions: Actions; lang: Lang }) {
  const t = LABELS[lang];
  return (
    <div class="reminder-confirm" role="alertdialog" aria-live="polite" aria-label={t.reminderConfirmAsk.replace('{name}', vm.name)} data-feature="reminder-confirm">
      <p class="reminder-confirm-text">{t.reminderConfirmAsk.replace('{name}', vm.name)}</p>
      <div class="reminder-confirm-row">
        <button type="button" class="btn btn-primary reminder-confirm-yes" data-feature="reminder-confirm-yes" onClick={() => actions.confirmReminderSent(vm.customerId)}>
          <IconCheck size={18} />
          <span>{t.reminderConfirmYes}</span>
        </button>
        <button type="button" class="btn reminder-confirm-no" data-feature="reminder-confirm-no" onClick={() => actions.dismissReminderConfirm()}>
          <IconX size={18} />
          <span>{t.reminderConfirmNo}</span>
        </button>
      </div>
    </div>
  );
}
