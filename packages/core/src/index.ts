export const CORE_NAME = '@vidur/core';

export function coreBanner(): string {
  return `vidur core (${CORE_NAME})`;
}

export * from './numbers/index.js';
export * from './ledger/index.js';
export * from './dates/index.js';
export * from './names/index.js';
export * from './speak/index.js';
export * from './intent/index.js';
