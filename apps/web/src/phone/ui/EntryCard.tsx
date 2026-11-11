import type { EntryCardVM } from '../contract.js';
import { formatRupees } from './format.js';
import { LABELS } from './labels.js';
import type { ScreenProps } from './types.js';

export function EntryCard({ vm, lang }: ScreenProps<EntryCardVM>) {
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
      {vm.state === 'needs_answer' && (
        <div class="entry-disambiguation" data-feature="disambiguation">
          <p class="entry-question-title">{t.disambiguation}</p>
          {vm.customerName ? <p class="entry-question-name">{vm.customerName}</p> : null}
        </div>
      )}
      {(vm.state === 'heard' || vm.state === 'needs_answer') && (
        <p class="entry-is-this-right">{t.isThisRight}</p>
      )}
    </section>
  );
}
