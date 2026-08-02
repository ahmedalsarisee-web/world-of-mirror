export const MIRROR_PRICING_ORDER_STATUSES = [
  'preparation',
  'ready_delivery',
  'ready_installation',
  'completed',
] as const;

export type MirrorPricingOrderStatus = (typeof MIRROR_PRICING_ORDER_STATUSES)[number];

export function resolveMirrorPricingOrderStatus(raw: unknown): MirrorPricingOrderStatus {
  if (
    raw === 'ready_delivery' ||
    raw === 'ready_installation' ||
    raw === 'completed' ||
    raw === 'preparation'
  ) {
    return raw;
  }
  return 'preparation';
}

export function getMirrorPricingOrderStatusTitleKey(status: MirrorPricingOrderStatus): string {
  switch (status) {
    case 'ready_delivery':
      return 'mirrorOrdersReadyDelivery';
    case 'ready_installation':
      return 'mirrorOrdersReadyInstallation';
    case 'completed':
      return 'mirrorOrdersCompleted';
    default:
      return 'mirrorOrdersConfirmed';
  }
}

export function getMirrorPricingOrderStatusEmptyKey(status: MirrorPricingOrderStatus): string {
  switch (status) {
    case 'ready_delivery':
      return 'mirrorOrdersReadyDeliveryEmpty';
    case 'ready_installation':
      return 'mirrorOrdersReadyInstallationEmpty';
    case 'completed':
      return 'mirrorOrdersCompletedEmpty';
    default:
      return 'mirrorOrdersEmpty';
  }
}

/** All move targets except the order's current status (always 3 of 4). */
export function getMirrorPricingOrderStatusAdvanceTargets(
  currentStatus: MirrorPricingOrderStatus,
): MirrorPricingOrderStatus[] {
  return MIRROR_PRICING_ORDER_STATUSES.filter((status) => status !== currentStatus);
}

export type MirrorPricingOrderMoveTarget = MirrorPricingOrderStatus | 'completed_outstanding';

export function resolveMirrorPricingOrderMoveTargetStatus(
  target: MirrorPricingOrderMoveTarget,
): MirrorPricingOrderStatus {
  return target === 'completed_outstanding' ? 'completed' : target;
}

export function getMirrorPricingOrderMoveTargetTitleKey(target: MirrorPricingOrderMoveTarget): string {
  if (target === 'completed_outstanding') {
    return 'mirrorOrdersCompletedOutstanding';
  }
  return getMirrorPricingOrderStatusTitleKey(target);
}

export function getMirrorPricingOrderStatusIcon(
  status: MirrorPricingOrderStatus,
): 'clipboard-list-outline' | 'truck-delivery-outline' | 'hammer-wrench' | 'check-decagram-outline' {
  switch (status) {
    case 'ready_delivery':
      return 'truck-delivery-outline';
    case 'ready_installation':
      return 'hammer-wrench';
    case 'completed':
      return 'check-decagram-outline';
    default:
      return 'clipboard-list-outline';
  }
}

export function getMirrorPricingOrderMoveTargetIcon(
  target: MirrorPricingOrderMoveTarget,
):
  | 'clipboard-list-outline'
  | 'truck-delivery-outline'
  | 'hammer-wrench'
  | 'check-decagram-outline'
  | 'hand-coin-outline' {
  if (target === 'completed_outstanding') {
    return 'hand-coin-outline';
  }
  return getMirrorPricingOrderStatusIcon(target);
}

export function getMirrorPricingOrderStatusAdvanceLabelKey(
  target: MirrorPricingOrderStatus,
): string {
  switch (target) {
    case 'preparation':
      return 'mirrorOrdersMoveToPreparation';
    case 'ready_delivery':
      return 'mirrorOrdersMoveToReadyDelivery';
    case 'ready_installation':
      return 'mirrorOrdersMoveToReadyInstallation';
    case 'completed':
      return 'mirrorOrdersMoveToCompleted';
    default:
      return 'mirrorOrdersMoveToCompleted';
  }
}
