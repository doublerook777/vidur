import { describe, expect, it } from 'vitest';

import { pct, score, toMarkdown, type ScoreRecord } from './score.js';

function rec(partial: Partial<ScoreRecord> & Pick<ScoreRecord, 'id' | 'lang' | 'expected' | 'got'>): ScoreRecord {
  return {
    voice: 'test-voice',
    snr: 'clean',
    heard: `heard for ${partial.id}`,
    sttMs: 100,
    ...partial,
  };
}

describe('score()', () => {
  it('handles an empty set without dividing by zero', () => {
    const r = score([]);
    expect(r.overall.n).toBe(0);
    expect(r.overall.sttP50).toBeNull();
    expect(r.overall.sttP95).toBeNull();
    expect(r.cells).toEqual([]);
    expect(r.silentWrong).toBe(0);
    expect(pct(0, 0)).toBe('—');
  });

  it('computes metrics on a hand-computed set', () => {
    const records: ScoreRecord[] = [
      rec({
        id: 'A', lang: 'hi', snr: 'clean',
        expected: { intent: 'credit_entry', amount: 340 },
        got: { intent: 'credit_entry', amountPaise: 34000, needs: [] },
        sttMs: 100, e2eMs: 400,
      }),
      rec({
        id: 'B', lang: 'hi', snr: 'clean',
        expected: { intent: 'payment', amount: 200 },
        got: { intent: 'payment', needs: ['amount'] },
        sttMs: 200, e2eMs: 500,
      }),
      rec({
        id: 'C', lang: 'en', snr: 15,
        expected: { intent: 'credit_entry', amount: 275 },
        got: { intent: 'credit_entry', amountPaise: 17500, needs: [] },
        sttMs: 300, e2eMs: 600,
      }),
      rec({
        id: 'D', lang: 'en', snr: 15,
        expected: { intent: 'credit_entry', amount: 100 },
        got: null,
        sttMs: null, e2eMs: undefined,
      }),
    ];
    const r = score(records);

    expect(r.overall.n).toBe(4);
    expect(r.overall.intentRight).toBe(3); // A, B, C
    expect(r.overall.directionTotal).toBe(4);
    expect(r.overall.directionRight).toBe(3); // A, B, C
    expect(r.overall.amountTotal).toBe(4);
    expect(r.overall.amountExact).toBe(1); // A
    expect(r.overall.amountAsked).toBe(1); // B
    expect(r.overall.silentWrong).toBe(1); // C
    expect(r.overall.noResult).toBe(1); // D

    // nearest-rank percentiles over [100, 200, 300]
    expect(r.overall.sttP50).toBe(200);
    expect(r.overall.sttP95).toBe(300);
    // e2e present for A, B, C only: [400, 500, 600]
    expect(r.overall.e2eP50).toBe(500);
    expect(r.overall.e2eP95).toBe(600);

    // per-cell breakdown
    const hi = r.cells.find((c) => c.lang === 'hi' && c.snr === 'clean');
    const en = r.cells.find((c) => c.lang === 'en' && c.snr === '15');
    expect(hi?.metrics.n).toBe(2);
    expect(hi?.metrics.amountAsked).toBe(1);
    expect(en?.metrics.n).toBe(2);
    expect(en?.metrics.silentWrong).toBe(1);
    expect(en?.metrics.noResult).toBe(1);

    expect(r.silentWrongRecords.map((x) => x.id)).toEqual(['C']);
  });

  it('an amount need starting with "amount" disqualifies amountExact but counts as asked', () => {
    const records: ScoreRecord[] = [
      rec({
        id: 'E', lang: 'kn',
        expected: { intent: 'credit_entry', amount: 340 },
        got: { intent: 'credit_entry', amountPaise: 34000, needs: ['amount_confirm'] },
      }),
    ];
    const r = score(records);
    // correct amount BUT an amount* need present: not "exact", and not "asked"
    // (asked requires missing/wrong amount) — it is simply not counted as exact.
    expect(r.overall.amountExact).toBe(0);
    expect(r.overall.silentWrong).toBe(0);
    expect(r.overall.amountAsked).toBe(0);
  });

  it('wrong amount with an amount need is amountAsked, never silentWrong', () => {
    const records: ScoreRecord[] = [
      rec({
        id: 'F', lang: 'kn',
        expected: { intent: 'credit_entry', amount: 340 },
        got: { intent: 'credit_entry', amountPaise: 99900, needs: ['amount'] },
      }),
    ];
    const r = score(records);
    expect(r.overall.amountAsked).toBe(1);
    expect(r.overall.silentWrong).toBe(0);
  });

  it('missing amount with an amount need is amountAsked', () => {
    const records: ScoreRecord[] = [
      rec({
        id: 'G', lang: 'hinglish',
        expected: { intent: 'credit_entry', amount: 340 },
        got: { intent: 'credit_entry', needs: ['amount'] },
      }),
    ];
    expect(score(records).overall.amountAsked).toBe(1);
  });

  it('directionRight only counts credit_entry and payment expectations', () => {
    const records: ScoreRecord[] = [
      rec({ id: 'H', lang: 'en', expected: { intent: 'balance_query' }, got: { intent: 'balance_query', needs: [] } }),
      rec({ id: 'I', lang: 'en', expected: { intent: 'payment', amount: 100 }, got: { intent: 'credit_entry', amountPaise: 10000, needs: [] } }),
    ];
    const r = score(records);
    expect(r.overall.directionTotal).toBe(1);
    expect(r.overall.directionRight).toBe(0);
  });

  it('percentiles ignore null sttMs', () => {
    const records: ScoreRecord[] = [
      rec({ id: 'J', lang: 'en', expected: { intent: 'note' }, got: { intent: 'note', needs: [] }, sttMs: null }),
      rec({ id: 'K', lang: 'en', expected: { intent: 'note' }, got: { intent: 'note', needs: [] }, sttMs: 100 }),
      rec({ id: 'L', lang: 'en', expected: { intent: 'note' }, got: { intent: 'note', needs: [] }, sttMs: 300 }),
    ];
    const r = score(records);
    expect(r.overall.sttP50).toBe(100); // nearest-rank over [100, 300]: ceil(0.5*2)=1 -> 100
    expect(r.overall.sttP95).toBe(300);
  });
});

describe('pct()', () => {
  it('formats one decimal', () => {
    expect(pct(1, 3)).toBe('33.3%');
    expect(pct(2, 3)).toBe('66.7%');
    expect(pct(1, 1)).toBe('100.0%');
    expect(pct(0, 4)).toBe('0.0%');
  });
});

describe('toMarkdown()', () => {
  it('contains the overall table, the per-cell table, silent-wrong list and final count line', () => {
    const records: ScoreRecord[] = [
      rec({
        id: 'M', lang: 'hi', snr: 5,
        expected: { intent: 'credit_entry', amount: 275 },
        got: { intent: 'credit_entry', amountPaise: 17500, needs: [] },
        heard: 'mohan ka paune teen sau udhaar',
        sttMs: 500,
      }),
    ];
    const md = toMarkdown(score(records), 'Test report');
    expect(md).toContain('# Test report');
    expect(md).toContain('## Overall');
    expect(md).toContain('## By language × SNR');
    expect(md).toContain('## Silent wrongs');
    expect(md).toContain('id=M');
    expect(md).toMatch(/SILENT WRONG: 1\s*$/);
  });

  it('prints None. when there are no silent wrongs', () => {
    const records: ScoreRecord[] = [
      rec({ id: 'N', lang: 'en', expected: { intent: 'note' }, got: { intent: 'note', needs: [] } }),
    ];
    const md = toMarkdown(score(records), 'Clean');
    expect(md).toContain('None.');
    expect(md).toMatch(/SILENT WRONG: 0\s*$/);
  });
});
