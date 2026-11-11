import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('core stays pure', () => {
  const files = walk(new URL('.', import.meta.url).pathname).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  it('has source files to check', () => expect(files.length).toBeGreaterThan(20));
  it('imports no Node, network or DOM modules and touches no globals for them', () => {
    const banned = [
      /from ['"]node:/, /from ['"](fs|http|https|net|tls|dgram|child_process|ws|undici|axios)['"]/,
      /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bdocument\./, /\bwindow\./, /\bnavigator\./, /\blocalStorage\b/, /\bindexedDB\b/, /\bprocess\.env\b/,
    ];
    const hits: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
      src.forEach((line, i) => banned.forEach((re) => re.test(line) && hits.push(`${f}:${i + 1} ${re}`)));
    }
    expect(hits).toEqual([]);
  });
});
