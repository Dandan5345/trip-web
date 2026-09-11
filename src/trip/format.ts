import type { Locale } from '../i18n/strings';

const LOCALE_TAG: Record<Locale, string> = { he: 'he-IL', en: 'en-GB' };

export function formatDate(date: Date | null, locale: Locale): string {
  if (!date) return '';
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatShortDate(date: Date | null, locale: Locale): string {
  if (!date) return '';
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatWeekday(date: Date | null, locale: Locale): string {
  if (!date) return '';
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { weekday: 'long' }).format(date);
}

export function formatDateSpan(start: Date | null, end: Date | null, locale: Locale): string {
  if (!start && !end) return '';
  if (start && end) return `${formatShortDate(start, locale)} – ${formatDate(end, locale)}`;
  return formatDate(start ?? end, locale);
}

export function formatMoney(
  amount: number | null,
  currencyCode: string | null,
  locale: Locale,
): string {
  if (amount == null) return '';
  try {
    return new Intl.NumberFormat(LOCALE_TAG[locale], {
      style: 'currency',
      currency: currencyCode ?? 'ILS',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // An unknown currency code should not blank out the price.
    return `${new Intl.NumberFormat(LOCALE_TAG[locale]).format(amount)} ${currencyCode ?? ''}`.trim();
  }
}

/** Whole calendar days from today, matching the app's countdown. */
export function calendarDaysUntil(date: Date | null): number | null {
  if (!date) return null;
  const today = new Date();
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b - a) / 86_400_000);
}

export function nightsBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null;
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const nights = Math.round((b - a) / 86_400_000);
  return nights > 0 ? nights : null;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` for date inputs, in local time. */
export function toDateInputValue(date: Date | null): string {
  if (!date) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The exact string shape `DateTime.toIso8601String()` writes for a *local*
 * DateTime: `2026-04-10T00:00:00.000`, with no `Z` and no offset.
 *
 * This matters. `toISOString()` would emit UTC, and `DateTime.parse` would
 * then hand the app a UTC DateTime whose `.day` is one lower for anyone east
 * of Greenwich — a trip would silently start a day early.
 */
export function fromDateInputValue(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${value}T00:00:00.000`;
}
