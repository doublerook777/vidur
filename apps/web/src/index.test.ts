import { describe, expect, it } from 'vitest';

import { WEB_NAME, webBanner } from './index';

describe('@vidur/web', () => {
  it('exposes its package name', () => {
    expect(WEB_NAME).toBe('@vidur/web');
    expect(webBanner()).toContain('@vidur/web');
  });
});
