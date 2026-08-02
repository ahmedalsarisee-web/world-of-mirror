import {roundMoney} from '@app/utils/format';

export type MirrorPricingThickness = '4mm' | '6mm';

export type MirrorPricingItemCategory = 'order' | 'extra';

export interface MirrorPricingCustomAddition {
  id: string;
  label: string;
  price: number;
  quantity?: number;
}

export function getCustomAdditionQuantity(entry: MirrorPricingCustomAddition): number {
  return Math.max(1, Math.round(entry.quantity ?? 1));
}

export function getCustomAdditionLineTotal(entry: MirrorPricingCustomAddition): number {
  return roundMoney(entry.price * getCustomAdditionQuantity(entry));
}
export interface MirrorPricingCartItem {
  id: string;
  lengthCm: number;
  widthCm: number;
  category: MirrorPricingItemCategory;
  optionId: string;
  labelKey: string;
  thickness: MirrorPricingThickness;
  unitPrice: number;
  quantity: number;
  note?: string;
  createdAt: string;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeMirrorPricingCartItem(raw: unknown): MirrorPricingCartItem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const id = String(data.id ?? '').trim();
  if (!id) {
    return null;
  }

  return {
    id,
    lengthCm: toFiniteNumber(data.lengthCm),
    widthCm: toFiniteNumber(data.widthCm),
    category: data.category === 'extra' ? 'extra' : 'order',
    optionId: String(data.optionId ?? ''),
    labelKey: String(data.labelKey ?? 'mirrorCartUnknownItem'),
    thickness: data.thickness === '6mm' ? '6mm' : '4mm',
    unitPrice: toFiniteNumber(data.unitPrice),
    quantity: Math.max(1, Math.round(toFiniteNumber(data.quantity, 1))),
    note: data.note ? String(data.note) : undefined,
    createdAt: String(data.createdAt ?? ''),
  };
}

export function normalizeMirrorPricingCustomAddition(raw: unknown): MirrorPricingCustomAddition | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const id = String(data.id ?? '').trim();
  const label = String(data.label ?? '').trim();
  if (!id || !label) {
    return null;
  }

  return {
    id,
    label,
    price: toFiniteNumber(data.price),
    quantity: Math.max(1, Math.round(toFiniteNumber(data.quantity, 1))),
  };
}

function getItemsSubtotal(items: MirrorPricingCartItem[]): number {
  const sum = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  return roundMoney(sum);
}

export function getMirrorPricingCustomAdditionsTotal(
  customAdditions: MirrorPricingCustomAddition[],
): number {
  if (customAdditions.length === 0) {
    return 0;
  }
  const sum = customAdditions.reduce((total, entry) => total + getCustomAdditionLineTotal(entry), 0);
  return roundMoney(sum);
}

export function getMirrorPricingCartSubtotal(
  items: MirrorPricingCartItem[],
  customAdditions: MirrorPricingCustomAddition[] = [],
): number {
  return roundMoney(getItemsSubtotal(items) + getMirrorPricingCustomAdditionsTotal(customAdditions));
}

export function normalizeCartTotalOverride(value: number, subtotal: number): number | null {
  if (subtotal <= 0) {
    return null;
  }
  const clamped = roundMoney(Math.min(subtotal, Math.max(0, value)));
  if (clamped >= subtotal) {
    return null;
  }
  return clamped;
}

export function getMirrorPricingCartEffectiveTotal(
  items: MirrorPricingCartItem[],
  cartTotalOverride: number | null | undefined,
  customAdditions: MirrorPricingCustomAddition[] = [],
): number {
  const subtotal = getMirrorPricingCartSubtotal(items, customAdditions);
  if (cartTotalOverride == null) {
    return subtotal;
  }
  return roundMoney(Math.min(subtotal, Math.max(0, cartTotalOverride)));
}

export function getMirrorPricingCartDiscount(
  items: MirrorPricingCartItem[],
  cartTotalOverride: number | null | undefined,
  customAdditions: MirrorPricingCustomAddition[] = [],
): number {
  const subtotal = getMirrorPricingCartSubtotal(items, customAdditions);
  const effectiveTotal = getMirrorPricingCartEffectiveTotal(items, cartTotalOverride, customAdditions);
  return roundMoney(Math.max(0, subtotal - effectiveTotal));
}

export function getMirrorPricingCartCount(items: MirrorPricingCartItem[]): number {
  return items.reduce((count, item) => count + item.quantity, 0);
}
