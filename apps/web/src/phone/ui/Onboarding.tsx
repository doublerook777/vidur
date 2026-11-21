import { useState } from 'preact/hooks';

import type { Lang } from '../contract.js';
import { LABELS } from './labels.js';
import { IconLock } from './icons.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';

export interface OnboardingVM {
  lang: Lang;
}

const LANG_LABEL: Record<Lang, string> = {
  hi: 'हिंदी',
  en: 'English',
  kn: 'ಕನ್ನಡ',
  ta: 'தமிழ் (Beta)',
  te: 'తెలుగు (Beta)',
  mr: 'मराठी (Beta)',
  gu: 'ગુજરાતી (Beta)',
};

export function Onboarding({ vm, actions, lang }: ScreenProps<OnboardingVM>) {
  const t = LABELS[lang];
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [pin, setPin] = useState('');

  const handleFinish = (demoData: boolean) => {
    const sName =
      shopName.trim() ||
      (lang === 'hi'
        ? 'किराना स्टोर'
        : lang === 'kn'
          ? 'ಕಿರಾಣಿ ಅಂಗಡಿ'
          : lang === 'ta'
            ? 'மளிகைக் கடை'
            : lang === 'te'
              ? 'కిరాణా కొట్టు'
              : lang === 'mr'
                ? 'किराणा दुकान'
                : lang === 'gu'
                  ? 'કરિયાણાની દુકાન'
                  : 'Kirana Store');
    const oName =
      ownerName.trim() ||
      (lang === 'hi'
        ? 'दुकानदार'
        : lang === 'kn'
          ? 'ಅಂಗಡಿಯವರು'
          : lang === 'ta'
            ? 'உரிமையாளர்'
            : lang === 'te'
              ? 'యజమాని'
              : lang === 'mr'
                ? 'दुकानदार'
                : lang === 'gu'
                  ? 'દુકાનદાર'
                  : 'Owner');
    const validPin = /^\d{4,6}$/.test(pin.trim()) ? pin.trim() : undefined;
    actions.finishOnboarding({
      lang: vm.lang,
      demoData,
      profile: {
        shopName: sName,
        ownerName: oName,
        ...(validPin ? { pin: validPin } : {}),
      },
    });
  };

  return (
    <main class="screen screen-onboarding">
      <header class="screen-header">
        <h1 class="screen-title">{t.onboardingTitle}</h1>
        <AiBadge vm={{}} actions={actions} lang={lang} />
      </header>

      <section class="onboarding-disclosure" data-feature="onboarding-disclosure" role="note">
        <p class="onboarding-disclosure-text">{t.onboardingDisclosure}</p>
        <p class="encrypted-badge encrypted-badge-onboarding">
          <IconLock size={18} />
          <span>{t.encryptedOnThisPhone}</span>
        </p>
      </section>

      <section class="onboarding-lang" aria-label={t.language}>
        <div class="settings-lang-row" role="group" aria-label={t.language} data-feature="language-switch">
          {(['hi', 'en', 'kn'] as Lang[]).map((l) => (
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

      <section class="onboarding-profile" aria-label={t.profileTitle} data-feature="onboarding-profile">
        <div class="onboarding-field">
          <label class="field-label" htmlFor="onboarding-shop">{t.shopName}</label>
          <input
            id="onboarding-shop"
            class="input-text onboarding-input"
            type="text"
            placeholder={t.enterShopName}
            value={shopName}
            onInput={(e) => setShopName((e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="onboarding-field">
          <label class="field-label" htmlFor="onboarding-owner">{t.ownerName}</label>
          <input
            id="onboarding-owner"
            class="input-text onboarding-input"
            type="text"
            placeholder={t.enterOwnerName}
            value={ownerName}
            onInput={(e) => setOwnerName((e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="onboarding-field">
          <label class="field-label" htmlFor="onboarding-pin">{t.pinOptional}</label>
          <input
            id="onboarding-pin"
            class="input-text onboarding-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="••••"
            value={pin}
            onInput={(e) => setPin((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6))}
          />
          <p class="field-hint">{t.pinScreenLockNotice}</p>
          <p class="field-hint field-hint-warning">{t.forgotPinWarning}</p>
        </div>
      </section>

      <div class="onboarding-actions">
        <button type="button" class="btn btn-primary" onClick={() => handleFinish(true)}>
          {t.startWithDemo}
        </button>
        <button type="button" class="btn btn-secondary" onClick={() => handleFinish(false)}>
          {t.startClean}
        </button>
      </div>
    </main>
  );
}
