import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CATEGORIES,
  LANGS,
  MIN_PER_CATEGORY,
  validateRedteamEntry,
  type RedteamEntry,
} from './schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const jsonlFiles = readdirSync(here).filter((f) => f.endsWith('.jsonl'));

interface ParsedLine {
  file: string;
  lineNo: number;
  raw: string;
  value?: unknown;
  parseError?: string;
}

const lines: ParsedLine[] = [];
for (const file of jsonlFiles) {
  const content = readFileSync(join(here, file), 'utf8');
  content.split('\n').forEach((raw, i) => {
    if (raw.trim().length === 0) return;
    try {
      lines.push({ file, lineNo: i + 1, raw, value: JSON.parse(raw) });
    } catch (err) {
      lines.push({ file, lineNo: i + 1, raw, parseError: String(err) });
    }
  });
}

const entries = lines.map((l) => l.value as RedteamEntry | undefined);

describe('red-team utterance list', () => {
  it('has at least one .jsonl file', () => {
    expect(jsonlFiles.length).toBeGreaterThan(0);
  });

  it('contains at least 60 utterances', () => {
    expect(lines.length).toBeGreaterThanOrEqual(60);
  });

  it('parses every line as JSON', () => {
    const bad = lines.filter((l) => l.parseError);
    expect(bad.map((l) => `${l.file}:${l.lineNo} ${l.parseError}`)).toEqual([]);
  });

  it('validates every line against the schema', () => {
    const errors = lines.flatMap((l) => {
      if (l.parseError) return [`${l.file}:${l.lineNo}: ${l.parseError}`];
      return validateRedteamEntry(l.value, l.lineNo).errors.map((e) => `${l.file}: ${e}`);
    });
    expect(errors).toEqual([]);
  });

  it('has unique ids', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const l of lines) {
      const id = (l.value as RedteamEntry | undefined)?.id;
      if (typeof id !== 'string') continue;
      const prev = seen.get(id);
      if (prev) dupes.push(`${id} (in ${prev} and ${l.file}:${l.lineNo})`);
      else seen.set(id, `${l.file}:${l.lineNo}`);
    }
    expect(dupes).toEqual([]);
  });

  it('has every category present with the minimum count', () => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (e && typeof e.category === 'string') counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    }
    for (const cat of CATEGORIES) {
      expect(counts.get(cat) ?? 0, `category ${cat}`).toBeGreaterThanOrEqual(MIN_PER_CATEGORY[cat]);
    }
  });

  it('covers all four languages', () => {
    const langs = new Set(entries.map((e) => e?.lang));
    for (const lang of LANGS) expect(langs).toContain(lang);
  });
});
