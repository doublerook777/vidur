import { useState } from 'preact/hooks';

import type { Lang, SettingsVM, Theme } from '../contract.js';
import { LABELS } from './labels.js';
import { IconLock } from './icons.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';
import { BottomNav } from './BottomNav.js';

const LANG_LABEL: Record<Lang, string> = { hi: 'हिंदी', en: 'English', kn: 'ಕನ್ನಡ' };
const THEMES: Theme[] = ['light', 'dark'];
const LANGS: Lang[] = ['hi', 'en', 'kn'];

export function Settings({ vm, actions, lang }: ScreenProps<SettingsVM>) {
  const t = LABELS[lang];
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <main class="screen screen-settings" data-theme={vm.theme}>
      <header class="screen-header">
        <h1 class="screen-title">{t.settingsTitle}</h1>
        <AiBadge vm={{}} actions={actions} lang={lang} />
      </header>

      <section class="settings-section" aria-label={t.language}>
        <h2 class="settings-section-title">{t.language}</h2>
        <div class="settings-lang-row" role="group" aria-label={t.language} data-feature="language-switch">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              class={`btn lang-btn${vm.lang === l ? ' lang-btn-active' : ''}`}
              aria-pressed={vm.lang === l}
              onClick={() => actions.setLang(l)}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
      </section>

      <section class="settings-section" aria-label="theme">
        <div class="settings-theme-row" data-feature="theme-switch">
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              class={`btn theme-btn${vm.theme === theme ? ' theme-btn-active' : ''}`}
              aria-pressed={vm.theme === theme}
              onClick={() => actions.setTheme(theme)}
            >
              {theme === 'light' ? t.themeLight : t.themeDark}
            </button>
          ))}
        </div>
      </section>

      <section class="settings-section" aria-label={t.shopName}>
        <h2 class="settings-section-title">{t.shopName}</h2>
        <p class="settings-shop-name">{vm.shopName}</p>
        {vm.encrypted && (
          <p class="encrypted-badge" data-feature="encrypted-badge">
            <IconLock size={18} />
            <span>{t.encryptedOnThisPhone}</span>
          </p>
        )}
      </section>

      <section class="settings-section settings-danger" aria-label={t.deleteAllData} data-feature="delete-all">
        {!confirmingDelete ? (
          <button type="button" class="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
            {t.deleteAllData}
          </button>
        ) : (
          <div class="delete-confirm" role="alert">
            <p class="delete-confirm-text">{t.deleteAllConfirm}</p>
            <div class="delete-confirm-row">
              <button type="button" class="btn btn-danger-confirm" onClick={() => actions.deleteAll()}>
                {t.deleteAllYes}
              </button>
              <button type="button" class="btn btn-keep" onClick={() => setConfirmingDelete(false)}>
                {t.deleteAllNo}
              </button>
            </div>
          </div>
        )}
      </section>

      <BottomNav vm={{ current: 'settings' }} actions={actions} lang={lang} />
    </main>
  );
}
