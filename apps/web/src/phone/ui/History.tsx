import type { HistoryVM } from '../contract.js';
import { LABELS } from './labels.js';
import { IconBack } from './icons.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';
import { BottomNav } from './BottomNav.js';
import { Feed } from './Feed.js';

export function History({ vm, actions, lang, now }: ScreenProps<HistoryVM> & { now?: number }) {
  const t = LABELS[lang];
  return (
    <main class="screen screen-history">
      <header class="screen-header">
        <button type="button" class="icon-btn" aria-label={t.back} onClick={() => actions.navigate('home')}>
          <IconBack size={24} />
        </button>
        <h1 class="screen-title">{t.historyTitle}</h1>
        <AiBadge vm={{}} actions={actions} lang={lang} />
      </header>
      <Feed vm={{ items: vm.items, showUndoForId: null, grouped: true, title: t.historyTitle, ...(now !== undefined ? { now } : {}) }} actions={actions} lang={lang} />
      <BottomNav vm={{ current: 'history' }} actions={actions} lang={lang} />
    </main>
  );
}
