import dayjs from 'dayjs';

export const CURRENCY = 'JOD';

/** Avoid float artifacts like 22.400000000000002 in money fields. */
export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.round(amount * 100) / 100;
}

export function formatCurrency(amount: number, currencyLabel = CURRENCY): string {
  const normalized = roundMoney(amount);
  const sign = normalized >= 0 ? '' : '-';
  const formatted = Math.abs(normalized).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${formatted} ${currencyLabel}`;
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  return dayjs(iso).format('DD MMM YYYY');
}

export function formatTime(iso: string): string {
  if (!iso) return '—';
  return dayjs(iso).format('hh:mm A');
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return dayjs(iso).format('DD MMM YYYY, hh:mm A');
}

export function getNameInitials(name: string, maxLen = 2): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`;
  }
  return trimmed.slice(0, maxLen);
}

type RelativeTimeTranslator = (key: string, options?: {count?: number}) => string;

export function formatRelativeTime(iso: string | null | undefined, t: RelativeTimeTranslator): string {
  if (!iso) return t('financeNoActivityYet');
  const then = dayjs(iso);
  if (!then.isValid()) return t('financeNoActivityYet');

  const diffMinutes = dayjs().diff(then, 'minute');
  if (diffMinutes < 1) return t('timeJustNow');
  if (diffMinutes < 60) return t('timeMinutesAgo', {count: diffMinutes});
  const diffHours = dayjs().diff(then, 'hour');
  if (diffHours < 24) return t('timeHoursAgo', {count: diffHours});
  const diffDays = dayjs().diff(then, 'day');
  if (diffDays < 7) return t('timeDaysAgo', {count: diffDays});
  return formatDateTime(iso);
}
