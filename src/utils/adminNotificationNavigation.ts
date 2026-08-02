import type {TFunction} from 'i18next';
import i18n from '@app/I18n';
import {navigationRef} from '@app/RootNavigation';
import {getOrdersHomeCardsSnapshot} from '@app/hooks/useOrdersHomeCards';
import type {AdminNotificationRecord} from '@app/stores/adminNotificationStore';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import {useAuthStore} from '@app/stores/authStore';
import type {MainTabParamList} from '@app/types/navigation';
import {resolveOrdersHomeCards} from '@app/types/ordersHomeCard';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {
  findBuiltinOrdersHomeCard,
  findOrdersHomeCardByStoredLabel,
} from '@app/utils/ordersHomeCardLabels';
import {
  type OrderSearchNavigationTarget,
  resolveOrderSearchNavigation,
  resolveOrdersHomeCardNavigationTarget,
} from '@app/utils/ordersHomeCardNavigation';
import {canAccessEmployeeManagement} from '@app/utils/adminPermissions';
import {
  canAccessFinanceTab,
  canViewEmployeeAttendance,
} from '@app/utils/employeePermissions';
import {openStandaloneOrderModal} from '@app/stores/standaloneOrderModalStore';
import {navigateToFinanceNotificationTarget} from '@app/utils/resolveFinanceNotificationTarget';
import {buildFinanceMetadataFromPushData} from '@app/utils/adminNotificationPushData';

function resolveNotificationOrderId(item: AdminNotificationRecord): string | undefined {
  return (
    item.metadata?.confirmedOrder?.orderId ??
    item.metadata?.orderMove?.orderId ??
    item.metadata?.orderUpdated?.orderId
  );
}

function openOrderNotificationStandalone(item: AdminNotificationRecord): boolean {
  const orderId = resolveNotificationOrderId(item);
  if (!orderId) {
    return false;
  }
  void openStandaloneOrderModal(orderId);
  return true;
}

function navigateMainTabScreen(
  tab: keyof MainTabParamList,
  screen: string,
  params?: object,
): void {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate(
    'Main',
    {
      screen: tab,
      params: {
        screen,
        params,
      },
    } as never,
  );
}

function navigateToPricingTarget(target: OrderSearchNavigationTarget): void {
  navigateMainTabScreen('PricingTab', target.screen, target.params);
}

function resolveOrderNotificationTarget(
  options: {
    orderId?: string;
    homeCardId?: string;
    status?: MirrorPricingOrderStatus;
    sectionLabel?: string;
    focusOrder?: boolean;
  },
  t: TFunction,
): OrderSearchNavigationTarget | undefined {
  const homeCards = resolveOrdersHomeCards(getOrdersHomeCardsSnapshot(), t);
  const focusOrderId = options.focusOrder !== false ? options.orderId : undefined;

  if (options.orderId) {
    const liveOrder = useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.find((entry) => entry.id === options.orderId);
    if (liveOrder) {
      return resolveOrderSearchNavigation(liveOrder);
    }
  }

  if (options.homeCardId) {
    const card = homeCards.find((entry) => entry.id === options.homeCardId);
    if (card) {
      return resolveOrdersHomeCardNavigationTarget(card, focusOrderId);
    }
  }

  if (options.sectionLabel) {
    const card = findOrdersHomeCardByStoredLabel(options.sectionLabel, homeCards, t);
    if (card) {
      return resolveOrdersHomeCardNavigationTarget(card, focusOrderId);
    }
  }

  if (options.status) {
    const status = resolveMirrorPricingOrderStatus(options.status);
    const targetCard =
      status === 'completed'
        ? findBuiltinOrdersHomeCard(homeCards, 'completed')
        : findBuiltinOrdersHomeCard(homeCards, status);
    if (targetCard) {
      return resolveOrdersHomeCardNavigationTarget(targetCard, focusOrderId);
    }
  }

  if (options.orderId) {
    return {
      screen: 'ConfirmedOrders',
      params: {focusOrderId: options.orderId},
    };
  }

  return undefined;
}

function navigateFinanceNotification(item: AdminNotificationRecord): boolean {
  const meta = item.metadata?.finance;
  if (!meta?.accountUserId) {
    return false;
  }

  const viewer = useAuthStore.getState().user;
  if (!canAccessFinanceTab(viewer)) {
    return false;
  }

  return navigateToFinanceNotificationTarget(meta);
}

function navigateAttendanceNotification(item: AdminNotificationRecord): boolean {
  const meta = item.metadata?.attendance;
  if (!meta?.employeeUserId) {
    return false;
  }

  const viewer = useAuthStore.getState().user;
  if (!viewer?.id) {
    return false;
  }

  if (viewer.role === 'admin' && canAccessEmployeeManagement(viewer)) {
    navigateMainTabScreen('EmployeesTab', 'EmployeeAttendance', {
      userId: meta.employeeUserId,
      userName: meta.employeeName,
    });
    return true;
  }

  if (canViewEmployeeAttendance(viewer)) {
    navigateMainTabScreen('AttendanceTab', 'EmployeeAttendanceView', {
      userId: meta.employeeUserId,
      userName: meta.employeeName,
    });
    return true;
  }

  if (meta.employeeUserId === viewer.id) {
    navigateMainTabScreen('AttendanceTab', 'MyAttendance');
    return true;
  }

  return false;
}

function navigateOrderNotification(item: AdminNotificationRecord, t: TFunction): boolean {
  if (item.kind === 'confirmed_order' || item.kind === 'order_moved' || item.kind === 'order_updated') {
    return openOrderNotificationStandalone(item);
  }

  const deleted = item.metadata?.orderDeleted;
  if (item.kind === 'order_deleted' && deleted) {
    const homeCards = resolveOrdersHomeCards(getOrdersHomeCardsSnapshot(), t);
    if (
      resolveMirrorPricingOrderStatus(deleted.status) === 'completed' &&
      deleted.remainingAmount > 0 &&
      !deleted.homeCardId
    ) {
      const outstandingCard = findBuiltinOrdersHomeCard(homeCards, 'completed_outstanding');
      const outstandingTarget = outstandingCard
        ? resolveOrdersHomeCardNavigationTarget(outstandingCard)
        : undefined;
      if (outstandingTarget) {
        navigateToPricingTarget(outstandingTarget);
        return true;
      }
    }

    const target = resolveOrderNotificationTarget(
      {
        homeCardId: deleted.homeCardId,
        status: deleted.status,
        sectionLabel: deleted.statusLabel,
        focusOrder: false,
      },
      t,
    );
    if (target) {
      navigateToPricingTarget(target);
      return true;
    }
  }

  return false;
}

export function navigateFromAdminNotification(item: AdminNotificationRecord): boolean {
  const t = i18n.t.bind(i18n);

  switch (item.kind) {
    case 'finance':
      return navigateFinanceNotification(item);
    case 'attendance':
      return navigateAttendanceNotification(item);
    case 'confirmed_order':
    case 'order_moved':
    case 'order_updated':
    case 'order_deleted':
      return navigateOrderNotification(item, t);
    case 'mirror_warehouse':
      navigateMainTabScreen('PricingTab', 'MirrorWarehouse');
      return true;
    default:
      return false;
  }
}

/** Best-effort destination when metadata is incomplete (e.g. push payload). */
export function navigateFromAdminNotificationFallback(
  kind: AdminNotificationRecord['kind'],
  data: Record<string, unknown>,
): boolean {
  const t = i18n.t.bind(i18n);
  const orderId = data.orderId ? String(data.orderId) : undefined;

  if (kind === 'finance' && data.userId) {
    const metadata = buildFinanceMetadataFromPushData(data);
    if (!metadata?.finance) {
      return false;
    }
    return navigateToFinanceNotificationTarget(metadata.finance);
  }

  if (kind === 'attendance' && data.userId) {
    return navigateFromAdminNotification({
      id: '',
      title: '',
      body: '',
      kind: 'attendance',
      receivedAt: Date.now(),
      read: true,
      metadata: {
        attendance: {
          recordId: String(data.recordId ?? ''),
          employeeUserId: String(data.userId),
          employeeName: String(data.employeeName ?? '—'),
          type: data.type === 'check_out' ? 'check_out' : 'check_in',
          note: '',
          createdAt: String(data.createdAt ?? new Date().toISOString()),
        },
      },
    });
  }

  if ((kind === 'confirmed_order' || kind === 'order_moved' || kind === 'order_updated') && orderId) {
    void openStandaloneOrderModal(orderId);
    return true;
  }

  if (kind === 'order_deleted' && orderId) {
    const target = resolveOrderNotificationTarget(
      {
        orderId,
        focusOrder: kind !== 'order_deleted',
      },
      t,
    );
    if (target) {
      navigateToPricingTarget(target);
      return true;
    }
  }

  if (kind === 'mirror_warehouse') {
    navigateMainTabScreen('PricingTab', 'MirrorWarehouse');
    return true;
  }

  return false;
}
