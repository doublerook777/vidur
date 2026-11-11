import type { FeedItem } from '../contract.js';
import { formatRupees } from './format.js';
import { LABELS } from './labels.js';
import type { ScreenProps } from './types.js';
import { IconArrowDown, IconArrowUp, IconNote } from './icons.js';

export interface FeedVM {
  items: FeedItem[];
  showUndoForId: string | null;
}

export function Feed({ vm, actions, lang }: ScreenProps<FeedVM>) {
  const t = LABELS[lang];
  if (vm.items.length === 0) {
    return (
      <section class="feed" data-feature="feed" aria-label={t.feedTitle}>
        <p class="feed-empty">{t.emptyFeed}</p>
      </section>
    );
  }
  return (
    <section class="feed" data-feature="feed" aria-label={t.feedTitle}>
      <h2 class="feed-title">{t.feedTitle}</h2>
      <ul class="feed-list">
        {vm.items.map((item) => {
          const Icon = item.kind === 'credit' ? IconArrowUp : item.kind === 'payment' ? IconArrowDown : IconNote;
          const word = item.kind === 'credit' ? t.credit : item.kind === 'payment' ? t.payment : t.note;
          const undoable = item.id === vm.showUndoForId;
          return (
            <li key={item.id} class={`feed-item feed-item-${item.kind}`}>
              <span class="feed-item-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <span class="feed-item-body">
                <span class="feed-item-name">{item.customerName}</span>
                <span class="feed-item-kind">
                  <span class="feed-item-kind-icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span class="feed-item-kind-word">{word}</span>
                </span>
                {item.heard ? <span class="feed-item-heard">{item.heard}</span> : null}
              </span>
              {item.paise !== null ? (
                <span class={`feed-item-amount feed-item-amount-${item.kind}`}>{formatRupees(item.paise)}</span>
              ) : null}
              {undoable ? (
                <button type="button" class="btn btn-undo" data-feature="undo" onClick={() => actions.undo(item.id)}>
                  {t.undo}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
