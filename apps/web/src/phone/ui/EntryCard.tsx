import { useEffect, useState } from 'preact/hooks';
import type { EntryCardVM } from '../contract.js';
import { formatRupees } from './format.js';
import { LABELS } from './labels.js';
import { IconCheck, IconX } from './icons.js';
import type { ScreenProps } from './types.js';

export function EntryCard({ vm, actions, lang }: ScreenProps<EntryCardVM>) {
  const t = LABELS[lang];
  const initialLeftMs = vm.answerExpiresAt && vm.answerWindowMs ? Math.max(0, vm.answerExpiresAt - Date.now()) : null;
  const initialSec = initialLeftMs !== null ? Math.ceil(initialLeftMs / 1000) : null;
  const initialPercent = initialLeftMs !== null && vm.answerWindowMs ? Math.min(100, Math.max(0, Math.round((initialLeftMs / vm.answerWindowMs) * 100))) : null;

  const [remainingSec, setRemainingSec] = useState<number | null>(initialSec);
  const [percent, setPercent] = useState<number | null>(initialPercent);

  useEffect(() => {
    if (!vm.answerExpiresAt || !vm.answerWindowMs) {
      setRemainingSec(null);
      setPercent(null);
      return;
    }
    const tick = () => {
      const now = Date.now();
      const leftMs = Math.max(0, vm.answerExpiresAt! - now);
      const sec = Math.ceil(leftMs / 1000);
      setRemainingSec(sec);
      setPercent(Math.min(100, Math.max(0, Math.round((leftMs / vm.answerWindowMs!) * 100))));
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [vm.answerExpiresAt, vm.answerWindowMs]);
  return (
    <section class={`entry-card entry-card-${vm.state}`} data-feature="entry-card" aria-live="polite">
      {vm.state === 'listening' && (
        <div class="entry-listening" data-feature="listening-card">
          <p class="entry-listening-text">{t.listeningHint}</p>
          {vm.countdownSec !== undefined && (
            <p class="entry-countdown" data-feature="press-countdown">
              <span class="countdown-badge">{vm.countdownSec}s</span>
            </p>
          )}
        </div>
      )}
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
        <div class="answer-wrapper" data-feature="answer-buttons">
          {percent !== null && (
            <div class="answer-progress-track" aria-hidden="true">
              <div class="answer-progress-bar" style={{ width: `${percent}%` }} />
            </div>
          )}
          <div class="answer-row" role="group" aria-label={t.aiQuestion}>
            <button type="button" class="btn answer-btn answer-yes" onClick={() => actions.answer('yes')}>
              <IconCheck size={20} />
              <span>{t.answerYes}</span>
              {remainingSec !== null && <span class="answer-countdown" data-feature="answer-countdown">({remainingSec}s)</span>}
            </button>
            <button type="button" class="btn answer-btn answer-no" onClick={() => actions.answer('no')}>
              <IconX size={20} />
              <span>{t.answerNo}</span>
              {remainingSec !== null && <span class="answer-countdown" data-feature="answer-countdown">({remainingSec}s)</span>}
            </button>
          </div>
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
