import { useEffect, useState } from 'preact/hooks';

import type { Actions, Lang } from '../contract.js';
import { IconLock } from './icons.js';
import { LABELS } from './labels.js';

export interface LockScreenVM {
  shopName: string;
  lockUntil: number | null;
  wrongAttempts: number;
  error: string | null;
}

interface LockScreenProps {
  vm: LockScreenVM;
  actions: Actions;
  lang: Lang;
}

export function LockScreen({ vm, actions, lang }: LockScreenProps) {
  const t = LABELS[lang];
  const [pin, setPin] = useState('');
  const [confirmingForgot, setConfirmingForgot] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!vm.lockUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [vm.lockUntil]);

  const isLockedOut = Boolean(vm.lockUntil && now < vm.lockUntil);
  const secondsLeft = isLockedOut ? Math.max(1, Math.ceil(((vm.lockUntil ?? 0) - now) / 1000)) : 0;

  const handleSubmit = (e?: Event) => {
    e?.preventDefault();
    if (isLockedOut || !pin) return;
    actions.unlock(pin.trim());
    setPin('');
  };

  return (
    <main class="screen screen-lock" data-feature="lock-screen" aria-label={t.unlock}>
      <div class="lock-card">
        <div class="lock-icon-wrap" aria-hidden="true">
          <IconLock size={36} />
        </div>

        <h1 class="lock-title">{vm.shopName || 'Vidur'}</h1>
        <p class="lock-sub">{t.enterPin}</p>

        {isLockedOut ? (
          <div class="lock-error lock-lockout" role="alert">
            <span>{t.tooManyAttempts} ({secondsLeft}s)</span>
          </div>
        ) : vm.error === 'incorrect_pin' ? (
          <div class="lock-error" role="alert">
            <span>{t.wrongPin}</span>
          </div>
        ) : null}

        <form class="lock-form" onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            class="lock-input"
            aria-label={t.pin}
            placeholder="••••"
            value={pin}
            disabled={isLockedOut}
            autoFocus
            onInput={(e) => setPin((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6))}
          />

          <button
            type="submit"
            class="btn btn-primary btn-unlock"
            disabled={isLockedOut || pin.length < 4}
          >
            {t.unlock}
          </button>
        </form>

        <p class="lock-notice" role="note">
          {t.pinScreenLockNotice}
        </p>

        {!confirmingForgot ? (
          <button
            type="button"
            class="btn-link lock-forgot-btn"
            onClick={() => setConfirmingForgot(true)}
          >
            {t.forgotPin}
          </button>
        ) : (
          <div class="lock-forgot-confirm" role="alert">
            <p class="lock-forgot-text">{t.forgotPinConfirm}</p>
            <div class="lock-forgot-actions">
              <button
                type="button"
                class="btn btn-danger-confirm"
                onClick={() => actions.deleteAll()}
              >
                {t.deleteAllYes}
              </button>
              <button
                type="button"
                class="btn btn-keep"
                onClick={() => setConfirmingForgot(false)}
              >
                {t.deleteAllNo}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
