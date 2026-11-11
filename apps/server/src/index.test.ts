import { describe, expect, it } from 'vitest';

import { serverBanner } from './index.js';

describe('@vidur/server', () => {
  it('builds a banner from @vidur/core', () => {
    expect(serverBanner()).toContain('vidur gateway');
    expect(serverBanner()).toContain('@vidur/core');
  });
});
