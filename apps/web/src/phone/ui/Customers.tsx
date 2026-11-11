import type { CustomerRow } from '../contract.js';
import { formatRupees } from './format.js';
import { LABELS } from './labels.js';
import { aliasesFor } from '@vidur/core';

import { IconArrowDown, IconArrowUp, IconCustomers, IconPlus } from './icons.js';
import type { ScreenProps } from './types.js';
import { AiBadge } from './AiBadge.js';
import { BottomNav } from './BottomNav.js';

export interface CustomersVM {
  customers: CustomerRow[];
}

export function Customers({ vm, actions, lang }: ScreenProps<CustomersVM>) {
  const t = LABELS[lang];
  return (
    <main class="screen screen-customers">
      <header class="screen-header">
        <h1 class="screen-title">{t.customersTitle}</h1>
        <AiBadge vm={{}} actions={actions} lang={lang} />
      </header>

      <button type="button" class="btn btn-new-customer" data-feature="new-customer" onClick={() => actions.openAddEntry({ newCustomer: true })}>
        <IconPlus size={20} />
        <span>{t.newCustomer}</span>
      </button>

      <ul class="customer-list" data-feature="customer-list" aria-label={t.customersTitle}>
        {vm.customers.map((c) => {
          const positive = c.balancePaise >= 0;
          const DirectionIcon = positive ? IconArrowUp : IconArrowDown;
          const directionWord = positive ? t.credit : t.payment;
          return (
            <li key={c.id}>
              <button type="button" class="customer-row" onClick={() => actions.openCustomer(c.id)}>
                <span class="customer-avatar" aria-hidden="true">
                  <IconCustomers size={26} />
                </span>
                <span class="customer-info">
                  <span class="customer-name">{c.name}</span>
                  {c.aliases.length > 0 && <span class="customer-aliases">{aliasesFor(c.aliases, lang).join(', ')}</span>}
                </span>
                <span class="customer-balance">
                  <span class="customer-balance-direction">
                    <DirectionIcon size={16} />
                    <span class="customer-balance-word">{directionWord}</span>
                  </span>
                  <span class="customer-balance-value">{formatRupees(Math.abs(c.balancePaise))}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <BottomNav vm={{ current: 'customers' }} actions={actions} lang={lang} />
    </main>
  );
}
