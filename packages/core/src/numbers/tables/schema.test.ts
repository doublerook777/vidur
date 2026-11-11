import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const TABLES_DIR = dirname(fileURLToPath(import.meta.url));
const COMPLETE_LANGS = new Set(['hi', 'en', 'kn']);

interface LangTable {
  lang: string;
  status: 'complete' | 'draft';
  source: string;
  units: Record<string, { native: string[]; roman: string[] }>;
  multipliers: Record<string, { native: string[]; roman: string[] }>;
  fractions: Record<string, { native: string[]; roman: string[]; value?: number }>;
  digits: Record<string, string>;
  notes?: string;
}

const files = readdirSync(TABLES_DIR).filter((f) => f.endsWith('.json'));
const tables = files.map((f) => ({
  name: f,
  data: JSON.parse(readFileSync(join(TABLES_DIR, f), 'utf8')) as LangTable,
}));

const ROMAN_RE = /^[a-z0-9][a-z0-9 -]*$/;

function* romanSpellings(table: LangTable): Generator<[string, string]> {
  for (const [key, entry] of Object.entries(table.units)) {
    for (const r of entry.roman) yield [`units.${key}`, r];
  }
  for (const [key, entry] of Object.entries(table.multipliers)) {
    for (const r of entry.roman) yield [`multipliers.${key}`, r];
  }
  for (const [key, entry] of Object.entries(table.fractions)) {
    for (const r of entry.roman) yield [`fractions.${key}`, r];
  }
}

describe('spoken-number tables', () => {
  it('covers the ten P0..P2 languages', () => {
    expect(new Set(files)).toEqual(
      new Set(['hi.json', 'en.json', 'kn.json', 'ta.json', 'te.json', 'ml.json', 'mr.json', 'bn.json', 'gu.json', 'pa.json']),
    );
  });

  it.each(tables.map((t) => [t.name, t.data] as [string, LangTable]))('%s: required fields', (name, table) => {
    expect(table.lang).toBe(name.replace(/\.json$/, ''));
    expect(['complete', 'draft']).toContain(table.status);
    expect(typeof table.source).toBe('string');
    expect(table.source.trim().length).toBeGreaterThan(0);
    expect(table.units).toBeDefined();
    expect(table.multipliers).toBeDefined();
    expect(table.fractions).toBeDefined();
    expect(table.digits).toBeDefined();
    for (const key of ['hundred', 'thousand', 'lakh', 'crore']) {
      expect(table.multipliers[key], `multipliers.${key}`).toBeDefined();
      expect(table.multipliers[key]?.roman.length).toBeGreaterThan(0);
    }
  });

  it.each(tables.map((t) => [t.name, t.data] as [string, LangTable]))('%s: unit keys are 0..100', (_name, table) => {
    for (const key of Object.keys(table.units)) {
      const n = Number(key);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });

  it.each(tables.map((t) => [t.name, t.data] as [string, LangTable]))(
    '%s: complete files define every key 0..100',
    (_name, table) => {
      if (!COMPLETE_LANGS.has(table.lang)) return;
      expect(table.status).toBe('complete');
      for (let i = 0; i <= 100; i++) {
        const entry = table.units[String(i)];
        expect(entry, `missing unit ${i}`).toBeDefined();
        expect(entry?.native.length).toBeGreaterThan(0);
        expect(entry?.roman.length).toBeGreaterThan(0);
      }
    },
  );

  it.each(tables.map((t) => [t.name, t.data] as [string, LangTable]))(
    '%s: every roman spelling is lowercase ascii',
    (_name, table) => {
      for (const [where, spelling] of romanSpellings(table)) {
        expect(ROMAN_RE.test(spelling), `${where}: ${JSON.stringify(spelling)}`).toBe(true);
      }
    },
  );

  it.each(tables.map((t) => [t.name, t.data] as [string, LangTable]))(
    '%s: digits map ten distinct native chars to 0-9',
    (_name, table) => {
      const entries = Object.entries(table.digits);
      expect(entries).toHaveLength(10);
      expect(new Set(entries.map(([, v]) => v))).toEqual(new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']));
      expect(new Set(entries.map(([k]) => k)).size).toBe(10);
    },
  );
});
