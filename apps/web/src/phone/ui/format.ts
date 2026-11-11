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
