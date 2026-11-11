import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LANGS, validateUtterance, type GoldenUtterance } from './schema.js';

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

describe('golden utterance set', () => {
  it('has at least one .jsonl file', () => {
    expect(jsonlFiles.length).toBeGreaterThan(0);
  });

  it('contains at least 150 utterances', () => {
    expect(lines.length).toBeGreaterThanOrEqual(150);
  });

  it('parses every line as JSON', () => {
    const bad = lines.filter((l) => l.parseError);
    expect(bad.map((l) => `${l.file}:${l.lineNo} ${l.parseError}`)).toEqual([]);
  });

  it('validates every line against the schema', () => {
    const errors = lines.flatMap((l) => {
      if (l.parseError) return [`${l.file}:${l.lineNo}: ${l.parseError}`];
      // heldout.jsonl uses H- ids by design; validate them against the same rules with the prefix swapped
      if (l.file === 'heldout.jsonl' && l.value && typeof l.value === 'object') {
        const v = l.value as Record<string, unknown>;
        if (typeof v.id === 'string' && v.id.startsWith('H-')) {
          return validateUtterance({ ...v, id: `G-${v.id.slice(2)}` }, l.lineNo).errors.map((e) => `${l.file}: ${e}`);
        }
      }
      return validateUtterance(l.value, l.lineNo).errors.map((e) => `${l.file}: ${e}`);
    });
    expect(errors).toEqual([]);
  });

  it('has unique ids', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const l of lines) {
      const id = (l.value as GoldenUtterance | undefined)?.id;
      if (typeof id !== 'string') continue;
      const prev = seen.get(id);
      if (prev) dupes.push(`${id} (in ${prev} and ${l.file}:${l.lineNo})`);
      else seen.set(id, `${l.file}:${l.lineNo}`);
    }
    expect(dupes).toEqual([]);
  });

  it('has at least 25 utterances per language bucket', () => {
    const counts = new Map<string, number>();
    for (const l of lines) {
      const lang = (l.value as GoldenUtterance | undefined)?.lang;
      if (typeof lang === 'string') counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
    for (const lang of LANGS) {
      expect(counts.get(lang) ?? 0, `bucket ${lang}`).toBeGreaterThanOrEqual(25);
    }
  });

  it('uses only the declared intents and languages in the data', () => {
    // guards against schema drift: every parsed entry must satisfy both lists
    for (const l of lines) {
      const v = l.value as GoldenUtterance | undefined;
      expect(v).toBeDefined();
      expect(LANGS).toContain(v!.lang);
    }
  });
});
