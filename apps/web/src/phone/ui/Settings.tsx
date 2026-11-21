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
  const [shopName, setShopName] = useState(vm.shopName);
  const [ownerName, setOwnerName] = useState(vm.ownerName ?? '');
  const [profileMsg, setProfileMsg] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  const handleSaveProfile = (e: Event) => {
    e.preventDefault();
    if (!shopName.trim() || !ownerName.trim()) return;
    actions.saveProfile({ shopName: shopName.trim(), ownerName: ownerName.trim() });
    setProfileMsg(true);
    setTimeout(() => setProfileMsg(false), 3000);
  };

  const handleSetPin = (e: Event) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(newPin.trim())) {
      setPinMsg('4-6 digits');
      return;
    }
    actions.setPin(newPin.trim());
    setNewPin('');
    setPinMsg(t.profileSaved);
    setTimeout(() => setPinMsg(null), 3000);
  };

  const handleClearPin = () => {
    actions.clearPin();
    setNewPin('');
    setPinMsg(null);
  };

  return (
    <main class="screen screen-settings" data-theme={vm.theme}>
      <header class="screen-header">
        <h1 class="screen-title">{t.settingsTitle}</h1>
        <AiBadge vm={{}} actions={actions} lang={lang} />
      </header>

      {/* Profile Section */}
      <section class="settings-section" aria-label={t.profileTitle} data-feature="profile-section">
        <h2 class="settings-section-title">{t.profileTitle}</h2>
        <form onSubmit={handleSaveProfile} class="settings-form">
          <div class="settings-field">
            <label class="field-label" htmlFor="settings-shop">{t.shopName}</label>
            <input
              id="settings-shop"
              class="input-text"
              type="text"
              value={shopName}
              onInput={(e) => setShopName((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="settings-field">
            <label class="field-label" htmlFor="settings-owner">{t.ownerName}</label>
            <input
              id="settings-owner"
              class="input-text"
              type="text"
              value={ownerName}
              onInput={(e) => setOwnerName((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="settings-form-row">
            <button type="submit" class="btn btn-primary btn-sm" disabled={!shopName.trim() || !ownerName.trim()}>
              {t.save}
            </button>
            {profileMsg && <span class="settings-feedback">{t.profileSaved}</span>}
          </div>
        </form>
      </section>

      {/* PIN Screen Lock Section */}
      <section class="settings-section" aria-label={t.pin} data-feature="pin-section">
        <h2 class="settings-section-title">{t.pin}</h2>
        <p class="settings-status-badge">
          <span class={`status-dot ${vm.hasPin ? 'status-active' : 'status-inactive'}`} />
          <span>{vm.hasPin ? t.pinActive : t.noPinSet}</span>
        </p>
        <p class="field-hint">{t.pinScreenLockNotice}</p>

        <form onSubmit={handleSetPin} class="settings-form">
          <div class="settings-field">
            <label class="field-label" htmlFor="settings-pin">{vm.hasPin ? t.changePin : t.setPin}</label>
            <input
              id="settings-pin"
              class="input-text"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="••••"
              value={newPin}
              onInput={(e) => setNewPin((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <div class="settings-form-row">
            <button
              type="submit"
              class="btn btn-secondary btn-sm"
              disabled={newPin.length < 4 || newPin.length > 6}
            >
              {vm.hasPin ? t.changePin : t.setPin}
            </button>
            {vm.hasPin && (
              <button
                type="button"
                class="btn btn-keep btn-sm"
                onClick={handleClearPin}
              >
                {t.removePin}
              </button>
            )}
            {pinMsg && <span class="settings-feedback">{pinMsg}</span>}
          </div>
        </form>
      </section>

      {/* Language Section */}
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

      {/* Theme Section */}
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

      {/* Encryption Badge Section */}
      <section class="settings-section" aria-label={t.encryptedOnThisPhone}>
        {vm.encrypted && (
          <p class="encrypted-badge" data-feature="encrypted-badge">
            <IconLock size={18} />
            <span>{t.encryptedOnThisPhone}</span>
          </p>
        )}
      </section>

      {/* Delete All Data Section */}
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
