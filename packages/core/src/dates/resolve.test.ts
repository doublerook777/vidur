import { describe, expect, it } from 'vitest';

import { addDaysIst, resolveDate, startOfDayIst } from './resolve.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
/** Epoch ms of 00:00 IST on the given IST calendar date. */
function istMidnight(y: number, mo1: number, d: number): number {
  return Date.UTC(y, mo1 - 1, d) - IST_OFFSET_MS;
}
/** Epoch ms of an IST wall-clock time. */
function ist(y: number, mo1: number, d: number, h: number, mi: number): number {
  return Date.UTC(y, mo1 - 1, d, h, mi) - IST_OFFSET_MS;
}

describe('startOfDayIst', () => {
  it('handles 23:59 IST (still the same IST day)', () => {
    const now = ist(2026, 11, 10, 23, 59); // = 2026-11-10T18:29:00Z
    expect(startOfDayIst(now)).toBe(istMidnight(2026, 11, 10));
  });
  it('handles 00:01 IST (the new IST day)', () => {
    const now = ist(2026, 11, 11, 0, 1); // = 2026-11-10T18:31:00Z
    expect(startOfDayIst(now)).toBe(istMidnight(2026, 11, 11));
  });
  it('is expressed in UTC correctly', () => {
    expect(istMidnight(2026, 11, 11)).toBe(Date.UTC(2026, 10, 10, 18, 30));
  });
});

describe('addDaysIst', () => {
  it('crosses a month boundary (31 Jan + 1 day = 1 Feb)', () => {
    expect(addDaysIst(ist(2026, 1, 31, 12, 0), 1)).toBe(istMidnight(2026, 2, 1));
  });
  it('crosses a year boundary (31 Dec 2026 + 1 day = 1 Jan 2027)', () => {
    expect(addDaysIst(ist(2026, 12, 31, 12, 0), 1)).toBe(istMidnight(2027, 1, 1));
  });
  it('handles the leap day (2028-02-28 + 1 = 2028-02-29)', () => {
    expect(addDaysIst(ist(2028, 2, 28, 12, 0), 1)).toBe(istMidnight(2028, 2, 29));
  });
  it('handles the leap day + 1 (2028-02-29 + 1 = 2028-03-01)', () => {
    expect(addDaysIst(ist(2028, 2, 29, 12, 0), 1)).toBe(istMidnight(2028, 3, 1));
  });
});

const NOW = ist(2026, 11, 11, 12, 0); // Wednesday 2026-11-11, noon IST

describe('resolveDate — today', () => {
  for (const w of ['aaj', 'आज', 'today', 'ಇಂದು', '  AaJ  ', 'TODAY']) {
    it(`"${w}" = today`, () => {
      expect(resolveDate(w, 'unknown', NOW)).toEqual({
        kind: 'resolved',
        dayStartMs: istMidnight(2026, 11, 11),
        token: 'today',
      });
    });
  }
});

describe('resolveDate — kal / कल (tense-sensitive)', () => {
  for (const w of ['kal', 'कल', ' Kal ']) {
    it(`"${w}" past -> yesterday`, () => {
      expect(resolveDate(w, 'past', NOW)).toEqual({
        kind: 'resolved',
        dayStartMs: istMidnight(2026, 11, 10),
        token: 'yesterday',
      });
    });
    it(`"${w}" future -> tomorrow`, () => {
      expect(resolveDate(w, 'future', NOW)).toEqual({
        kind: 'resolved',
        dayStartMs: istMidnight(2026, 11, 12),
        token: 'tomorrow',
      });
    });
    it(`"${w}" unknown -> ambiguous`, () => {
      expect(resolveDate(w, 'unknown', NOW)).toEqual({
        kind: 'ambiguous',
        options: ['yesterday', 'tomorrow'],
      });
    });
  }
});

describe('resolveDate — fixed yesterday / tomorrow', () => {
  for (const w of ['yesterday', 'ನಿನ್ನೆ']) {
    it(`"${w}" = yesterday (even with future tense)`, () => {
      expect(resolveDate(w, 'future', NOW)).toEqual({
        kind: 'resolved',
        dayStartMs: istMidnight(2026, 11, 10),
        token: 'yesterday',
      });
    });
  }
  for (const w of ['tomorrow', 'ನಾಳೆ']) {
    it(`"${w}" = tomorrow (even with past tense)`, () => {
      expect(resolveDate(w, 'past', NOW)).toEqual({
        kind: 'resolved',
        dayStartMs: istMidnight(2026, 11, 12),
        token: 'tomorrow',
      });
    });
  }
});

describe('resolveDate — parso (tense-sensitive)', () => {
  for (const w of ['parso', 'परसों', 'ಮೊನ್ನೆ', ' PARSO ']) {
    it(`"${w}" past -> day before yesterday`, () => {
      expect(resolveDate(w, 'past', NOW)).toEqual({
        kind: 'resolved',
        dayStartMs: istMidnight(2026, 11, 9),
        token: 'day_before_yesterday',
      });
    });
    it(`"${w}" future -> day after tomorrow`, () => {
      expect(resolveDate(w, 'future', NOW)).toEqual({
        kind: 'resolved',
        dayStartMs: istMidnight(2026, 11, 13),
        token: 'day_after_tomorrow',
      });
    });
    it(`"${w}" unknown -> ambiguous`, () => {
      expect(resolveDate(w, 'unknown', NOW)).toEqual({
        kind: 'ambiguous',
        options: ['day_before_yesterday', 'day_after_tomorrow'],
      });
    });
  }
  it('"day before yesterday" is fixed past', () => {
    expect(resolveDate('day before yesterday', 'future', NOW)).toEqual({
      kind: 'resolved',
      dayStartMs: istMidnight(2026, 11, 9),
      token: 'day_before_yesterday',
    });
  });
  it('"day after tomorrow" is fixed future', () => {
    expect(resolveDate('day after tomorrow', 'past', NOW)).toEqual({
      kind: 'resolved',
      dayStartMs: istMidnight(2026, 11, 13),
      token: 'day_after_tomorrow',
    });
  });
});

describe('resolveDate — last week', () => {
  for (const w of ['pichhle hafte', 'पिछले हफ्ते', 'pichle hafte', 'pichhla hafta', 'last week']) {
    it(`"${w}" = 7 days ago`, () => {
      expect(resolveDate(w, 'past', NOW)).toEqual({
        kind: 'resolved',
        dayStartMs: istMidnight(2026, 11, 4),
        token: 'last_week',
      });
    });
  }
});

describe('resolveDate — weekday names', () => {
  // NOW is Wednesday 2026-11-11. Tuesday before = 2026-11-10, Tuesday after = 2026-11-17.
  const cases: Array<[string, number, string]> = [
    ['monday', 1, 'monday'], ['somvar', 1, 'monday'], ['somwar', 1, 'monday'], ['सोमवार', 1, 'monday'], ['ಸೋಮವಾರ', 1, 'monday'],
    ['tuesday', 2, 'tuesday'], ['mangalvar', 2, 'tuesday'], ['mangalwar', 2, 'tuesday'], ['मंगलवार', 2, 'tuesday'], ['ಮಂಗಳವಾರ', 2, 'tuesday'],
    ['wednesday', 3, 'wednesday'], ['budhvar', 3, 'wednesday'], ['budhwar', 3, 'wednesday'], ['बुधवार', 3, 'wednesday'], ['ಬುಧವಾರ', 3, 'wednesday'],
    ['thursday', 4, 'thursday'], ['guruvar', 4, 'thursday'], ['बृहस्पतिवार', 4, 'thursday'], ['गुरुवार', 4, 'thursday'], ['ಗುರುವಾರ', 4, 'thursday'],
    ['friday', 5, 'friday'], ['shukravar', 5, 'friday'], ['shukrawar', 5, 'friday'], ['शुक्रवार', 5, 'friday'], ['ಶುಕ್ರವಾರ', 5, 'friday'],
    ['saturday', 6, 'saturday'], ['shanivar', 6, 'saturday'], ['शनिवार', 6, 'saturday'], ['ಶನಿವಾರ', 6, 'saturday'],
    ['sunday', 0, 'sunday'], ['ravivar', 0, 'sunday'], ['itwar', 0, 'sunday'], ['रविवार', 0, 'sunday'], ['ರವಿವಾರ', 0, 'sunday'],
  ];
  for (const [w, dow, en] of cases) {
    const todayDow = 3; // Wednesday
    const pastDiff = ((todayDow - dow + 7) % 7) || 7;
    const futureDiff = ((dow - todayDow + 7) % 7) || 7;
    it(`"${w}" past -> most recent strictly before today`, () => {
      expect(resolveDate(w, 'past', NOW)).toEqual({
        kind: 'resolved',
        dayStartMs: istMidnight(2026, 11, 11) - pastDiff * DAY_MS,
        token: `weekday:${en}`,
      });
    });
    it(`"${w}" future -> next strictly after today`, () => {
      expect(resolveDate(w, 'future', NOW)).toEqual({
        kind: 'resolved',
        dayStartMs: istMidnight(2026, 11, 11) + futureDiff * DAY_MS,
        token: `weekday:${en}`,
      });
    });
    it(`"${w}" unknown -> ambiguous`, () => {
      expect(resolveDate(w, 'unknown', NOW)).toEqual({
        kind: 'ambiguous',
        options: ['previous_occurrence', 'next_occurrence'],
      });
    });
  }

  it('same weekday as today: past is a week ago, future is a week ahead', () => {
    // Monday 2026-01-05, word "monday"
    const monday = ist(2026, 1, 5, 10, 0);
    expect(resolveDate('monday', 'past', monday)).toEqual({
      kind: 'resolved',
      dayStartMs: istMidnight(2025, 12, 29),
      token: 'weekday:monday',
    });
    expect(resolveDate('monday', 'future', monday)).toEqual({
      kind: 'resolved',
      dayStartMs: istMidnight(2026, 1, 12),
      token: 'weekday:monday',
    });
  });

  it('weekday match is case-insensitive and trims whitespace', () => {
    expect(resolveDate('  MONDAY ', 'past', ist(2026, 1, 5, 10, 0))).toEqual({
      kind: 'resolved',
      dayStartMs: istMidnight(2025, 12, 29),
      token: 'weekday:monday',
    });
  });
});

describe('resolveDate — none', () => {
  for (const w of ['', '   ', 'blah', 'next week', 'kal kal', '32']) {
    it(`"${w}" -> none`, () => {
      expect(resolveDate(w, 'unknown', NOW)).toEqual({ kind: 'none' });
    });
  }
});

describe('resolveDate — IST edges around interpretation', () => {
  it('a UTC instant just before IST midnight resolves "aaj" to the previous IST day', () => {
    const now = Date.UTC(2026, 10, 10, 18, 29); // 2026-11-10 23:59 IST
    expect(resolveDate('aaj', 'unknown', now)).toEqual({
      kind: 'resolved',
      dayStartMs: istMidnight(2026, 11, 10),
      token: 'today',
    });
  });
  it('a UTC instant just after IST midnight resolves "aaj" to the new IST day', () => {
    const now = Date.UTC(2026, 10, 10, 18, 31); // 2026-11-11 00:01 IST
    expect(resolveDate('aaj', 'unknown', now)).toEqual({
      kind: 'resolved',
      dayStartMs: istMidnight(2026, 11, 11),
      token: 'today',
    });
  });
});
