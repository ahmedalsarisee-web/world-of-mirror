import type {MirrorPricingCartItem} from '@app/types/mirrorPricingCart';

export interface MirrorPricingConfirmedOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  collectedAmount: number;
  /** Sum of line items before discount. */
  subtotal?: number;
  /** Discount applied to reach total. */
  discountAmount?: number;
  total: number;
  remainingAmount?: number;
  items: MirrorPricingCartItem[];
  confirmedAt: string;
  confirmedByUserId?: string;
}

export function resolveConfirmedOrderRemaining(order: MirrorPricingConfirmedOrder): number {
  if (typeof order.remainingAmount === 'number' && !Number.isNaN(order.remainingAmount)) {
    return order.remainingAmount;
  }
  return Math.max(0, order.total - order.collectedAmount);
}

export function getConfirmedOrderLineTotal(item: MirrorPricingCartItem): number {
  return item.unitPrice * item.quantity;
}

export function resolveConfirmedOrderSubtotal(order: MirrorPricingConfirmedOrder): number {
  if (typeof order.subtotal === 'number' && !Number.isNaN(order.subtotal)) {
    return order.subtotal;
  }
  return order.items.reduce((sum, item) => sum + getConfirmedOrderLineTotal(item), 0);
}

export function resolveConfirmedOrderDiscount(order: MirrorPricingConfirmedOrder): number {
  if (typeof order.discountAmount === 'number' && !Number.isNaN(order.discountAmount)) {
    return Math.max(0, order.discountAmount);
  }
  return Math.max(0, resolveConfirmedOrderSubtotal(order) - order.total);
}
