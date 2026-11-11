import { describe, expect, it } from 'vitest';

import { dayKey, formatDay, formatTime, formatWhen, fromLocalInput, isBackdated, toLocalInput } from './format.js';

// Wed 11 Nov 2026, 14:30 in India (09:00 UTC)
const NOW = Date.UTC(2026, 10, 11, 9, 0);

describe('dates are shown in India time', () => {
  it('formats a time with am or pm', () => {
    expect(formatTime(NOW, 'en')).toMatch(/2:30\s?pm/i);
  });
  it('shows only the time for today and the date too for another day', () => {
    expect(formatWhen(NOW - 3600e3, NOW, 'en')).not.toContain('·');
    expect(formatWhen(NOW - 26 * 3600e3, NOW, 'en')).toContain('·');
    expect(formatWhen(NOW - 26 * 3600e3, NOW, 'en')).toContain('10 Nov');
  });
  it('names the month in full for Hindi and Kannada, short for English', () => {
    expect(formatDay(NOW, 'en')).toBe('11 Nov');
    expect(formatDay(NOW, 'hi')).toContain('नवंबर');
    expect(formatDay(NOW, 'kn').length).toBeGreaterThan(5);
  });
  it('a time after midnight India time belongs to the next India day', () => {
    // 19:00 UTC on the 11th is 00:30 on the 12th in India
    expect(dayKey(Date.UTC(2026, 10, 11, 19, 0))).toBe(20261112);
    expect(dayKey(Date.UTC(2026, 10, 11, 18, 0))).toBe(20261111);
  });
  it('spots an entry written down on a different day from the one it is for', () => {
    expect(isBackdated(NOW - 2 * 86_400_000, NOW)).toBe(true);
    expect(isBackdated(NOW - 3600e3, NOW)).toBe(false);
  });
  it('round-trips a date-time input as India time', () => {
    expect(toLocalInput(NOW)).toBe('2026-11-11T14:30');
    expect(fromLocalInput('2026-11-11T14:30')).toBe(NOW);
    expect(fromLocalInput('not a date')).toBeNull();
    expect(fromLocalInput('')).toBeNull();
  });
});
