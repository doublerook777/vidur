import { describe, expect, it } from 'vitest';

import { CORE_NAME, coreBanner } from './index.js';

describe('@vidur/core', () => {
  it('exposes its package name', () => {
    expect(CORE_NAME).toBe('@vidur/core');
    expect(coreBanner()).toContain('@vidur/core');
  });
});
