import { describe, expect, it } from 'vitest';

import { FEATURE_IDS } from '../phone/contract.js';
import { FEATURES } from './features.js';

const BANNED = ['AI-powered', 'revolutionary', 'seamless'];

describe('FEATURES', () => {
  it('has an entry for every FEATURE_ID', () => {
    for (const id of FEATURE_IDS) {
      expect(FEATURES[id], `missing entry for ${id}`).toBeDefined();
    }
  });

  it('has no extra entries beyond FEATURE_IDS', () => {
    expect(Object.keys(FEATURES).sort()).toEqual([...FEATURE_IDS].sort());
  });

  it('every entry has non-empty title, what and why', () => {
    for (const id of FEATURE_IDS) {
      const e = FEATURES[id];
      expect(e.title.trim().length, `${id}.title`).toBeGreaterThan(0);
      expect(e.what.trim().length, `${id}.what`).toBeGreaterThan(0);
      expect(e.why.trim().length, `${id}.why`).toBeGreaterThan(0);
    }
  });

  it('no entry uses banned hype words', () => {
    for (const id of FEATURE_IDS) {
      const e = FEATURES[id];
      for (const field of ['title', 'what', 'why'] as const) {
        for (const banned of BANNED) {
          expect(e[field].toLowerCase(), `${id}.${field} contains "${banned}"`).not.toContain(
            banned.toLowerCase(),
          );
        }
      }
    }
  });

  it('"what" and "why" are single sentences (one terminal period each)', () => {
    for (const id of FEATURE_IDS) {
      for (const field of ['what', 'why'] as const) {
        const text = FEATURES[id][field].trim();
        expect(text.endsWith('.'), `${id}.${field} should end with a period`).toBe(true);
        expect(text.slice(0, -1), `${id}.${field} should be one sentence`).not.toContain('. ');
      }
    }
  });
});
