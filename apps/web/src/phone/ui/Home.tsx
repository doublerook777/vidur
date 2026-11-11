import type { FeedItem, HomeVM } from '../contract.js';
import { formatRupees } from './format.js';
import { LABELS } from './labels.js';
import { IconArrowDown, IconArrowUp, IconMic } from './icons.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';
import { StateIndicator } from './StateIndicator.js';
import { EntryCard } from './EntryCard.js';
import { Feed } from './Feed.js';
import { BottomNav } from './BottomNav.js';

function newestUndoableId(items: FeedItem[], now: number): string | null {
  let best: FeedItem | null = null;
  for (const item of items) {
    if (item.undoableUntil === null || item.undoableUntil <= now) continue;
    if (!best || item.at > best.at) best = item;
  }
  return best?.id ?? null;
}

export function Home({ vm, actions, lang }: ScreenProps<HomeVM>) {
  const t = LABELS[lang];
  const now = Date.now();
  const undoId = newestUndoableId(vm.feed, now);
  const offline = !vm.online || vm.phase === 'offline';

  return (
    <main class="screen screen-home">
      <header class="screen-header">
        <StateIndicator vm={{ phase: vm.phase }} actions={actions} lang={lang} />
        <AiBadge vm={{}} actions={actions} lang={lang} />
      </header>

      {offline && (
        <div class="offline-banner" data-feature="offline-banner" role="status">
          {t.offlineBanner}
        </div>
      )}
      {vm.mockMode && <div class="mock-banner" role="status">{t.mockMode}</div>}

      {vm.error && (
        <div class="error-banner" role="alert">
          <span class="error-text">{vm.error.text}</span>
          <button type="button" class="btn btn-error" onClick={() => actions.retry()}>
            {vm.error.actionLabel ?? t.retry}
          </button>
        </div>
      )}

      <section class="totals" data-feature="totals" aria-label="today">
        <div class="totals-item totals-credit">
          <span class="totals-icon" aria-hidden="true"><IconArrowUp size={26} /></span>
          <span class="totals-label">{t.todayCredit}</span>
          <span class="totals-value totals-value-credit">{formatRupees(vm.creditTodayPaise)}</span>
        </div>
        <div class="totals-item totals-payment">
          <span class="totals-icon" aria-hidden="true"><IconArrowDown size={26} /></span>
          <span class="totals-label">{t.todayPayment}</span>
          <span class="totals-value totals-value-payment">{formatRupees(vm.paymentTodayPaise)}</span>
        </div>
        <div class="totals-people">
          <span class="totals-label">{t.peopleToday}</span>
          <span class="totals-people-value">{vm.peopleToday}</span>
        </div>
      </section>

      {vm.card && <EntryCard vm={vm.card} actions={actions} lang={lang} />}

      <Feed vm={{ items: vm.feed, showUndoForId: undoId }} actions={actions} lang={lang} />

      <div class="mic-zone">
        <button
          type="button"
          class="mic"
          data-feature="mic-button"
          aria-label={t.holdToTalk}
          onPointerDown={() => actions.micDown()}
          onPointerUp={() => actions.micUp()}
          onPointerCancel={() => actions.micUp()}
          onPointerLeave={() => actions.micUp()}
          onKeyDown={(e) => {
            if (e.key === ' ' && !e.repeat) {
              e.preventDefault();
              actions.micDown();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === ' ') {
              e.preventDefault();
              actions.micUp();
            }
          }}
        >
          <IconMic size={44} />
          <span class="mic-label">{t.holdToTalk}</span>
        </button>
      </div>

      <BottomNav vm={{ current: 'home' }} actions={actions} lang={lang} />
    </main>
  );
}
