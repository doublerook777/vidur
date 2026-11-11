import type { FeedItem, HomeVM } from '../contract.js';
import { formatDayLong, formatRupees } from './format.js';
import { LABELS } from './labels.js';
import { IconArrowDown, IconChevron, IconCustomers, IconPlus } from './icons.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';
import { StateIndicator } from './StateIndicator.js';
import { EntryCard } from './EntryCard.js';
import { Feed } from './Feed.js';
import { BottomNav } from './BottomNav.js';
import { VoiceOrb } from './VoiceOrb.js';

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
  const now = vm.now;
  const undoId = newestUndoableId(vm.feed, now);
  const offline = !vm.online || vm.phase === 'offline';
  const recent = vm.feed.slice(0, 6);

  return (
    <main class="screen screen-home">
      <header class="screen-header">
        <StateIndicator vm={{ phase: vm.phase }} actions={actions} lang={lang} />
        <span class="header-badges">
          {vm.mockMode && <span class="demo-chip">{t.mockMode}</span>}
          <AiBadge vm={{}} actions={actions} lang={lang} />
        </span>
      </header>

      <div class="greeting">
        <h1 class="greeting-title">
          {t.greeting}
          {vm.shopName ? `, ${vm.shopName}` : ''}
        </h1>
        <p class="greeting-sub">{formatDayLong(now, lang)}</p>
      </div>

      {offline && (
        <div class="offline-banner" data-feature="offline-banner" role="status">
          {t.offlineBanner}
        </div>
      )}
      {vm.error && (
        <div class="error-banner" role="alert">
          <span class="error-text">{vm.error.text}</span>
          <span class="error-actions">
            <button type="button" class="btn btn-error" onClick={() => actions.retry()}>
              {vm.error.actionLabel ?? t.retry}
            </button>
            <button type="button" class="btn btn-error-alt" onClick={() => actions.openAddEntry()}>
              {t.addEntry}
            </button>
          </span>
        </div>
      )}

      <section class="totals" data-feature="totals" aria-label="today">
        <div class="totals-peek" aria-hidden="true">
          <span>{t.todayWord}</span>
        </div>
        <div class="totals-card">
          <div class="totals-item totals-credit">
            <span class="totals-label">{t.todayCredit}</span>
            <span class="totals-value totals-value-credit">{formatRupees(vm.creditTodayPaise)}</span>
          </div>
          <div class="totals-item totals-payment">
            <span class="totals-icon" aria-hidden="true"><IconArrowDown size={18} /></span>
            <span class="totals-label">{t.todayPayment}</span>
            <span class="totals-value totals-value-payment">{formatRupees(vm.paymentTodayPaise)}</span>
          </div>
          <div class="totals-people">
            <span class="totals-people-icon" aria-hidden="true"><IconCustomers size={18} /></span>
            <span class="totals-label">{t.peopleToday}</span>
            <span class="totals-people-value">{vm.peopleToday}</span>
          </div>
          <button type="button" class="notch-btn" data-feature="add-entry" onClick={() => actions.openAddEntry()}>
            <IconPlus size={20} />
            <span>{t.addEntry}</span>
          </button>
        </div>
      </section>

      {vm.card && <EntryCard vm={vm.card} actions={actions} lang={lang} />}

      <Feed vm={{ items: recent, showUndoForId: undoId, now }} actions={actions} lang={lang} />
      {vm.feed.length > 0 && (
        <button type="button" class="see-all" data-feature="history" onClick={() => actions.navigate('history')}>
          <span>{t.seeAll}</span>
          <IconChevron size={18} />
        </button>
      )}

      <BottomNav vm={{ current: 'home' }} actions={actions} lang={lang} orb={<VoiceOrb vm={{ phase: vm.phase }} actions={actions} lang={lang} />} />
    </main>
  );
}
