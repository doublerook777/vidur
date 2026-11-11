import { useState } from 'preact/hooks';

import type { CustomerRow } from '../contract.js';
import { formatRupees } from './format.js';
import { LABELS } from './labels.js';
import { IconArrowDown, IconArrowUp, IconBackspace } from './icons.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';

export interface KeypadVM {
  customers: CustomerRow[];
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;

export function Keypad({ vm, actions, lang }: ScreenProps<KeypadVM>) {
  const t = LABELS[lang];
  const [digits, setDigits] = useState('');
  const [kind, setKind] = useState<'credit' | 'payment'>('credit');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const rupees = digits === '' ? 0 : Number(digits);
  const paise = rupees * 100;
  const canSave = rupees > 0 && (customerId !== null || newName.trim().length > 0);

  const backspace = () => setDigits((d) => d.slice(0, -1));
  const pressDigit = (d: string) => {
    if (digits.length >= 7) return;
    setDigits((prev) => (prev === '0' ? d : prev + d));
  };

  return (
    <main class="screen screen-keypad" data-feature="keypad">
      <header class="screen-header">
        <h1 class="screen-title">{t.amount}</h1>
        <AiBadge vm={{}} actions={actions} lang={lang} />
      </header>

      <output class="keypad-display" aria-live="polite">
        {formatRupees(paise)}
      </output>

      <div class="kind-toggle" role="group" aria-label={t.amount}>
        <button
          type="button"
          class={`btn kind-btn kind-credit${kind === 'credit' ? ' kind-btn-active' : ''}`}
          aria-pressed={kind === 'credit'}
          onClick={() => setKind('credit')}
        >
          <IconArrowUp size={22} />
          <span>{t.credit}</span>
        </button>
        <button
          type="button"
          class={`btn kind-btn kind-payment${kind === 'payment' ? ' kind-btn-active' : ''}`}
          aria-pressed={kind === 'payment'}
          onClick={() => setKind('payment')}
        >
          <IconArrowDown size={22} />
          <span>{t.payment}</span>
        </button>
      </div>

      <div class="keypad-grid">
        {DIGITS.map((d) => (
          <button key={d} type="button" class="keypad-key" onClick={() => pressDigit(d)}>
            {d}
          </button>
        ))}
        <button type="button" class="keypad-key keypad-backspace" aria-label={t.backspace} onClick={backspace}>
          <IconBackspace size={28} />
        </button>
      </div>

      <section class="keypad-customer" aria-label={t.chooseCustomer}>
        <ul class="keypad-customer-list">
          {vm.customers.slice(0, 6).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                class={`btn keypad-customer-btn${customerId === c.id ? ' keypad-customer-btn-active' : ''}`}
                aria-pressed={customerId === c.id}
                onClick={() => {
                  setCustomerId(c.id);
                  setNewName('');
                }}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
        <label class="keypad-new-name-label">
          <span class="keypad-new-name-title">{t.newName}</span>
          <input
            type="text"
            class="keypad-new-name"
            value={newName}
            onInput={(e) => {
              setNewName((e.target as HTMLInputElement).value);
              setCustomerId(null);
            }}
            autocomplete="off"
          />
        </label>
      </section>

      <button
        type="button"
        class="btn btn-save"
        disabled={!canSave}
        onClick={() => actions.saveKeypadEntry({ customerId, newName: newName.trim() === '' ? null : newName.trim(), kind, paise })}
      >
        {t.save}
      </button>
    </main>
  );
}
