import type { Lang } from '../contract.js';
import { formatDay } from './format.js';
import { LABELS } from './labels.js';

/** "Sent 22 Nov · next 24 Nov" once a reminder was really sent; "Sent 22 Nov" when the next one is already allowed; null if none. */
export function reminderHint(last: number | null | undefined, next: number | null | undefined, now: number, lang: Lang): string | null {
  if (last === null || last === undefined) return null;
  const t = LABELS[lang];
  const sent = formatDay(last, lang);
  if (next === null || next === undefined || next <= now) return t.reminderSentOn.replace('{sent}', sent);
  return t.reminderSentNext.replace('{sent}', sent).replace('{next}', formatDay(next, lang));
}
