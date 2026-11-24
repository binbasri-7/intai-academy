import type { Currency, Mark } from './types';

export const CURRENCY_LABEL: Record<Currency, string> = { SAR: 'ر.س', YER: 'ر.ي' };
export const CURRENCY_NAME: Record<Currency, string> = { SAR: 'ريال سعودي', YER: 'ريال يمني' };

export const num = (n: number | undefined | null) =>
  (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

export const money = (n: number | undefined | null, c: Currency) => `${num(n)} ${CURRENCY_LABEL[c]}`;

export const today = () => toISO(new Date());

export function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function fmtDate(s?: string) {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export const weekdayName = (s: string) => WEEKDAYS[fromISO(s).getDay()];

/** توليد تواريخ الأيام التدريبية من تاريخ البداية وأيام الأسبوع المختارة */
export function generateDates(start: string, count: number, weekdays: number[]) {
  if (!start || count < 1) return [];
  const days = weekdays.length ? weekdays : [0, 1, 2, 3, 4, 5, 6];
  const out: string[] = [];
  const d = fromISO(start);
  let guard = 0;
  while (out.length < count && guard < 2000) {
    if (days.includes(d.getDay())) out.push(toISO(d));
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return out;
}

export const MARKS: { key: Mark; label: string; short: string }[] = [
  { key: 'P', label: 'حاضر', short: 'ح' },
  { key: 'A', label: 'غائب', short: 'غ' },
  { key: 'L', label: 'متأخر', short: 'م' },
  { key: 'E', label: 'بعذر', short: 'ع' },
];
export const MARK_LABEL: Record<Mark, string> = { P: 'حاضر', A: 'غائب', L: 'متأخر', E: 'بعذر' };
export const MARK_SHORT: Record<Mark, string> = { P: 'ح', A: 'غ', L: 'م', E: 'ع' };

export const STATUS_LABEL = {
  open: 'التسجيل مفتوح',
  running: 'جارية',
  done: 'منتهية',
  cancelled: 'ملغاة',
} as const;

export const nowISO = () => new Date().toISOString();

export function accountTotals(a?: { price: number; discount: number; payments: { amount: number }[] }) {
  if (!a) return { due: 0, paid: 0, remaining: 0 };
  const due = Math.max(0, (Number(a.price) || 0) - (Number(a.discount) || 0));
  const paid = (a.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return { due, paid, remaining: due - paid };
}

export function normalize(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ً-ْ]/g, '')
    .trim();
}
