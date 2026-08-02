import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';

export function normalizeMirrorOrderInvoiceNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) {
    return undefined;
  }
  return Math.floor(n);
}

export function getMaxMirrorOrderInvoiceNumber(orders: MirrorPricingConfirmedOrder[]): number {
  return orders.reduce((max, order) => {
    const n = normalizeMirrorOrderInvoiceNumber(order.invoiceNumber);
    return n ? Math.max(max, n) : max;
  }, 0);
}

export function getNextMirrorOrderInvoiceNumber(orders: MirrorPricingConfirmedOrder[]): number {
  return getMaxMirrorOrderInvoiceNumber(orders) + 1;
}

/** Display label for UI and PDF, e.g. #42 */
export function formatMirrorOrderInvoiceLabel(invoiceNumber?: number): string | null {
  const n = normalizeMirrorOrderInvoiceNumber(invoiceNumber);
  if (!n) {
    return null;
  }
  return `#${n}`;
}
