import dayjs from 'dayjs';
import type {TFunction} from 'i18next';
import type {AppUser, Transaction} from '@app/types/models';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {
  getConfirmedOrderCustomAdditionsTotal,
  getConfirmedOrderLineTotal,
  resolveConfirmedOrderDiscount,
  resolveConfirmedOrderRemaining,
  resolveConfirmedOrderSubtotal,
} from '@app/types/mirrorPricingConfirmedOrder';
import {
  MIRROR_PRICING_ORDER_STATUSES,
  type MirrorPricingOrderStatus,
  resolveMirrorPricingOrderStatus,
} from '@app/types/mirrorPricingOrderStatus';
import {
  getOrdersHomeScreenGridCards,
  type OrdersHomeCardConfig,
} from '@app/types/ordersHomeCard';
import {getMirrorPricingCartCount} from '@app/types/mirrorPricingCart';
import {roundMoney} from '@app/utils/format';
import {getMirrorPricingCartCostTotal} from '@app/utils/mirrorPricingCost';
import {filterRecordsByDateRange} from '@app/utils/reportDateRange';
import {filterConfirmedOrdersForListParams} from '@app/services/confirmedOrders.service';
import {resolveOrdersHomeCardListParams} from '@app/utils/ordersHomeCardListParams';
import {resolveOrdersHomeCardReportLabel} from '@app/utils/ordersHomeCardLabels';

export interface OrdersFinancialReportSummary {
  orderCount: number;
  mirrorItemCount: number;
  totalSubtotal: number;
  totalDiscount: number;
  totalSales: number;
  totalCollected: number;
  totalRemaining: number;
  totalCustomAdditions: number;
  totalMirrorItemsRevenue: number;
  totalMirrorCost: number;
  grossProfit: number;
}

export interface OrdersFinancialReportStatusRow {
  status: MirrorPricingOrderStatus;
  orderCount: number;
  totalSales: number;
  totalCollected: number;
  totalMirrorCost: number;
  grossProfit: number;
}

export interface OrdersFinancialReportEmployeeRow {
  userId: string;
  userName: string;
  roleLabelKey: 'adminRole' | 'employeeRole';
  orderCount: number;
  totalSales: number;
  totalCollected: number;
  totalMirrorCost: number;
  grossProfit: number;
  financeCollectionTotal: number;
}

export interface OrdersFinancialReportCardSection {
  cardId: string;
  cardLabel: string;
  orderCount: number;
  mirrorItemCount: number;
  totalSales: number;
  totalCollected: number;
  totalRemaining: number;
  orders: MirrorPricingConfirmedOrder[];
}

export interface OrdersFinancialReportData {
  orders: MirrorPricingConfirmedOrder[];
  summary: OrdersFinancialReportSummary;
  byStatus: OrdersFinancialReportStatusRow[];
  byEmployee: OrdersFinancialReportEmployeeRow[];
  byCard: OrdersFinancialReportCardSection[];
}

export interface BuildOrdersFinancialReportOptions {
  homeCards: OrdersHomeCardConfig[];
  reportCards?: OrdersHomeCardConfig[];
  t: TFunction;
}

export function filterOrdersByDateRange(
  orders: MirrorPricingConfirmedOrder[],
  startDateKey: string,
  endDateKey: string,
): MirrorPricingConfirmedOrder[] {
  const start = dayjs(startDateKey).startOf('day');
  const end = dayjs(endDateKey).endOf('day');

  return orders.filter((order) => {
    const confirmedAt = dayjs(order.confirmedAt);
    return (
      (confirmedAt.isSame(start) || confirmedAt.isAfter(start)) &&
      (confirmedAt.isSame(end) || confirmedAt.isBefore(end))
    );
  });
}

export function filterTransactionsByDateRange(
  transactions: Transaction[],
  startDateKey: string,
  endDateKey: string,
): Transaction[] {
  return filterRecordsByDateRange(transactions, startDateKey, endDateKey);
}

function resolveEmployeeRoleLabelKey(
  order: MirrorPricingConfirmedOrder,
): OrdersFinancialReportEmployeeRow['roleLabelKey'] {
  return order.confirmedByUserRole === 'admin' ? 'adminRole' : 'employeeRole';
}

function sumMirrorItemsRevenue(order: MirrorPricingConfirmedOrder): number {
  return roundMoney(order.items.reduce((sum, item) => sum + getConfirmedOrderLineTotal(item), 0));
}

function dedupeOrdersFromCardSections(
  sections: OrdersFinancialReportCardSection[],
): MirrorPricingConfirmedOrder[] {
  const byId = new Map<string, MirrorPricingConfirmedOrder>();
  for (const section of sections) {
    for (const order of section.orders) {
      byId.set(order.id, order);
    }
  }
  return [...byId.values()].sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));
}

function computeSummaryFromOrders(
  orders: MirrorPricingConfirmedOrder[],
): OrdersFinancialReportSummary {
  let totalSubtotal = 0;
  let totalDiscount = 0;
  let totalSales = 0;
  let totalCollected = 0;
  let totalRemaining = 0;
  let totalCustomAdditions = 0;
  let totalMirrorItemsRevenue = 0;
  let totalMirrorCost = 0;
  let mirrorItemCount = 0;

  for (const order of orders) {
    totalSubtotal += resolveConfirmedOrderSubtotal(order);
    totalDiscount += resolveConfirmedOrderDiscount(order);
    totalSales += order.total;
    totalCollected += roundMoney(Math.max(0, order.collectedAmount));
    totalRemaining += resolveConfirmedOrderRemaining(order);
    totalCustomAdditions += getConfirmedOrderCustomAdditionsTotal(order.customAdditions);
    totalMirrorItemsRevenue += sumMirrorItemsRevenue(order);
    totalMirrorCost += roundMoney(getMirrorPricingCartCostTotal(order.items));
    mirrorItemCount += getMirrorPricingCartCount(order.items);
  }

  return {
    orderCount: orders.length,
    mirrorItemCount,
    totalSubtotal: roundMoney(totalSubtotal),
    totalDiscount: roundMoney(totalDiscount),
    totalSales: roundMoney(totalSales),
    totalCollected: roundMoney(totalCollected),
    totalRemaining: roundMoney(totalRemaining),
    totalCustomAdditions: roundMoney(totalCustomAdditions),
    totalMirrorItemsRevenue: roundMoney(totalMirrorItemsRevenue),
    totalMirrorCost: roundMoney(totalMirrorCost),
    grossProfit: roundMoney(totalSales - totalMirrorCost),
  };
}

function sumCardSectionMetrics(orders: MirrorPricingConfirmedOrder[]): Pick<
  OrdersFinancialReportCardSection,
  'orderCount' | 'mirrorItemCount' | 'totalSales' | 'totalCollected' | 'totalRemaining'
> {
  let totalSales = 0;
  let totalCollected = 0;
  let totalRemaining = 0;
  let mirrorItemCount = 0;

  for (const order of orders) {
    totalSales += order.total;
    totalCollected += roundMoney(Math.max(0, order.collectedAmount));
    totalRemaining += resolveConfirmedOrderRemaining(order);
    mirrorItemCount += getMirrorPricingCartCount(order.items);
  }

  return {
    orderCount: orders.length,
    mirrorItemCount,
    totalSales: roundMoney(totalSales),
    totalCollected: roundMoney(totalCollected),
    totalRemaining: roundMoney(totalRemaining),
  };
}

function buildOrdersFinancialReportByCard(
  orders: MirrorPricingConfirmedOrder[],
  options: BuildOrdersFinancialReportOptions,
): OrdersFinancialReportCardSection[] {
  const {homeCards, t} = options;
  const reportCards = options.reportCards ?? getOrdersHomeScreenGridCards(homeCards);

  return reportCards.map((card) => {
    const listParams = resolveOrdersHomeCardListParams(card);
    const cardOrders = listParams
      ? filterConfirmedOrdersForListParams(orders, listParams).sort((a, b) =>
          b.confirmedAt.localeCompare(a.confirmedAt),
        )
      : [];

    return {
      cardId: card.id,
      cardLabel: resolveOrdersHomeCardReportLabel(card, homeCards, t),
      ...sumCardSectionMetrics(cardOrders),
      orders: cardOrders,
    };
  });
}

export function buildOrdersFinancialReport(
  orders: MirrorPricingConfirmedOrder[],
  transactions: Transaction[] = [],
  users: AppUser[] = [],
  options?: BuildOrdersFinancialReportOptions,
): OrdersFinancialReportData {
  const sortedOrders = [...orders].sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));

  if (options) {
    const byCard = buildOrdersFinancialReportByCard(sortedOrders, options);
    const snapshotOrders = dedupeOrdersFromCardSections(byCard);
    const summary = computeSummaryFromOrders(snapshotOrders);
    const statusEmployeeReport = buildOrdersFinancialReport(
      snapshotOrders,
      transactions,
      users,
    );

    return {
      orders: snapshotOrders,
      summary,
      byStatus: statusEmployeeReport.byStatus,
      byEmployee: statusEmployeeReport.byEmployee,
      byCard,
    };
  }

  const userMap = new Map(users.map((user) => [user.id, user]));

  let totalSubtotal = 0;
  let totalDiscount = 0;
  let totalSales = 0;
  let totalCollected = 0;
  let totalRemaining = 0;
  let totalCustomAdditions = 0;
  let totalMirrorItemsRevenue = 0;
  let totalMirrorCost = 0;
  let mirrorItemCount = 0;

  const statusMap = new Map<MirrorPricingOrderStatus, OrdersFinancialReportStatusRow>();
  for (const status of MIRROR_PRICING_ORDER_STATUSES) {
    statusMap.set(status, {
      status,
      orderCount: 0,
      totalSales: 0,
      totalCollected: 0,
      totalMirrorCost: 0,
      grossProfit: 0,
    });
  }

  const employeeMap = new Map<string, OrdersFinancialReportEmployeeRow>();

  for (const order of sortedOrders) {
    const subtotal = resolveConfirmedOrderSubtotal(order);
    const discount = resolveConfirmedOrderDiscount(order);
    const collected = roundMoney(Math.max(0, order.collectedAmount));
    const remaining = resolveConfirmedOrderRemaining(order);
    const customAdditions = getConfirmedOrderCustomAdditionsTotal(order.customAdditions);
    const mirrorItemsRevenue = sumMirrorItemsRevenue(order);
    const mirrorCost = roundMoney(getMirrorPricingCartCostTotal(order.items));

    totalSubtotal += subtotal;
    totalDiscount += discount;
    totalSales += order.total;
    totalCollected += collected;
    totalRemaining += remaining;
    totalCustomAdditions += customAdditions;
    totalMirrorItemsRevenue += mirrorItemsRevenue;
    totalMirrorCost += mirrorCost;
    mirrorItemCount += getMirrorPricingCartCount(order.items);

    const status = resolveMirrorPricingOrderStatus(order.status);
    const statusRow = statusMap.get(status)!;
    statusRow.orderCount += 1;
    statusRow.totalSales = roundMoney(statusRow.totalSales + order.total);
    statusRow.totalCollected = roundMoney(statusRow.totalCollected + collected);
    statusRow.totalMirrorCost = roundMoney(statusRow.totalMirrorCost + mirrorCost);

    const employeeId = order.confirmedByUserId ?? 'unknown';
    const existingEmployee = employeeMap.get(employeeId);
    const employeeRow: OrdersFinancialReportEmployeeRow = existingEmployee ?? {
      userId: employeeId,
      userName: order.confirmedByUserName ?? userMap.get(employeeId)?.name ?? '—',
      roleLabelKey: resolveEmployeeRoleLabelKey(order),
      orderCount: 0,
      totalSales: 0,
      totalCollected: 0,
      totalMirrorCost: 0,
      grossProfit: 0,
      financeCollectionTotal: 0,
    };
    employeeRow.orderCount += 1;
    employeeRow.totalSales = roundMoney(employeeRow.totalSales + order.total);
    employeeRow.totalCollected = roundMoney(employeeRow.totalCollected + collected);
    employeeRow.totalMirrorCost = roundMoney(employeeRow.totalMirrorCost + mirrorCost);
    employeeMap.set(employeeId, employeeRow);
  }

  for (const transaction of transactions) {
    if (transaction.type !== 'order_collection') {
      continue;
    }
    const employeeId = transaction.userId;
    const existingEmployee = employeeMap.get(employeeId);
    const employeeRow: OrdersFinancialReportEmployeeRow = existingEmployee ?? {
      userId: employeeId,
      userName: userMap.get(employeeId)?.name ?? employeeId,
      roleLabelKey:
        userMap.get(employeeId)?.role === 'admin' ? 'adminRole' : 'employeeRole',
      orderCount: 0,
      totalSales: 0,
      totalCollected: 0,
      totalMirrorCost: 0,
      grossProfit: 0,
      financeCollectionTotal: 0,
    };
    employeeRow.financeCollectionTotal = roundMoney(
      employeeRow.financeCollectionTotal + Math.max(0, transaction.amount),
    );
    employeeMap.set(employeeId, employeeRow);
  }

  const byEmployee = [...employeeMap.values()]
    .map((row) => ({
      ...row,
      grossProfit: roundMoney(row.totalSales - row.totalMirrorCost),
      totalSales: roundMoney(row.totalSales),
      totalCollected: roundMoney(row.totalCollected),
      totalMirrorCost: roundMoney(row.totalMirrorCost),
      financeCollectionTotal: roundMoney(row.financeCollectionTotal),
    }))
    .sort((a, b) => b.totalCollected - a.totalCollected || b.totalSales - a.totalSales);

  const summary = computeSummaryFromOrders(sortedOrders);

  return {
    orders: sortedOrders,
    summary,
    byStatus: MIRROR_PRICING_ORDER_STATUSES.map((status) => {
      const row = statusMap.get(status)!;
      return {
        ...row,
        totalMirrorCost: roundMoney(row.totalMirrorCost),
        grossProfit: roundMoney(row.totalSales - row.totalMirrorCost),
      };
    }),
    byEmployee,
    byCard: [],
  };
}
