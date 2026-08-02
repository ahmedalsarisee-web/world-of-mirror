import {create} from 'zustand';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {CONFIRMED_ORDERS_STORE_MAX} from '@app/constants/performanceLimits';
import {getNextMirrorOrderInvoiceNumber} from '@app/utils/mirrorOrderInvoiceNumber';
import {resolveConfirmedOrderIndexFields} from '@app/utils/confirmedOrderListBucket';

function trimOrdersStore(orders: MirrorPricingConfirmedOrder[]): MirrorPricingConfirmedOrder[] {
  if (orders.length <= CONFIRMED_ORDERS_STORE_MAX) {
    return orders;
  }
  return [...orders]
    .sort((a, b) => b.statusChangedAt.localeCompare(a.statusChangedAt))
    .slice(0, CONFIRMED_ORDERS_STORE_MAX);
}

export function confirmedOrderListRevision(order: MirrorPricingConfirmedOrder): string {
  return `${order.statusChangedAt ?? order.confirmedAt ?? ''}:${order.lastUpdatedAt ?? ''}`;
}

export function confirmedOrdersPageSnapshotKey(
  orders: MirrorPricingConfirmedOrder[],
): string {
  return orders.map((order) => `${order.id}:${confirmedOrderListRevision(order)}`).join('|');
}

function mergeUpsertOrders(
  current: MirrorPricingConfirmedOrder[],
  incoming: MirrorPricingConfirmedOrder[],
  pendingDeleted: Set<string>,
): MirrorPricingConfirmedOrder[] | null {
  if (incoming.length === 0) {
    return null;
  }

  const byId = new Map(current.map((entry) => [entry.id, entry]));
  let changed = false;

  for (const entry of incoming) {
    if (pendingDeleted.has(entry.id)) {
      continue;
    }

    const existing = byId.get(entry.id);
    if (
      existing &&
      confirmedOrderListRevision(existing) === confirmedOrderListRevision(entry)
    ) {
      continue;
    }

    byId.set(entry.id, entry);
    changed = true;
  }

  if (!changed) {
    return null;
  }

  return trimOrdersStore([...byId.values()]);
}

interface MirrorPricingConfirmedOrdersState {
  orders: MirrorPricingConfirmedOrder[];
  /** Order ids removed locally until Firestore confirms deletion. */
  pendingDeletedOrderIds: string[];
  addOrder: (order: Omit<MirrorPricingConfirmedOrder, 'id' | 'confirmedAt'>) => void;
  upsertOrders: (orders: MirrorPricingConfirmedOrder[]) => void;
  updateOrderStatus: (id: string, status: MirrorPricingOrderStatus) => void;
  updateOrder: (id: string, updates: Partial<MirrorPricingConfirmedOrder>) => void;
  removeOrder: (id: string) => void;
  restoreOrder: (order: MirrorPricingConfirmedOrder) => void;
  acknowledgePendingDeletedOrder: (id: string) => void;
  clearAllOrders: () => void;
}

function createConfirmedOrderId(): string {
  return `confirmed-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useMirrorPricingConfirmedOrdersStore = create<MirrorPricingConfirmedOrdersState>()((set) => ({
      orders: [],
      pendingDeletedOrderIds: [],

      addOrder: (order) =>
        set((state) => {
          const invoiceNumber =
            order.invoiceNumber ?? getNextMirrorOrderInvoiceNumber(state.orders);
          const indexFields = resolveConfirmedOrderIndexFields({
            ...order,
            status: order.status ?? 'preparation',
          });
          return {
            orders: [
              {
                ...order,
                ...indexFields,
                status: order.status ?? 'preparation',
                invoiceNumber,
                id: createConfirmedOrderId(),
                confirmedAt: new Date().toISOString(),
                statusChangedAt: new Date().toISOString(),
              },
              ...state.orders,
            ],
          };
        }),

      upsertOrders: (incoming) =>
        set((state) => {
          const nextOrders = mergeUpsertOrders(
            state.orders,
            incoming,
            new Set(state.pendingDeletedOrderIds),
          );
          if (!nextOrders) {
            return state;
          }
          return {orders: nextOrders};
        }),

      updateOrderStatus: (id, status) =>
        set((state) => ({
          orders: state.orders.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  status,
                  statusChangedAt: new Date().toISOString(),
                  lastUpdatedAt: new Date().toISOString(),
                }
              : entry,
          ),
        })),

      updateOrder: (id, updates) =>
        set((state) => ({
          orders: state.orders.map((entry) => {
            if (entry.id !== id) {
              return entry;
            }
            const merged = {...entry, ...updates};
            if ('homeCardId' in updates && updates.homeCardId === undefined) {
              delete merged.homeCardId;
            }
            if ('paymentFollowUpNote' in updates && updates.paymentFollowUpNote === undefined) {
              delete merged.paymentFollowUpNote;
            }
            if ('paymentFollowUpAt' in updates && updates.paymentFollowUpAt === undefined) {
              delete merged.paymentFollowUpAt;
            }
            if ('orderCardNote' in updates && updates.orderCardNote === undefined) {
              delete merged.orderCardNote;
            }
            if ('priorCollectedAmount' in updates && updates.priorCollectedAmount === undefined) {
              delete merged.priorCollectedAmount;
            }
            if ('catalogMirrorImages' in updates && updates.catalogMirrorImages === undefined) {
              delete merged.catalogMirrorImages;
            }
            if (
              'catalogMirrorImageAnnotationData' in updates &&
              updates.catalogMirrorImageAnnotationData === undefined
            ) {
              delete merged.catalogMirrorImageAnnotationData;
            }
            if ('studioOrderImages' in updates && updates.studioOrderImages === undefined) {
              delete merged.studioOrderImages;
            }
            if ('invoiceExtraLines' in updates && updates.invoiceExtraLines === undefined) {
              delete merged.invoiceExtraLines;
            }
            if ('invoiceNote' in updates && updates.invoiceNote === undefined) {
              delete merged.invoiceNote;
            }
            if ('customerPhone2' in updates && updates.customerPhone2 === undefined) {
              delete merged.customerPhone2;
            }
            if ('isFavorite' in updates && updates.isFavorite === false) {
              merged.isFavorite = false;
              delete merged.favoritedAt;
            } else if ('favoritedAt' in updates && updates.favoritedAt === undefined) {
              delete merged.favoritedAt;
            }
            if ('paymentFollowUpRequired' in updates && updates.paymentFollowUpRequired === false) {
              merged.paymentFollowUpRequired = false;
            }
            merged.lastUpdatedAt = updates.lastUpdatedAt ?? new Date().toISOString();
            return merged;
          }),
        })),

      removeOrder: (id) =>
        set((state) => ({
          orders: state.orders.filter((entry) => entry.id !== id),
          pendingDeletedOrderIds: state.pendingDeletedOrderIds.includes(id)
            ? state.pendingDeletedOrderIds
            : [...state.pendingDeletedOrderIds, id],
        })),

      restoreOrder: (order) =>
        set((state) => ({
          orders: trimOrdersStore([
            order,
            ...state.orders.filter((entry) => entry.id !== order.id),
          ]),
          pendingDeletedOrderIds: state.pendingDeletedOrderIds.filter((entry) => entry !== order.id),
        })),

      acknowledgePendingDeletedOrder: (id) =>
        set((state) => ({
          pendingDeletedOrderIds: state.pendingDeletedOrderIds.filter((entry) => entry !== id),
        })),

      clearAllOrders: () => set({orders: [], pendingDeletedOrderIds: []}),
    }));
