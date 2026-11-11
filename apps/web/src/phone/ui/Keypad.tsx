import { useState } from 'preact/hooks';

import type { AddPreset, CustomerRow } from '../contract.js';
import { formatRupees, fromLocalInput, toLocalInput } from './format.js';
import { LABELS } from './labels.js';
import { IconArrowDown, IconArrowUp, IconBack, IconBackspace } from './icons.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';

export interface KeypadVM {
  customers: CustomerRow[];
  preset?: AddPreset | null;
  /** The time the screen opens at. */
  now?: number;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'] as const;
type When = 'now' | 'yesterday' | 'pick';
const DAY = 24 * 3600 * 1000;

/** Add an entry by hand: when the mic or the network is not an option, or to put in something from earlier. */
export function Keypad({ vm, actions, lang }: ScreenProps<KeypadVM>) {
  const t = LABELS[lang];
  const now = vm.now ?? Date.now();
  const [digits, setDigits] = useState('');
  const [kind, setKind] = useState<'credit' | 'payment'>(vm.preset?.kind ?? 'credit');
  const [customerId, setCustomerId] = useState<string | null>(vm.preset?.customerId ?? null);
  const [newName, setNewName] = useState('');
  const [when, setWhen] = useState<When>('now');
  const [picked, setPicked] = useState(toLocalInput(now));

  const newFirst = vm.preset?.newCustomer === true;
  const nameBox = (
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
            autoFocus={newFirst}
          />
        </label>
  );
  const rupees = digits === '' ? 0 : Number(digits);
  const paise = rupees * 100;
  const pickedMs = when === 'pick' ? fromLocalInput(picked) : null;
  const at = when === 'now' ? undefined : when === 'yesterday' ? now - DAY : (pickedMs ?? undefined);
  const timeOk = when !== 'pick' || (pickedMs !== null && pickedMs <= now + 60_000);
  const canSave = rupees > 0 && (customerId !== null || newName.trim().length > 0) && timeOk;

  const backspace = () => setDigits((d) => d.slice(0, -1));
  const press = (k: string) => setDigits((prev) => (prev.length + k.length > 7 || (prev === '' && k.startsWith('0')) ? prev : prev + k));
  const back = () => actions.navigate(vm.preset?.customerId ? 'customer' : 'home');

  return (
    <main class="screen screen-keypad" data-feature="keypad">
      <header class="screen-header">
        <button type="button" class="icon-btn" aria-label={t.back} onClick={back}>
          <IconBack size={24} />
        </button>
        <h1 class="screen-title">{t.addEntry}</h1>
        <AiBadge vm={{}} actions={actions} lang={lang} />
      </header>

      <div class="kind-toggle" role="group" aria-label={t.kindTitle}>
        <button type="button" class={`btn kind-btn kind-credit${kind === 'credit' ? ' kind-btn-active' : ''}`} aria-pressed={kind === 'credit'} onClick={() => setKind('credit')}>
          <IconArrowUp size={20} />
          <span>{t.credit}</span>
        </button>
        <button type="button" class={`btn kind-btn kind-payment${kind === 'payment' ? ' kind-btn-active' : ''}`} aria-pressed={kind === 'payment'} onClick={() => setKind('payment')}>
          <IconArrowDown size={20} />
          <span>{t.payment}</span>
        </button>
      </div>

      <output class="keypad-display" aria-live="polite" aria-label={t.amount}>
        {formatRupees(paise)}
      </output>

      <section class="keypad-customer" aria-label={t.chooseCustomer}>
        {newFirst && nameBox}
        <ul class="keypad-customer-list">
          {vm.customers.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                class={`btn keypad-customer-btn${customerId === c.id ? ' keypad-customer-btn-active' : ''}`}
                aria-pressed={customerId === c.id}
                onClick={() => {
                  setCustomerId(customerId === c.id ? null : c.id);
                  setNewName('');
                }}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
        {!newFirst && nameBox}
      </section>

      <section class="keypad-when" aria-label={t.whenTitle}>
        <div class="when-row" role="group" aria-label={t.whenTitle}>
          {(['now', 'yesterday', 'pick'] as const).map((w) => (
            <button key={w} type="button" class={`btn when-btn${when === w ? ' when-btn-active' : ''}`} aria-pressed={when === w} onClick={() => setWhen(w)}>
              {w === 'now' ? t.whenNow : w === 'yesterday' ? t.whenYesterday : t.whenPick}
            </button>
          ))}
        </div>
        {when === 'pick' && (
          <input
            type="datetime-local"
            class="when-input"
            aria-label={t.whenPick}
            value={picked}
            max={toLocalInput(now)}
            onInput={(e) => setPicked((e.target as HTMLInputElement).value)}
          />
        )}
      </section>

      <div class="keypad-grid">
        {KEYS.map((k) => (
          <button key={k} type="button" class="keypad-key" onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button type="button" class="keypad-key keypad-backspace" aria-label={t.backspace} onClick={backspace}>
          <IconBackspace size={26} />
        </button>
      </div>

      <button
        type="button"
        class="btn btn-save"
        disabled={!canSave}
        onClick={() => actions.saveKeypadEntry({ customerId, newName: newName.trim() === '' ? null : newName.trim(), kind, paise, ...(at !== undefined ? { at } : {}) })}
      >
        {t.save}
      </button>
    </main>
  );
}
