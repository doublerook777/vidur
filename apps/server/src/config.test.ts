import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('local mode needs a Gnani key and binds to loopback', () => {
    const c = loadConfig({ MODE: 'local', GNANI_API_KEY: 'k' });
    expect(c.host).toBe('127.0.0.1');
    expect(c.llm).toBeNull();
  });

  it('fails fast and names the variable, not the value', () => {
    expect(() => loadConfig({ MODE: 'local' })).toThrow(/GNANI_API_KEY/);
    try {
      loadConfig({ MODE: 'hosted', GNANI_API_KEY: 'secret-value-123' });
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect(String(e)).toContain('ACCESS_CODE');
      expect(String(e)).not.toContain('secret-value-123');
    }
  });

  it('HOST overrides the bind address (containers need 0.0.0.0, tunnels keep 127.0.0.1)', () => {
    expect(loadConfig({ MODE: 'local', GNANI_API_KEY: 'k', HOST: '0.0.0.0' }).host).toBe('0.0.0.0');
    expect(loadConfig({ MODE: 'hosted', GNANI_API_KEY: 'k', ACCESS_CODE: 'c', HOST: '127.0.0.1' }).host).toBe('127.0.0.1');
  });

  it('mock mode needs no keys', () => {
    expect(loadConfig({ MODE: 'mock' }).gnaniApiKey).toBeNull();
  });

  it('rejects a half-configured LLM and a bad port', () => {
    expect(() => loadConfig({ MODE: 'mock', LLM_API_KEY: 'x' })).toThrow(/LLM_MODEL/);
    expect(() => loadConfig({ MODE: 'mock', PORT: '99999' })).toThrow(/PORT/);
  });

  it('rejects an unknown MODE', () => {
    expect(() => loadConfig({ MODE: 'prod' })).toThrow(/MODE/);
  });
});
