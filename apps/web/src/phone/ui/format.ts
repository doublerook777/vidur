/** Indian digit grouping: 12000000 paise (₹1,20,000) -> '₹1,20,000'; 34000 -> '₹340'. */
export function formatRupees(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const rupees = Math.abs(Math.trunc(paise / 100));
  const s = String(rupees);
  if (s.length <= 3) return `${sign}₹${s}`;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return `${sign}₹${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
}

const LOCALE = { hi: 'hi-IN', en: 'en-IN', kn: 'kn-IN' } as const;
type L = keyof typeof LOCALE;
const IST = 'Asia/Kolkata';
const fmt = (lang: L, o: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => new Intl.DateTimeFormat(LOCALE[lang], { timeZone: IST, ...o });

/** "2:14 pm" */
export function formatTime(ms: number, lang: L): string {
  return fmt(lang, { hour: 'numeric', minute: '2-digit', hour12: true }).format(ms);
}
/** "11 Nov" */
export function formatDay(ms: number, lang: L): string {
  return fmt(lang, { day: 'numeric', month: lang === 'en' ? 'short' : 'long' }).format(ms);
}
/** "Wed, 11 Nov" */
export function formatDayLong(ms: number, lang: L): string {
  return fmt(lang, { weekday: 'short', day: 'numeric', month: lang === 'en' ? 'short' : 'long' }).format(ms);
}
/** The calendar day in IST as a number that sorts, e.g. 20261111. */
export function dayKey(ms: number): number {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
  return Number(p.replaceAll('-', ''));
}
/** The text under an entry's name: the time the money moved, plus the date unless it was today. */
export function formatWhen(at: number, now: number, lang: L): string {
  return dayKey(at) === dayKey(now) ? formatTime(at, lang) : `${formatTime(at, lang)} · ${formatDay(at, lang)}`;
}
/** True when the entry was written down on a different day from the one the money moved. */
export function isBackdated(at: number, recordedAt: number): boolean {
  return dayKey(at) !== dayKey(recordedAt);
}
/** A value for an `<input type="datetime-local">` in IST, and back. */
export function toLocalInput(ms: number): string {
  const d = new Intl.DateTimeFormat('sv-SE', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(ms);
  return d.replace(' ', 'T');
}
export function fromLocalInput(v: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const ms = Date.parse(`${v}:00+05:30`);
  return Number.isFinite(ms) ? ms : null;
}
