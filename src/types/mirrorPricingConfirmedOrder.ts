import type {MirrorPricingCartItem, MirrorPricingCustomAddition} from '@app/types/mirrorPricingCart';
import {getCustomAdditionLineTotal} from '@app/types/mirrorPricingCart';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import type {UserRole} from '@app/types/models';
import type {CatalogMirrorImageAnnotationData} from '@app/utils/catalogImageTextAnnotations';
import type {ConfirmedOrderListBucket} from '@app/utils/confirmedOrderListBucket';
import type {InvoiceExportExtraLine} from '@app/types/invoiceExportExtraLine';
import type {OrderFulfillmentType} from '@app/types/orderFulfillmentType';
import {roundMoney} from '@app/utils/format';

export interface MirrorPricingConfirmedOrder {
  id: string;
  /** System invoice sequence, shown as #123 */
  invoiceNumber?: number;
  customerName: string;
  customerPhone: string;
  /** How the customer receives the order: showroom pickup, delivery, or delivery + installation. */
  fulfillmentType?: OrderFulfillmentType;
  customerPhone2?: string;
  customerLocation: string;
  customerNotes?: string;
  customerPhotosLink?: string;
  /** Selected mirror catalog image filenames bundled with the order. */
  catalogMirrorImages?: string[];
  /** Text overlays (JSON in Firestore — original catalog image unchanged). */
  catalogMirrorImageAnnotationData?: CatalogMirrorImageAnnotationData;
  /** Custom photos uploaded from the device gallery (Firebase Storage URLs). */
  studioOrderImages?: string[];
  /** Manual piece count when the order has no cart line items. */
  pieceCount?: number;
  collectedAmount: number;
  /** Sum of line items before discount. */
  subtotal?: number;
  /** Discount applied to reach total. */
  discountAmount?: number;
  total: number;
  remainingAmount?: number;
  items: MirrorPricingCartItem[];
  customAdditions?: MirrorPricingCustomAddition[];
  confirmedAt: string;
  /** When the order last entered its current status (move-to-card time). */
  statusChangedAt?: string;
  /** Employee who last moved the order to another card/section. */
  lastMovedByUserId?: string;
  lastMovedByUserName?: string;
  /** Human-readable card/section labels at move time (for notifications). */
  lastMovedFromLabel?: string;
  lastMovedToLabel?: string;
  confirmedByUserId?: string;
  confirmedByUserName?: string;
  confirmedByUserRole?: UserRole;
  status?: MirrorPricingOrderStatus;
  /** When set, the order lives in a custom orders home card (separate from built-in status sections). */
  homeCardId?: string;
  /** Pinned to the top of its section when true. */
  isFavorite?: boolean;
  /** When the order was last marked favorite (for ordering among favorites). */
  favoritedAt?: string;
  /** Completed without full payment — show alert badge and follow-up note. */
  paymentFollowUpRequired?: boolean;
  /** Note entered when the order was moved without full payment. */
  paymentFollowUpNote?: string;
  /** When the payment follow-up flag was set (sorting among flagged orders). */
  paymentFollowUpAt?: string;
  /** Internal note on the order card. */
  orderCardNote?: string;
  /** Collected amount recorded before marking the order fully paid on completion. */
  priorCollectedAmount?: number;
  /** Denormalized section key for paginated Firestore queries. */
  listBucket?: ConfirmedOrderListBucket;
  /** Denormalized balance flag for outstanding-only queries. */
  hasOutstandingBalance?: boolean;
  /** False when the order is completed — used for active-order queries. */
  isOrderActive?: boolean;
  /** Manual invoice line items entered when the order was created. */
  invoiceExtraLines?: InvoiceExportExtraLine[];
  /** Optional note printed on the customer invoice PDF. */
  invoiceNote?: string;
  /** Bumps on every persisted edit — used to refresh lists without a status move. */
  lastUpdatedAt?: string;
}

export function hasOrderInvoiceExtraLines(order: MirrorPricingConfirmedOrder): boolean {
  return (order.invoiceExtraLines?.length ?? 0) > 0;
}

export function resolveConfirmedOrderStatusChangedAt(order: MirrorPricingConfirmedOrder): string {
  return order.statusChangedAt || order.confirmedAt || '';
}

export function hasPaymentFollowUp(order: MirrorPricingConfirmedOrder): boolean {
  return order.paymentFollowUpRequired === true;
}

export function shouldPersistImageAnnotationsForOrderStatus(
  _status: MirrorPricingOrderStatus | undefined,
): boolean {
  return true;
}

export function hasActiveOrderCardNote(order: MirrorPricingConfirmedOrder): boolean {
  return Boolean(order.orderCardNote?.trim());
}

export function shouldSnapshotPriorCollectedAmount(order: MirrorPricingConfirmedOrder): boolean {
  const prior = roundMoney(order.collectedAmount);
  const total = roundMoney(order.total);
  return prior > 0 && prior < total;
}

export function resolvePriorCollectedAmount(order: MirrorPricingConfirmedOrder): number | undefined {
  if (resolveMirrorPricingOrderStatus(order.status) !== 'completed') {
    return undefined;
  }
  const value = order.priorCollectedAmount;
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return undefined;
  }
  return roundMoney(value);
}

export function sortConfirmedOrdersByStatusChangedAt(
  orders: MirrorPricingConfirmedOrder[],
): MirrorPricingConfirmedOrder[] {
  return [...orders].sort((a, b) => {
    const aFollowUp = hasPaymentFollowUp(a);
    const bFollowUp = hasPaymentFollowUp(b);
    if (aFollowUp !== bFollowUp) {
      return aFollowUp ? -1 : 1;
    }
    if (aFollowUp && bFollowUp) {
      const byFollowUpAt = (b.paymentFollowUpAt || '').localeCompare(a.paymentFollowUpAt || '');
      if (byFollowUpAt !== 0) {
        return byFollowUpAt;
      }
    }

    const aFavorite = Boolean(a.isFavorite);
    const bFavorite = Boolean(b.isFavorite);
    if (aFavorite !== bFavorite) {
      return aFavorite ? -1 : 1;
    }
    if (aFavorite && bFavorite) {
      const byFavoritedAt = (b.favoritedAt || '').localeCompare(a.favoritedAt || '');
      if (byFavoritedAt !== 0) {
        return byFavoritedAt;
      }
    }
    return resolveConfirmedOrderStatusChangedAt(b).localeCompare(resolveConfirmedOrderStatusChangedAt(a));
  });
}

export function resolveConfirmedOrderRemaining(order: MirrorPricingConfirmedOrder): number {
  if (typeof order.remainingAmount === 'number' && !Number.isNaN(order.remainingAmount)) {
    return order.remainingAmount;
  }
  return Math.max(0, order.total - order.collectedAmount);
}

export function hasConfirmedOrderOutstandingBalance(order: MirrorPricingConfirmedOrder): boolean {
  return resolveConfirmedOrderRemaining(order) > 0;
}

export function isCompletedOrderWithOutstandingBalance(order: MirrorPricingConfirmedOrder): boolean {
  return (
    resolveMirrorPricingOrderStatus(order.status) === 'completed' &&
    hasConfirmedOrderOutstandingBalance(order)
  );
}

export function resolveConfirmedOrderPieceCount(order: MirrorPricingConfirmedOrder): number {
  const fromItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (fromItems > 0) {
    return fromItems;
  }
  const manual = order.pieceCount;
  if (typeof manual === 'number' && manual > 0 && !Number.isNaN(manual)) {
    return Math.round(manual);
  }
  const fromInvoiceLines = order.invoiceExtraLines?.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  if (fromInvoiceLines > 0) {
    return Math.round(fromInvoiceLines);
  }
  return 0;
}

export function getConfirmedOrderLineTotal(item: MirrorPricingCartItem): number {
  return item.unitPrice * item.quantity;
}

export function getConfirmedOrderCustomAdditionsTotal(
  customAdditions: MirrorPricingCustomAddition[] | undefined,
): number {
  if (!customAdditions?.length) {
    return 0;
  }
  return customAdditions.reduce((sum, entry) => sum + getCustomAdditionLineTotal(entry), 0);
}

export function resolveConfirmedOrderSubtotal(order: MirrorPricingConfirmedOrder): number {
  if (typeof order.subtotal === 'number' && !Number.isNaN(order.subtotal)) {
    return order.subtotal;
  }
  const itemsTotal = order.items.reduce((sum, item) => sum + getConfirmedOrderLineTotal(item), 0);
  return itemsTotal + getConfirmedOrderCustomAdditionsTotal(order.customAdditions);
}

export function resolveConfirmedOrderDiscount(order: MirrorPricingConfirmedOrder): number {
  if (typeof order.discountAmount === 'number' && !Number.isNaN(order.discountAmount)) {
    return Math.max(0, order.discountAmount);
  }
  return Math.max(0, resolveConfirmedOrderSubtotal(order) - order.total);
}
