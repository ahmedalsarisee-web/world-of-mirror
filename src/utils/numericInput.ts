import {roundMoney} from '@app/utils/format';

/** Eastern Arabic (٠-٩) and Persian (۰-۹) digits → Western 0-9 */
export function toWesternDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F6]/g, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) {
      return String(code - 0x0660);
    }
    return String(code - 0x06f0);
  });
}

export function formatNumericDisplay(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (value === 0 || value === '0') {
    return '';
  }
  if (typeof value === 'number') {
    const rounded = roundMoney(value);
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  }
  return String(value);
}

export function parseNumericInput(text: string): number {
  const trimmed = toWesternDigits(text).trim().replace(/,/g, '.');
  if (trimmed === '' || trimmed === '.') {
    return 0;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sanitizeNumericText(text: string): string {
  const normalized = toWesternDigits(text).replace(/,/g, '.');
  const cleaned = normalized.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) {
    return cleaned;
  }
  const before = cleaned.slice(0, firstDot);
  const after = cleaned.slice(firstDot + 1).replace(/\./g, '');
  return after.length > 0 || cleaned.endsWith('.') ? `${before}.${after}` : before;
}
