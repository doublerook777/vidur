import type { Lang } from '../contract.js';
import { LABELS } from './labels.js';
import { IconLock } from './icons.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';

export interface OnboardingVM {
  lang: Lang;
}

const LANG_LABEL: Record<Lang, string> = { hi: 'हिंदी', en: 'English', kn: 'ಕನ್ನಡ' };

export function Onboarding({ vm, actions, lang }: ScreenProps<OnboardingVM>) {
  const t = LABELS[lang];
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

      <div class="onboarding-actions">
        <button type="button" class="btn btn-primary" onClick={() => actions.finishOnboarding({ lang: vm.lang, demoData: true })}>
          {t.startWithDemo}
        </button>
        <button type="button" class="btn btn-secondary" onClick={() => actions.finishOnboarding({ lang: vm.lang, demoData: false })}>
          {t.startClean}
        </button>
      </div>
    </main>
  );
}
