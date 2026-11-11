import type { EntryCardVM } from '../contract.js';
import { formatRupees } from './format.js';
import { LABELS } from './labels.js';
import { IconCheck, IconX } from './icons.js';
import type { ScreenProps } from './types.js';

export function EntryCard({ vm, actions, lang }: ScreenProps<EntryCardVM>) {
  const t = LABELS[lang];
  return (
    <section class={`entry-card entry-card-${vm.state}`} data-feature="entry-card" aria-live="polite">
      {vm.heard && (
        <p class="entry-heard">
          <span class="entry-heard-label">{t.aiHeard}</span>
          <span class="entry-heard-text">{vm.heard}</span>
        </p>
      )}
      {vm.agentLine && (
        <p class="entry-agent-line">
          <span class="entry-agent-label">{vm.state === 'needs_answer' ? t.aiQuestion : ''}</span> {vm.agentLine}
        </p>
      )}
      {vm.paise !== undefined && (
        <p class="entry-amount" data-feature="confirm-amount">
          <span class="entry-amount-label">{t.confirmAmount}</span>{' '}
          <span class="entry-amount-value">{formatRupees(vm.paise)}</span>
        </p>
      )}
      {vm.state === 'needs_answer' && vm.answers !== 'yes_no' && (
        <div class="entry-disambiguation" data-feature="disambiguation">
          <p class="entry-question-title">{t.disambiguation}</p>
          {vm.customerName ? <p class="entry-question-name">{vm.customerName}</p> : null}
        </div>
      )}
      {vm.state === 'needs_answer' && vm.answers === 'yes_no' && (
        <div class="answer-row" data-feature="answer-buttons" role="group" aria-label={t.aiQuestion}>
          <button type="button" class="btn answer-btn answer-yes" onClick={() => actions.answer('yes')}>
            <IconCheck size={20} />
            <span>{t.answerYes}</span>
          </button>
          <button type="button" class="btn answer-btn answer-no" onClick={() => actions.answer('no')}>
            <IconX size={20} />
            <span>{t.answerNo}</span>
          </button>
        </div>
      )}
      {vm.heard && vm.state === 'heard' && (
        <p class="entry-is-this-right">{t.isThisRight}</p>
      )}
      {vm.state === 'needs_answer' && (
        <button type="button" class="btn btn-cancel-input" data-feature="cancel-input" onClick={() => actions.cancelAnswer()}>
          <IconX size={18} />
          <span>{t.cancelInput}</span>
        </button>
      )}
      {vm.noteCustomerId && (
        <button type="button" class="btn btn-view-notes" onClick={() => actions.openCustomer(vm.noteCustomerId!)}>
          {t.viewNotes}
        </button>
      )}
    </section>
  );
}
