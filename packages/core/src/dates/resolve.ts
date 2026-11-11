/**
 * Relative date resolver for Asia/Kolkata (IST, UTC+5:30, no DST).
 * Pure TypeScript, no network, no DOM, no external date library.
 */

export type Tense = 'past' | 'future' | 'unknown';

/**
 * Ambiguity options. The two-way split for context-sensitive words:
 * - `kal` unknown -> ['yesterday', 'tomorrow']
 * - `parso`/`ಮೊನ್ನೆ` unknown -> ['day_before_yesterday', 'day_after_tomorrow']
 * - weekday name unknown -> ['previous_occurrence', 'next_occurrence']
 *   (the caller already knows the weekday from the input word)
 */
export type AmbiguousOption =
  | 'yesterday'
  | 'tomorrow'
  | 'day_before_yesterday'
  | 'day_after_tomorrow'
  | 'previous_occurrence'
  | 'next_occurrence';

export type DateResult =
  | { kind: 'resolved'; dayStartMs: number; token: string }
  | { kind: 'ambiguous'; options: AmbiguousOption[] }
  | { kind: 'none' };

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19_800_000, no DST in IST
const DAY_MS = 86_400_000;

/** Epoch ms of 00:00 IST of the IST calendar day containing `ms`. */
export function startOfDayIst(ms: number): number {
  return Math.floor((ms + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
}

/** Epoch ms of 00:00 IST, `n` IST days after the IST day containing `ms`. */
export function addDaysIst(ms: number, n: number): number {
  return startOfDayIst(ms) + n * DAY_MS;
}

function istDayOfWeek(dayStartMs: number): number {
  // dayStartMs + offset is the IST wall clock read as UTC; its UTC weekday is the IST weekday.
  return new Date(dayStartMs + IST_OFFSET_MS).getUTCDay();
}

function resolved(dayStartMs: number, token: string): DateResult {
  return { kind: 'resolved', dayStartMs, token };
}

const TODAY_WORDS = new Set(['aaj', 'आज', 'today', 'ಇಂದು']);
const KAL_WORDS = new Set(['kal', 'कल']);
const PARSO_WORDS = new Set(['parso', 'परसों', 'ಮೊನ್ನೆ']); // ಮೊನ್ನೆ = "day before yesterday"; tense-dependent like parso. ನಾಡಿದ್ದು (day after tomorrow) intentionally not mapped.
const DAY_BEFORE_WORDS = new Set(['day before yesterday', 'day before tomorrow']);
const DAY_AFTER_WORDS = new Set(['day after tomorrow']);
const LAST_WEEK_WORDS = new Set([
  'last week',
  'pichhle hafte',
  'pichle hafte',
  'pichhla hafta',
  'पिछले हफ्ते',
  'पिछले हफ़्ते',
]);

const WEEKDAY_INDEX: Record<string, number> = {
  // English
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  // Hindi romanized
  ravivar: 0, raviwar: 0, itvar: 0, itwar: 0,
  somvar: 1, somwar: 1,
  mangalvar: 2, mangalwar: 2,
  budhvar: 3, budhwar: 3,
  guruvar: 4, brihaspativar: 4,
  shukravar: 5, shukrawar: 5,
  shanivar: 6, shaniwar: 6,
  // Hindi Devanagari
  'रविवार': 0, 'इतवार': 0,
  'सोमवार': 1,
  'मंगलवार': 2,
  'बुधवार': 3,
  'गुरुवार': 4, 'बृहस्पतिवार': 4,
  'शुक्रवार': 5,
  'शनिवार': 6,
  // Kannada (ಸೋಮವಾರ=Mon … ರವಿವಾರ=Sun)
  'ರವಿವಾರ': 0,
  'ಸೋಮವಾರ': 1,
  'ಮಂಗಳವಾರ': 2,
  'ಬುಧವಾರ': 3,
  'ಗುರುವಾರ': 4,
  'ಶುಕ್ರವಾರ': 5,
  'ಶನಿವಾರ': 6,
};

const WEEKDAY_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function normalize(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolve a single spoken date word/phrase. Matches the whole (trimmed,
 * case-insensitive) phrase.
 */
export function resolveDate(word: string, tense: Tense, nowMs: number): DateResult {
  const w = normalize(word);
  if (w.length === 0) return { kind: 'none' };

  const today = startOfDayIst(nowMs);

  if (TODAY_WORDS.has(w)) return resolved(today, 'today');

  if (KAL_WORDS.has(w)) {
    if (tense === 'past') return resolved(addDaysIst(nowMs, -1), 'yesterday');
    if (tense === 'future') return resolved(addDaysIst(nowMs, 1), 'tomorrow');
    return { kind: 'ambiguous', options: ['yesterday', 'tomorrow'] };
  }

  if (w === 'yesterday' || w === 'ನಿನ್ನೆ') return resolved(addDaysIst(nowMs, -1), 'yesterday');
  if (w === 'tomorrow' || w === 'ನಾಳೆ') return resolved(addDaysIst(nowMs, 1), 'tomorrow');

  if (PARSO_WORDS.has(w)) {
    if (tense === 'past') return resolved(addDaysIst(nowMs, -2), 'day_before_yesterday');
    if (tense === 'future') return resolved(addDaysIst(nowMs, 2), 'day_after_tomorrow');
    return { kind: 'ambiguous', options: ['day_before_yesterday', 'day_after_tomorrow'] };
  }
  if (DAY_BEFORE_WORDS.has(w)) return resolved(addDaysIst(nowMs, -2), 'day_before_yesterday');
  if (DAY_AFTER_WORDS.has(w)) return resolved(addDaysIst(nowMs, 2), 'day_after_tomorrow');

  if (LAST_WEEK_WORDS.has(w)) return resolved(addDaysIst(nowMs, -7), 'last_week');

  const target = WEEKDAY_INDEX[w];
  if (target !== undefined) {
    const todayDow = istDayOfWeek(today);
    const name = WEEKDAY_EN[target];
    if (tense === 'past') {
      let diff = (todayDow - target + 7) % 7;
      if (diff === 0) diff = 7; // strictly before today
      return resolved(today - diff * DAY_MS, `weekday:${name}`);
    }
    if (tense === 'future') {
      let diff = (target - todayDow + 7) % 7;
      if (diff === 0) diff = 7; // strictly after today
      return resolved(today + diff * DAY_MS, `weekday:${name}`);
    }
    return { kind: 'ambiguous', options: ['previous_occurrence', 'next_occurrence'] };
  }

  return { kind: 'none' };
}
