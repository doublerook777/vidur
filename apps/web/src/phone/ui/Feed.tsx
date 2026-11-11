import { useRef, useState } from 'preact/hooks';

import type { FeedItem } from '../contract.js';
import { dayKey, formatDay, formatDayLong, formatRupees, formatTime, formatWhen } from './format.js';
import { LABELS } from './labels.js';
import type { ScreenProps } from './types.js';
import { IconArrowDown, IconArrowUp, IconMore, IconNote, IconTrash } from './icons.js';

export interface FeedVM {
  items: FeedItem[];
  showUndoForId: string | null;
  /** Group the rows under Today, Yesterday and dates. Used by the All entries screen. */
  grouped?: boolean;
  /** Overrides "Recent entries". */
  title?: string;
  /** The time the page is rendered at, so tests and the phone agree on "today". */
  now?: number;
}

/** One entry: who, what, the time, the amount; and a way to remove it. */
export function EntryRow({ item, undoable, now, lang, actions, showDate = true }: { item: FeedItem; undoable: boolean; now: number; lang: 'hi' | 'en' | 'kn'; actions: ScreenProps<FeedVM>['actions']; showDate?: boolean }) {
  const t = LABELS[lang];
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const row = useRef<HTMLLIElement>(null);
  // Opening the menu or the question brings it clear of the floating nav.
  const reveal = (): void => void requestAnimationFrame(() => row.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  const Icon = item.kind === 'credit' ? IconArrowUp : item.kind === 'payment' ? IconArrowDown : IconNote;
  const word = item.kind === 'credit' ? t.credit : item.kind === 'payment' ? t.payment : t.note;
  const manageable = item.kind !== 'note';
  return (
    <li ref={row} class={`feed-item feed-item-${item.kind}${open ? ' feed-item-open' : ''}`}>
      <div class="feed-item-main">
        <span class="feed-item-icon" aria-hidden="true">
          <Icon size={22} />
        </span>
        <span class="feed-item-body">
          <span class="feed-item-name">{item.customerName}</span>
          <span class="feed-item-when" data-feature="timestamp">
            <span class="feed-item-kind-word">{word}</span>
            <span aria-hidden="true"> · </span>
            <time dateTime={new Date(item.at).toISOString()}>{showDate ? formatWhen(item.at, now, lang) : formatTime(item.at, lang)}</time>
          </span>
          {item.heard ? <span class="feed-item-heard">{item.heard}</span> : null}
        </span>
        {item.paise !== null ? <span class={`feed-item-amount feed-item-amount-${item.kind}`}>{formatRupees(item.paise)}</span> : null}
        {manageable ? (
          <button
            type="button"
            class="icon-btn feed-item-more"
            data-feature="remove-entry"
            aria-label={t.manage}
            aria-expanded={open}
            onClick={() => {
              setOpen(!open);
              setAsking(false);
              reveal();
            }}
          >
            <IconMore size={20} />
          </button>
        ) : null}
      </div>
      {undoable ? (
        <div class="feed-item-undo">
          <button type="button" class="btn btn-undo" data-feature="undo" onClick={() => actions.undo(item.id)}>
            {t.undo}
          </button>
        </div>
      ) : null}
      {open && manageable ? (
        <div class="feed-item-manage" role="group" aria-label={t.manage}>
          <p class="feed-item-recorded">
            {t.recordedAt}: {formatDay(item.recordedAt, lang)}, {formatTime(item.recordedAt, lang)}
          </p>
          {!asking ? (
            <button type="button" class="btn btn-danger feed-remove" onClick={() => { setAsking(true); reveal(); }}>
              <IconTrash size={18} />
              <span>{t.remove}</span>
            </button>
          ) : (
            <div class="feed-remove-ask" role="alert">
              <p class="feed-remove-text">
                {t.removeAsk} <strong>{item.customerName} {item.paise !== null ? formatRupees(item.paise) : ''}</strong>
              </p>
              <div class="feed-remove-row">
                <button type="button" class="btn btn-danger-confirm" onClick={() => actions.removeEntry(item.id)}>
                  {t.removeYes}
                </button>
                <button type="button" class="btn btn-keep" onClick={() => { setAsking(false); setOpen(false); }}>
                  {t.keep}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

function dayHeading(at: number, now: number, lang: 'hi' | 'en' | 'kn'): string {
  const t = LABELS[lang];
  const k = dayKey(at);
  if (k === dayKey(now)) return t.todayWord;
  if (k === dayKey(now - 24 * 3600 * 1000)) return t.yesterdayWord;
  return formatDayLong(at, lang);
}

export function Feed({ vm, actions, lang }: ScreenProps<FeedVM>) {
  const t = LABELS[lang];
  const now = vm.now ?? Date.now();
  const title = vm.title ?? t.feedTitle;
  if (vm.items.length === 0) {
    return (
      <section class="feed" data-feature="feed" aria-label={title}>
        <p class="feed-empty">{t.emptyFeed}</p>
      </section>
    );
  }
  // When grouped, rows are sorted by when the money moved, so a backdated entry sits on its own day.
  const items = vm.grouped ? [...vm.items].sort((a, b) => b.at - a.at) : vm.items;
  const groups: { heading: string | null; rows: FeedItem[] }[] = [];
  for (const item of items) {
    const heading = vm.grouped ? dayHeading(item.at, now, lang) : null;
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.rows.push(item);
    else groups.push({ heading, rows: [item] });
  }
  return (
    <section class="feed" data-feature="feed" aria-label={title}>
      {vm.grouped ? null : <h2 class="feed-title">{title}</h2>}
      {groups.map((g, i) => (
        <div class="feed-group" key={`${g.heading ?? 'all'}-${i}`}>
          {g.heading ? <h3 class="feed-day">{g.heading}</h3> : null}
          <ul class="feed-list">
            {g.rows.map((item) => (
              <EntryRow key={item.id} item={item} undoable={item.id === vm.showUndoForId} now={now} lang={lang} actions={actions} showDate={!vm.grouped} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
