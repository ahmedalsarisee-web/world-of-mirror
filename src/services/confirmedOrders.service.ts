import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDocs,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb, isFirebaseConfigured} from '@app/config/firebase';
import {useAuthStore} from '@app/stores/authStore';
import {deleteAllDocumentsInCollection} from '@app/utils/firestoreBatchDelete';
import {canDeleteOrders} from '@app/utils/employeePermissions';
import {useMirrorPricingConfirmedOrdersStore, confirmedOrdersPageSnapshotKey} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {hasConfirmedOrderOutstandingBalance} from '@app/types/mirrorPricingConfirmedOrder';
import {sortConfirmedOrdersByStatusChangedAt} from '@app/types/mirrorPricingConfirmedOrder';
import {recordOrderMoveNotification, recordConfirmedOrderNotification, recordOrderDeletedNotification, recordOrderUpdatedNotification} from '@app/utils/recordAdminOperationNotifications';
import {
  normalizeMirrorPricingCartItem,
  normalizeMirrorPricingCustomAddition,
} from '@app/types/mirrorPricingCart';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {
  getMaxMirrorOrderInvoiceNumber,
  getNextMirrorOrderInvoiceNumber,
  normalizeMirrorOrderInvoiceNumber,
} from '@app/utils/mirrorOrderInvoiceNumber';
import {toFirestoreSafePayload} from '@app/utils/firestorePayload';
import {
  normalizeCatalogMirrorImageAnnotationData,
  type CatalogMirrorImageAnnotationData,
} from '@app/utils/catalogImageTextAnnotations';
import {
  resolveConfirmedOrderIndexFields,
  resolveConfirmedOrdersListBucketParams,
  resolveOrderIsActive,
  type ConfirmedOrderListBucket,
  type ConfirmedOrdersListParams,
} from '@app/utils/confirmedOrderListBucket';
import {
  getCachedConfirmedOrdersListPage,
  getConfirmedOrdersListCacheKey,
  removeOrderFromConfirmedOrdersListCache,
  setCachedConfirmedOrdersListPage,
} from '@app/utils/confirmedOrdersListCache';
import {
  isConfirmedOrdersIndexMigrationComplete,
  markConfirmedOrdersIndexMigrationComplete,
} from '@app/utils/confirmedOrdersIndexMigration';
import {enableOrdersBackgroundSync} from '@app/utils/ordersSyncGate';
import {normalizeStoredInvoiceExportExtraLines} from '@app/types/invoiceExportExtraLine';
import {resolveOrderFulfillmentType} from '@app/types/orderFulfillmentType';

export type {ConfirmedOrdersListParams} from '@app/utils/confirmedOrderListBucket';

const MIRROR_CONFIRMED_ORDERS = 'mirrorConfirmedOrders';
const MIRROR_ORDER_INVOICE_COUNTER_DOC = ['mirrorOrderMeta', 'invoiceCounter'] as const;
export const CONFIRMED_ORDERS_PAGE_SIZE = 20;
const RECENT_CONFIRMED_ORDERS_LIMIT = 40;
const INDEX_MIGRATION_BATCH_SIZE = 50;

function resolveListParamsBucket(
  params: ConfirmedOrdersListParams,
): ConfirmedOrderListBucket | 'active' {
  return resolveConfirmedOrdersListBucketParams(params);
}

const ACTIVE_ORDER_STATUSES: MirrorPricingOrderStatus[] = [
  'preparation',
  'ready_delivery',
  'ready_installation',
];

function buildActiveConfirmedOrdersListQuery(
  db: ReturnType<typeof getFirebaseDb>,
  pageSize: number,
  cursor?: DocumentSnapshot,
): Query {
  return query(
    collection(db, MIRROR_CONFIRMED_ORDERS),
    where('isOrderActive', '==', true),
    orderBy('statusChangedAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  );
}

function buildLegacyActiveConfirmedOrdersListQuery(
  db: ReturnType<typeof getFirebaseDb>,
  pageSize: number,
  cursor?: DocumentSnapshot,
): Query {
  return query(
    collection(db, MIRROR_CONFIRMED_ORDERS),
    where('status', 'in', ACTIVE_ORDER_STATUSES),
    orderBy('statusChangedAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  );
}

function resolveLegacyListStatus(params: ConfirmedOrdersListParams): MirrorPricingOrderStatus {
  if (params.outstandingOnly) {
    return 'completed';
  }
  return params.statusFilter ?? 'preparation';
}

function buildLegacyConfirmedOrdersListQuery(
  db: ReturnType<typeof getFirebaseDb>,
  params: ConfirmedOrdersListParams,
  pageSize: number,
  cursor?: DocumentSnapshot,
): Query {
  if (params.activeOnly) {
    return buildLegacyActiveConfirmedOrdersListQuery(db, pageSize, cursor);
  }

  if (params.homeCardId) {
    return query(
      collection(db, MIRROR_CONFIRMED_ORDERS),
      where('homeCardId', '==', params.homeCardId),
      orderBy('confirmedAt', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(pageSize),
    );
  }

  return query(
    collection(db, MIRROR_CONFIRMED_ORDERS),
    where('status', '==', resolveLegacyListStatus(params)),
    orderBy('statusChangedAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(params.outstandingOnly ? pageSize * 4 : pageSize),
  );
}

function buildConfirmedOrdersListQuery(
  db: ReturnType<typeof getFirebaseDb>,
  params: ConfirmedOrdersListParams,
  pageSize: number,
  cursor?: DocumentSnapshot,
): Query {
  if (params.activeOnly) {
    return buildActiveConfirmedOrdersListQuery(db, pageSize, cursor);
  }

  const listBucket = resolveListParamsBucket(params);
  const constraints = [
    where('listBucket', '==', listBucket),
    ...(params.outstandingOnly ? [where('hasOutstandingBalance', '==', true)] : []),
    orderBy('statusChangedAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize),
  ];

  return query(collection(db, MIRROR_CONFIRMED_ORDERS), ...constraints);
}

function mapLegacyListSnapshot(
  snap: {docs: Array<{id: string; data: () => Record<string, unknown>}>},
  params: ConfirmedOrdersListParams,
  pageSize: number,
): {
  orders: MirrorPricingConfirmedOrder[];
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
} {
  if (params.homeCardId) {
    const orders = sortOrders(
      snap.docs.map((entry) => mapConfirmedOrder(entry.id, entry.data())),
    );
    return {
      orders: orders.slice(0, pageSize),
      hasMore: snap.docs.length >= pageSize,
      lastDoc: (snap.docs[snap.docs.length - 1] as DocumentSnapshot | undefined) ?? null,
    };
  }

  const filtered = filterLocalOrders(
    snap.docs.map((entry) => mapConfirmedOrder(entry.id, entry.data())),
    params,
  );
  const orders = sortOrders(filtered).slice(0, pageSize);

  return {
    orders,
    hasMore: snap.docs.length >= pageSize * 4 || filtered.length > pageSize,
    lastDoc: (snap.docs[snap.docs.length - 1] as DocumentSnapshot | undefined) ?? null,
  };
}

async function fetchLegacyConfirmedOrdersPage(
  params: ConfirmedOrdersListParams,
  pageSize: number,
  cursor?: DocumentSnapshot,
): Promise<{
  orders: MirrorPricingConfirmedOrder[];
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
}> {
  const db = getFirebaseDb();

  if (params.homeCardId) {
    const snap = await getDocs(buildLegacyConfirmedOrdersListQuery(db, params, pageSize, cursor));
    return mapLegacyListSnapshot(snap, params, pageSize);
  }

  let firestoreCursor = cursor;
  const matched: MirrorPricingConfirmedOrder[] = [];
  let lastDoc: DocumentSnapshot | null = null;
  let exhausted = false;

  while (matched.length < pageSize && !exhausted) {
    const snap = await getDocs(
      buildLegacyConfirmedOrdersListQuery(db, params, pageSize, firestoreCursor ?? undefined),
    );

    if (snap.empty) {
      exhausted = true;
      break;
    }

    for (const entry of snap.docs) {
      const order = mapConfirmedOrder(entry.id, entry.data());
      if (filterLocalOrders([order], params).length === 0) {
        continue;
      }
      matched.push(order);
      if (matched.length >= pageSize) {
        break;
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1] ?? null;
    firestoreCursor = lastDoc ?? undefined;
    if (snap.docs.length < pageSize * 4) {
      exhausted = true;
    }
  }

  return {
    orders: sortOrders(matched.slice(0, pageSize)),
    hasMore: !exhausted,
    lastDoc,
  };
}

async function fetchIndexedConfirmedOrdersPage(
  params: ConfirmedOrdersListParams,
  pageSize: number,
  cursor?: DocumentSnapshot,
): Promise<{
  orders: MirrorPricingConfirmedOrder[];
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
}> {
  const db = getFirebaseDb();
  const snap = await getDocs(buildConfirmedOrdersListQuery(db, params, pageSize, cursor));
  return {
    orders: sortOrders(snap.docs.map((entry) => mapConfirmedOrder(entry.id, entry.data()))),
    hasMore: snap.docs.length >= pageSize,
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
  };
}

export async function ensureConfirmedOrdersIndexMigrated(): Promise<void> {
  if (isMockMode || !isFirebaseConfigured) {
    return;
  }

  if (await isConfirmedOrdersIndexMigrationComplete()) {
    return;
  }

  let cursor: DocumentSnapshot | undefined;
  let totalUpdated = 0;
  let scannedEmpty = false;

  while (true) {
    const result = await migrateConfirmedOrdersIndexFieldsBatch(cursor).catch(() => ({
      updated: 0,
      nextCursor: null,
      done: true,
    }));

    totalUpdated += result.updated;

    if (result.done || !result.nextCursor) {
      scannedEmpty = true;
      break;
    }

    cursor = result.nextCursor;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 16);
    });
  }

  if (scannedEmpty) {
    await markConfirmedOrdersIndexMigrationComplete();
  }
}

function mapConfirmedOrder(id: string, data: Record<string, unknown>): MirrorPricingConfirmedOrder {
  const mapped: MirrorPricingConfirmedOrder = {
    id,
    customerName: String(data.customerName ?? ''),
    fulfillmentType: resolveOrderFulfillmentType(data.fulfillmentType),
    customerPhone: String(data.customerPhone ?? ''),
    customerPhone2: data.customerPhone2 ? String(data.customerPhone2) : undefined,
    customerLocation: String(data.customerLocation ?? ''),
    customerNotes: data.customerNotes ? String(data.customerNotes) : undefined,
    customerPhotosLink: data.customerPhotosLink ? String(data.customerPhotosLink) : undefined,
    catalogMirrorImages: Array.isArray(data.catalogMirrorImages)
      ? data.catalogMirrorImages.map((entry) => String(entry)).filter(Boolean)
      : undefined,
    catalogMirrorImageAnnotationData: normalizeCatalogMirrorImageAnnotationData(
      data.catalogMirrorImageAnnotationData,
    ),
    studioOrderImages: Array.isArray(data.studioOrderImages)
      ? data.studioOrderImages.map((entry) => String(entry)).filter(Boolean)
      : undefined,
    pieceCount: (() => {
      if (data.pieceCount === undefined || data.pieceCount === null) {
        return undefined;
      }
      const count = Math.max(0, Math.round(Number(data.pieceCount)));
      return count > 0 ? count : undefined;
    })(),
    collectedAmount: Number(data.collectedAmount ?? 0),
    subtotal: data.subtotal === undefined ? undefined : Number(data.subtotal),
    discountAmount: data.discountAmount === undefined ? undefined : Number(data.discountAmount),
    total: Number(data.total ?? 0),
    remainingAmount: data.remainingAmount === undefined ? undefined : Number(data.remainingAmount),
    items: Array.isArray(data.items)
      ? data.items
          .map((entry) => normalizeMirrorPricingCartItem(entry))
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      : [],
    customAdditions: Array.isArray(data.customAdditions)
      ? data.customAdditions
          .map((entry) => normalizeMirrorPricingCustomAddition(entry))
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      : undefined,
    confirmedAt: String(data.confirmedAt ?? ''),
    statusChangedAt: data.statusChangedAt ? String(data.statusChangedAt) : undefined,
    lastMovedByUserId: data.lastMovedByUserId ? String(data.lastMovedByUserId) : undefined,
    lastMovedByUserName: data.lastMovedByUserName ? String(data.lastMovedByUserName) : undefined,
    lastMovedFromLabel: data.lastMovedFromLabel ? String(data.lastMovedFromLabel) : undefined,
    lastMovedToLabel: data.lastMovedToLabel ? String(data.lastMovedToLabel) : undefined,
    confirmedByUserId: data.confirmedByUserId ? String(data.confirmedByUserId) : undefined,
    confirmedByUserName: data.confirmedByUserName ? String(data.confirmedByUserName) : undefined,
    confirmedByUserRole:
      data.confirmedByUserRole === 'admin' || data.confirmedByUserRole === 'employee'
        ? data.confirmedByUserRole
        : undefined,
    status: resolveMirrorPricingOrderStatus(data.status),
    invoiceNumber: normalizeMirrorOrderInvoiceNumber(data.invoiceNumber),
    homeCardId: data.homeCardId ? String(data.homeCardId) : undefined,
    isFavorite: data.isFavorite === true,
    favoritedAt: data.favoritedAt ? String(data.favoritedAt) : undefined,
    paymentFollowUpRequired: data.paymentFollowUpRequired === true,
    paymentFollowUpNote: data.paymentFollowUpNote ? String(data.paymentFollowUpNote) : undefined,
    paymentFollowUpAt: data.paymentFollowUpAt ? String(data.paymentFollowUpAt) : undefined,
    orderCardNote: data.orderCardNote ? String(data.orderCardNote) : undefined,
    priorCollectedAmount: (() => {
      if (data.priorCollectedAmount === undefined || data.priorCollectedAmount === null) {
        return undefined;
      }
      const amount = Number(data.priorCollectedAmount);
      return Number.isFinite(amount) && amount > 0 ? amount : undefined;
    })(),
    listBucket: data.listBucket
      ? (String(data.listBucket) as ConfirmedOrderListBucket)
      : undefined,
    hasOutstandingBalance: data.hasOutstandingBalance === true,
    invoiceExtraLines: normalizeStoredInvoiceExportExtraLines(data.invoiceExtraLines),
    invoiceNote: data.invoiceNote ? String(data.invoiceNote) : undefined,
    lastUpdatedAt: data.lastUpdatedAt ? String(data.lastUpdatedAt) : undefined,
  };

  const indexFields = resolveConfirmedOrderIndexFields(mapped);
  if (!mapped.listBucket) {
    mapped.listBucket = indexFields.listBucket;
  }
  if (mapped.hasOutstandingBalance !== indexFields.hasOutstandingBalance) {
    mapped.hasOutstandingBalance = indexFields.hasOutstandingBalance;
  }
  if (mapped.isOrderActive !== indexFields.isOrderActive) {
    mapped.isOrderActive = indexFields.isOrderActive;
  } else if (mapped.isOrderActive === undefined) {
    mapped.isOrderActive = indexFields.isOrderActive;
  }

  return mapped;
}

/** Allocates the next global invoice number (#n). Uses Firestore transaction when online. */
export async function allocateNextMirrorOrderInvoiceNumber(): Promise<number> {
  const localOrders = useMirrorPricingConfirmedOrdersStore.getState().orders;
  const localNext = getNextMirrorOrderInvoiceNumber(localOrders);

  if (isMockMode) {
    return localNext;
  }

  const db = getFirebaseDb();
  const counterRef = doc(db, ...MIRROR_ORDER_INVOICE_COUNTER_DOC);

  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const storedLast = snap.exists() ? Number(snap.data()?.lastNumber ?? 0) : 0;
      const safeStored = Number.isFinite(storedLast) && storedLast >= 0 ? Math.floor(storedLast) : 0;
      const next = Math.max(safeStored, getMaxMirrorOrderInvoiceNumber(localOrders)) + 1;
      transaction.set(counterRef, {lastNumber: next}, {merge: true});
      return next;
    });
  } catch {
    return localNext;
  }
}

function sortOrders(orders: MirrorPricingConfirmedOrder[]): MirrorPricingConfirmedOrder[] {
  return sortConfirmedOrdersByStatusChangedAt(orders);
}

async function mapConfirmedOrderEntries(
  entries: Array<{id: string; data: Record<string, unknown>}>,
): Promise<MirrorPricingConfirmedOrder[]> {
  const mapped: MirrorPricingConfirmedOrder[] = [];
  const chunkSize = 6;

  for (let index = 0; index < entries.length; index += chunkSize) {
    const chunk = entries.slice(index, index + chunkSize);
    for (const entry of chunk) {
      mapped.push(mapConfirmedOrder(entry.id, entry.data));
    }

    if (index + chunkSize < entries.length) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  return sortOrders(mapped);
}

let confirmedOrdersActiveIndexKnownMissing = false;

export function subscribeToConfirmedOrders(
  callback: (orders: MirrorPricingConfirmedOrder[]) => void,
): Unsubscribe {
  if (isMockMode) {
    const active = filterLocalOrders(useMirrorPricingConfirmedOrdersStore.getState().orders, {
      activeOnly: true,
    });
    callback(sortOrders(active));
    return () => undefined;
  }

  const db = getFirebaseDb();
  const activeQuery = query(
    collection(db, MIRROR_CONFIRMED_ORDERS),
    where('isOrderActive', '==', true),
    orderBy('confirmedAt', 'desc'),
    limit(RECENT_CONFIRMED_ORDERS_LIMIT),
  );
  const legacyActiveQuery = query(
    collection(db, MIRROR_CONFIRMED_ORDERS),
    where('status', 'in', ACTIVE_ORDER_STATUSES),
    orderBy('confirmedAt', 'desc'),
    limit(RECENT_CONFIRMED_ORDERS_LIMIT),
  );

  let activeUnsub: Unsubscribe | null = null;
  let lastSnapshotKey = '';

  const attach = (q: ReturnType<typeof query>) => {
    activeUnsub?.();
    activeUnsub = onSnapshot(
      q,
      (snap) => {
        const entries = snap.docs.map((entry) => ({
          id: entry.id,
          data: entry.data() as Record<string, unknown>,
        }));

        void mapConfirmedOrderEntries(entries)
          .then((orders) => {
            const snapshotKey = confirmedOrdersPageSnapshotKey(orders);
            if (snapshotKey === lastSnapshotKey) {
              return;
            }
            lastSnapshotKey = snapshotKey;
            callback(orders);
          })
          .catch((error) => {
            console.warn('[subscribeToConfirmedOrders] snapshot processing failed', error);
          });
      },
      (error) => {
        console.warn('[subscribeToConfirmedOrders] listener failed', error);
        if (q === activeQuery) {
          confirmedOrdersActiveIndexKnownMissing = true;
          attach(legacyActiveQuery);
          return;
        }
        lastSnapshotKey = '';
        callback([]);
      },
    );
  };

  attach(confirmedOrdersActiveIndexKnownMissing ? legacyActiveQuery : activeQuery);

  return () => {
    activeUnsub?.();
  };
}

function emitConfirmedOrdersListFallback(
  params: ConfirmedOrdersListParams,
  callback: (result: {
    orders: MirrorPricingConfirmedOrder[];
    hasMore: boolean;
    lastDoc: DocumentSnapshot | null;
  }) => void,
): void {
  const localPage = getLocalConfirmedOrdersPage(params);
  callback(
    localPage.orders.length > 0
      ? localPage
      : {orders: [], hasMore: true, lastDoc: null},
  );
}

export function subscribeToConfirmedOrdersList(
  params: ConfirmedOrdersListParams,
  callback: (result: {
    orders: MirrorPricingConfirmedOrder[];
    hasMore: boolean;
    lastDoc: DocumentSnapshot | null;
  }) => void,
): Unsubscribe {
  if (isMockMode) {
    const localOrders = useMirrorPricingConfirmedOrdersStore.getState().orders;
    const filtered = filterLocalOrders(localOrders, params);
    callback({
      orders: sortOrders(filtered.slice(0, CONFIRMED_ORDERS_PAGE_SIZE)),
      hasMore: filtered.length > CONFIRMED_ORDERS_PAGE_SIZE,
      lastDoc: null,
    });
    return useMirrorPricingConfirmedOrdersStore.subscribe((state) => {
      const nextFiltered = filterLocalOrders(state.orders, params);
      callback({
        orders: sortOrders(nextFiltered.slice(0, CONFIRMED_ORDERS_PAGE_SIZE)),
        hasMore: nextFiltered.length > CONFIRMED_ORDERS_PAGE_SIZE,
        lastDoc: null,
      });
    });
  }

  const cachedPage = getCachedConfirmedOrdersListPage(params);
  if (cachedPage) {
    callback(cachedPage);
  } else {
    const localPage = getLocalConfirmedOrdersPage(params);
    if (localPage.orders.length > 0) {
      callback(localPage);
    } else {
      callback({orders: [], hasMore: true, lastDoc: null});
    }
  }

  const db = getFirebaseDb();
  let activeUnsub: Unsubscribe | null = null;
  let cancelled = false;

  const attachLegacyListener = () => {
    activeUnsub?.();
    const legacyQuery = buildLegacyConfirmedOrdersListQuery(db, params, CONFIRMED_ORDERS_PAGE_SIZE);

    const emitLegacySnapshot = (
      snap: {docs: Array<{id: string; data: () => Record<string, unknown>}>},
    ) => {
      if (cancelled) {
        return;
      }

      try {
        const result = mapLegacyListSnapshot(snap, params, CONFIRMED_ORDERS_PAGE_SIZE);
        emitConfirmedOrdersListPage(params, result, callback);
      } catch (error) {
        console.warn('[subscribeToConfirmedOrdersList] legacy snapshot processing failed', error);
        emitConfirmedOrdersListFallback(params, callback);
      }
    };

    activeUnsub = onSnapshot(
      legacyQuery,
      emitLegacySnapshot,
      (error) => {
        console.warn('[subscribeToConfirmedOrdersList] legacy query failed', error);
        emitLegacySnapshot({docs: []});
      },
    );
  };

  const attachIndexedListener = () => {
    activeUnsub?.();
    const indexedQuery = buildConfirmedOrdersListQuery(db, params, CONFIRMED_ORDERS_PAGE_SIZE);
    activeUnsub = onSnapshot(
      indexedQuery,
      (snap) => {
        if (cancelled) {
          return;
        }

        try {
          emitConfirmedOrdersListPage(
            params,
            {
              orders: sortOrders(snap.docs.map((entry) => mapConfirmedOrder(entry.id, entry.data()))),
              hasMore: snap.docs.length >= CONFIRMED_ORDERS_PAGE_SIZE,
              lastDoc: snap.docs[snap.docs.length - 1] ?? null,
            },
            callback,
          );
        } catch (error) {
          console.warn('[subscribeToConfirmedOrdersList] indexed snapshot processing failed', error);
          emitConfirmedOrdersListFallback(params, callback);
        }
      },
      (error) => {
        console.warn('[subscribeToConfirmedOrdersList] indexed query failed, using legacy', error);
        attachLegacyListener();
      },
    );
  };

  attachIndexedListener();

  return () => {
    cancelled = true;
    activeUnsub?.();
  };
}

export async function fetchMoreConfirmedOrders(
  params: ConfirmedOrdersListParams,
  cursor: DocumentSnapshot,
): Promise<{
  orders: MirrorPricingConfirmedOrder[];
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
}> {
  if (isMockMode) {
    return {orders: [], hasMore: false, lastDoc: null};
  }

  try {
    const indexed = await fetchIndexedConfirmedOrdersPage(params, CONFIRMED_ORDERS_PAGE_SIZE, cursor);
    if (indexed.orders.length > 0) {
      return indexed;
    }
  } catch {
    // fall through to legacy pagination
  }

  return fetchLegacyConfirmedOrdersPage(params, CONFIRMED_ORDERS_PAGE_SIZE, cursor);
}

export async function getConfirmedOrdersListCount(params: ConfirmedOrdersListParams): Promise<number> {
  if (isMockMode) {
    return filterLocalOrders(useMirrorPricingConfirmedOrdersStore.getState().orders, params).length;
  }

  const db = getFirebaseDb();

  if (params.activeOnly) {
    try {
      const snap = await getCountFromServer(
        query(collection(db, MIRROR_CONFIRMED_ORDERS), where('isOrderActive', '==', true)),
      );
      return snap.data().count;
    } catch (error) {
      console.warn('[getConfirmedOrdersListCount] activeOnly count failed', error);
      return filterLocalOrders(useMirrorPricingConfirmedOrdersStore.getState().orders, params).length;
    }
  }

  if (params.homeCardId) {
    try {
      const snap = await getCountFromServer(
        query(collection(db, MIRROR_CONFIRMED_ORDERS), where('homeCardId', '==', params.homeCardId)),
      );
      return snap.data().count;
    } catch (error) {
      console.warn('[getConfirmedOrdersListCount] homeCardId count failed', error);
    }
  }

  const listBucket = resolveListParamsBucket(params);
  if (listBucket === 'active') {
    return 0;
  }

  const countQuery = query(
    collection(db, MIRROR_CONFIRMED_ORDERS),
    where('listBucket', '==', listBucket),
    ...(params.outstandingOnly ? [where('hasOutstandingBalance', '==', true)] : []),
  );

  try {
    const snap = await getCountFromServer(countQuery);
    return snap.data().count;
  } catch (error) {
    console.warn('[getConfirmedOrdersListCount] indexed count failed', error);
  }

  try {
    const legacyPage = await fetchLegacyConfirmedOrdersPage(params, CONFIRMED_ORDERS_PAGE_SIZE);
    if (legacyPage.orders.length === 0) {
      return 0;
    }

    const statusCountSnap = await getCountFromServer(
      query(
        collection(db, MIRROR_CONFIRMED_ORDERS),
        where('status', '==', resolveLegacyListStatus(params)),
      ),
    );
    return statusCountSnap.data().count;
  } catch (error) {
    console.warn('[getConfirmedOrdersListCount] legacy count failed', error);
    return 0;
  }
}

export async function getPaymentFollowUpCountForListBucket(
  listBucket: ConfirmedOrderListBucket,
): Promise<number> {
  if (isMockMode) {
    return useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.filter(
        (order) =>
          resolveConfirmedOrderIndexFields(order).listBucket === listBucket &&
          order.paymentFollowUpRequired === true,
      ).length;
  }

  const db = getFirebaseDb();
  const countQuery = query(
    collection(db, MIRROR_CONFIRMED_ORDERS),
    where('listBucket', '==', listBucket),
    where('paymentFollowUpRequired', '==', true),
  );

  try {
    const snap = await getCountFromServer(countQuery);
    return snap.data().count;
  } catch (error) {
    console.warn('[getPaymentFollowUpCountForListBucket]', error);
    return 0;
  }
}

export async function migrateConfirmedOrdersIndexFieldsBatch(
  cursor?: DocumentSnapshot,
): Promise<{updated: number; nextCursor: DocumentSnapshot | null; done: boolean}> {
  if (isMockMode || !isFirebaseConfigured) {
    return {updated: 0, nextCursor: null, done: true};
  }

  const db = getFirebaseDb();
  const migrationQuery = query(
    collection(db, MIRROR_CONFIRMED_ORDERS),
    orderBy('confirmedAt', 'desc'),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(INDEX_MIGRATION_BATCH_SIZE),
  );

  let snap;
  try {
    snap = await getDocs(migrationQuery);
  } catch (error) {
    console.warn('[migrateConfirmedOrdersIndexFieldsBatch] read failed', error);
    return {updated: 0, nextCursor: null, done: true};
  }
  if (snap.empty) {
    return {updated: 0, nextCursor: null, done: true};
  }

  const batch = writeBatch(db);
  let updated = 0;

  for (const entry of snap.docs) {
    const data = entry.data();
    const mapped = mapConfirmedOrder(entry.id, data);
    const indexFields = resolveConfirmedOrderIndexFields(mapped);
    const needsUpdate =
      !data.listBucket ||
      data.hasOutstandingBalance === undefined ||
      data.isOrderActive === undefined ||
      !data.status ||
      !data.statusChangedAt;

    if (!needsUpdate) {
      continue;
    }

    const patch: Record<string, unknown> = {
      ...indexFields,
      status: mapped.status,
    };
    if (!mapped.statusChangedAt && mapped.confirmedAt) {
      patch.statusChangedAt = mapped.confirmedAt;
    } else if (mapped.statusChangedAt) {
      patch.statusChangedAt = mapped.statusChangedAt;
    }
    batch.update(entry.ref, patch);
    updated += 1;
  }

  if (updated > 0) {
    try {
      await batch.commit();
    } catch (error) {
      console.warn('[migrateConfirmedOrdersIndexFieldsBatch] write failed', error);
      return {updated: 0, nextCursor: null, done: true};
    }
  }

  return {
    updated,
    nextCursor: snap.docs[snap.docs.length - 1] ?? null,
    done: false,
  };
}

function filterLocalOrders(
  orders: MirrorPricingConfirmedOrder[],
  params: ConfirmedOrdersListParams,
): MirrorPricingConfirmedOrder[] {
  return orders.filter((order) => {
    if (params.activeOnly) {
      return resolveOrderIsActive(order);
    }

    if (params.homeCardId) {
      return order.homeCardId === params.homeCardId;
    }
    if (order.homeCardId) {
      return false;
    }
    if (resolveMirrorPricingOrderStatus(order.status) !== (params.statusFilter ?? 'preparation')) {
      return false;
    }
    if (params.outstandingOnly) {
      return order.hasOutstandingBalance === true || hasConfirmedOrderOutstandingBalance(order);
    }
    return true;
  });
}

export function filterConfirmedOrdersForListParams(
  orders: MirrorPricingConfirmedOrder[],
  params: ConfirmedOrdersListParams,
): MirrorPricingConfirmedOrder[] {
  return filterLocalOrders(orders, params);
}

export function getLocalConfirmedOrdersPage(
  params: ConfirmedOrdersListParams,
  pageSize: number = CONFIRMED_ORDERS_PAGE_SIZE,
): {
  orders: MirrorPricingConfirmedOrder[];
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
} {
  const filtered = filterLocalOrders(useMirrorPricingConfirmedOrdersStore.getState().orders, params);
  const orders = sortOrders(filtered).slice(0, pageSize);
  return {
    orders,
    hasMore: filtered.length > pageSize,
    lastDoc: null,
  };
}

function emitConfirmedOrdersListPage(
  params: ConfirmedOrdersListParams,
  page: {
    orders: MirrorPricingConfirmedOrder[];
    hasMore: boolean;
    lastDoc: DocumentSnapshot | null;
  },
  callback: (result: {
    orders: MirrorPricingConfirmedOrder[];
    hasMore: boolean;
    lastDoc: DocumentSnapshot | null;
  }) => void,
): void {
  setCachedConfirmedOrdersListPage(params, page);
  callback(page);
}

const prefetchInFlight = new Set<string>();

export async function prefetchConfirmedOrdersListPages(
  paramsList: ConfirmedOrdersListParams[],
): Promise<void> {
  if (isMockMode) {
    return;
  }

  await Promise.all(
    paramsList.map(async (params) => {
      const cacheKey = getConfirmedOrdersListCacheKey(params);
      if (getCachedConfirmedOrdersListPage(params) || prefetchInFlight.has(cacheKey)) {
        return;
      }

      prefetchInFlight.add(cacheKey);
      try {
        const indexed = await fetchIndexedConfirmedOrdersPage(params, CONFIRMED_ORDERS_PAGE_SIZE);
        if (indexed.orders.length > 0) {
          setCachedConfirmedOrdersListPage(params, indexed);
          return;
        }

        const legacy = await fetchLegacyConfirmedOrdersPage(params, CONFIRMED_ORDERS_PAGE_SIZE);
        if (legacy.orders.length > 0) {
          setCachedConfirmedOrdersListPage(params, legacy);
        }
      } catch {
        // ignore prefetch failures
      } finally {
        prefetchInFlight.delete(cacheKey);
      }
    }),
  );
}

const MAX_INVOICE_NUMBER_FOR_PREFIX_SEARCH = 999_999;
const INVOICE_PREFIX_RANGE_RESULT_LIMIT = 20;
const INVOICE_SEARCH_CACHE_TTL_MS = 90_000;

const invoiceSearchCache = new Map<
  string,
  {fetchedAt: number; orders: MirrorPricingConfirmedOrder[]}
>();
const invoiceSearchInflight = new Map<string, Promise<MirrorPricingConfirmedOrder[]>>();

function readInvoiceSearchCache(digits: string): MirrorPricingConfirmedOrder[] | null {
  const cached = invoiceSearchCache.get(digits);
  if (!cached) {
    return null;
  }
  if (Date.now() - cached.fetchedAt > INVOICE_SEARCH_CACHE_TTL_MS) {
    invoiceSearchCache.delete(digits);
    return null;
  }
  return cached.orders;
}

function writeInvoiceSearchCache(digits: string, orders: MirrorPricingConfirmedOrder[]): void {
  invoiceSearchCache.set(digits, {fetchedAt: Date.now(), orders});
}

async function fetchConfirmedOrdersByInvoiceEquality(
  db: ReturnType<typeof getFirebaseDb>,
  invoiceNumber: number,
): Promise<MirrorPricingConfirmedOrder[]> {
  const snap = await getDocs(
    query(
      collection(db, MIRROR_CONFIRMED_ORDERS),
      where('invoiceNumber', '==', invoiceNumber),
      limit(1),
    ),
  );
  return snap.docs.map((entry) => mapConfirmedOrder(entry.id, entry.data()));
}

async function fetchConfirmedOrdersByInvoiceRange(
  db: ReturnType<typeof getFirebaseDb>,
  range: {min: number; max: number},
  prefixDigits: string,
): Promise<MirrorPricingConfirmedOrder[]> {
  const snap = await getDocs(
    query(
      collection(db, MIRROR_CONFIRMED_ORDERS),
      where('invoiceNumber', '>=', range.min),
      where('invoiceNumber', '<=', range.max),
      orderBy('invoiceNumber', 'asc'),
      limit(INVOICE_PREFIX_RANGE_RESULT_LIMIT),
    ),
  );
  return snap.docs
    .map((entry) => mapConfirmedOrder(entry.id, entry.data()))
    .filter((order) => String(order.invoiceNumber ?? '').startsWith(prefixDigits));
}

function buildInvoicePrefixRanges(prefixDigits: string): Array<{min: number; max: number}> {
  const base = Number.parseInt(prefixDigits, 10);
  if (!Number.isFinite(base) || base < 0) {
    return [];
  }

  const ranges: Array<{min: number; max: number}> = [];
  let factor = 1;
  while (base * factor <= MAX_INVOICE_NUMBER_FOR_PREFIX_SEARCH) {
    const min = base * factor;
    const max = Math.min((base + 1) * factor - 1, MAX_INVOICE_NUMBER_FOR_PREFIX_SEARCH);
    ranges.push({min, max});
    factor *= 10;
  }
  return ranges;
}

export async function fetchConfirmedOrderById(
  orderId: string,
): Promise<MirrorPricingConfirmedOrder | null> {
  if (!orderId.trim()) {
    return null;
  }

  const local = useMirrorPricingConfirmedOrdersStore
    .getState()
    .orders.find((entry) => entry.id === orderId);
  if (local) {
    return local;
  }

  if (isMockMode || !isFirebaseConfigured) {
    return null;
  }

  try {
    const snap = await getDoc(doc(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS, orderId));
    if (!snap.exists()) {
      return null;
    }
    return mapConfirmedOrder(snap.id, snap.data());
  } catch (error) {
    console.warn('[fetchConfirmedOrderById] failed', error);
    return null;
  }
}

export async function fetchConfirmedOrdersByInvoiceDigits(
  digits: string,
  options?: {exactOnly?: boolean},
): Promise<MirrorPricingConfirmedOrder[]> {
  const prefixDigits = digits.replace(/\D/g, '');
  if (!prefixDigits) {
    return [];
  }

  if (isMockMode || !isFirebaseConfigured) {
    return useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.filter((order) => String(order.invoiceNumber ?? '').startsWith(prefixDigits));
  }

  const cached = readInvoiceSearchCache(
    options?.exactOnly ? `${prefixDigits}:exact` : prefixDigits,
  );
  if (cached) {
    return cached;
  }

  const inflightKey = options?.exactOnly ? `${prefixDigits}:exact` : prefixDigits;
  const inflight = invoiceSearchInflight.get(inflightKey);
  if (inflight) {
    return inflight;
  }

  const promise = (async () => {
    const db = getFirebaseDb();
    const byId = new Map<string, MirrorPricingConfirmedOrder>();
    const invoiceNumber = Number.parseInt(prefixDigits, 10);

    const tasks: Array<Promise<MirrorPricingConfirmedOrder[]>> = [];
    if (Number.isFinite(invoiceNumber) && invoiceNumber > 0) {
      tasks.push(fetchConfirmedOrdersByInvoiceEquality(db, invoiceNumber));
    }

    if (!options?.exactOnly) {
      for (const range of buildInvoicePrefixRanges(prefixDigits)) {
        if (range.min === range.max && range.min === invoiceNumber) {
          continue;
        }
        tasks.push(fetchConfirmedOrdersByInvoiceRange(db, range, prefixDigits));
      }
    }

    const batches = await Promise.all(tasks);
    for (const batch of batches) {
      for (const order of batch) {
        byId.set(order.id, order);
      }
    }

    const orders = sortOrders([...byId.values()]);
    writeInvoiceSearchCache(inflightKey, orders);
    return orders;
  })();

  invoiceSearchInflight.set(inflightKey, promise);
  try {
    return await promise;
  } finally {
    invoiceSearchInflight.delete(inflightKey);
  }
}

const ORDERS_SEARCH_CORPUS_TTL_MS = 5 * 60_000;
let ordersSearchCorpusCache: {fetchedAt: number; orders: MirrorPricingConfirmedOrder[]} | null =
  null;
let ordersSearchCorpusInflight: Promise<MirrorPricingConfirmedOrder[]> | null = null;

/**
 * Full confirmed-orders corpus for search (cached). Used so older orders
 * outside the live local store still appear for every search field.
 */
export async function fetchConfirmedOrdersCorpusForSearch(): Promise<MirrorPricingConfirmedOrder[]> {
  if (isMockMode || !isFirebaseConfigured) {
    return useMirrorPricingConfirmedOrdersStore.getState().orders;
  }

  if (
    ordersSearchCorpusCache &&
    Date.now() - ordersSearchCorpusCache.fetchedAt < ORDERS_SEARCH_CORPUS_TTL_MS
  ) {
    return ordersSearchCorpusCache.orders;
  }

  if (ordersSearchCorpusInflight) {
    return ordersSearchCorpusInflight;
  }

  ordersSearchCorpusInflight = (async () => {
    try {
      const orders = await getAllConfirmedOrders();
      ordersSearchCorpusCache = {fetchedAt: Date.now(), orders};
      return orders;
    } finally {
      ordersSearchCorpusInflight = null;
    }
  })();

  return ordersSearchCorpusInflight;
}

/**
 * Remote search corpus for queries that may not be in the local store yet.
 * Always returns the full cached order set so every search field (invoice,
 * phone, customer, employee/confirmed-by, notes, amounts, dates, …) can match
 * old orders the same way as recent ones.
 */
export async function fetchConfirmedOrdersForSearchQuery(
  _searchQuery?: string,
): Promise<MirrorPricingConfirmedOrder[]> {
  return fetchConfirmedOrdersCorpusForSearch();
}

export async function getAllConfirmedOrders(): Promise<MirrorPricingConfirmedOrder[]> {
  if (isMockMode || !isFirebaseConfigured) {
    return useMirrorPricingConfirmedOrdersStore.getState().orders;
  }

  try {
    const snap = await getDocs(collection(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS));
    return sortOrders(snap.docs.map((entry) => mapConfirmedOrder(entry.id, entry.data())));
  } catch (error) {
    console.warn('[getAllConfirmedOrders] falling back to local store', error);
    return useMirrorPricingConfirmedOrdersStore.getState().orders;
  }
}

/** Pre-generate a Firestore document id so the UI can confirm instantly. */
export function createConfirmedOrderDraftId(): string {
  if (isMockMode || !isFirebaseConfigured) {
    return `confirmed-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  return doc(collection(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS)).id;
}

export function buildConfirmedOrderRecord(
  order: Omit<MirrorPricingConfirmedOrder, 'id' | 'confirmedAt'>,
  orderId: string,
  confirmedAt: string = new Date().toISOString(),
): MirrorPricingConfirmedOrder {
  const status = order.status ?? 'preparation';
  const indexFields = resolveConfirmedOrderIndexFields({
    ...order,
    status,
  });

  return {
    ...order,
    ...indexFields,
    id: orderId,
    status,
    invoiceNumber: normalizeMirrorOrderInvoiceNumber(order.invoiceNumber),
    confirmedAt,
    statusChangedAt: confirmedAt,
  };
}

export async function reconcileMirrorOrderInvoiceCounter(assignedNumber: number): Promise<void> {
  if (isMockMode || !isFirebaseConfigured) {
    return;
  }

  const normalized = normalizeMirrorOrderInvoiceNumber(assignedNumber);
  if (!normalized) {
    return;
  }

  const db = getFirebaseDb();
  const counterRef = doc(db, ...MIRROR_ORDER_INVOICE_COUNTER_DOC);

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const storedLast = snap.exists() ? Number(snap.data()?.lastNumber ?? 0) : 0;
      const safeStored = Number.isFinite(storedLast) && storedLast >= 0 ? Math.floor(storedLast) : 0;
      if (normalized > safeStored) {
        transaction.set(counterRef, {lastNumber: normalized}, {merge: true});
      }
    });
  } catch {
    // Best-effort — local invoice numbers still work when the counter cannot be updated.
  }
}

/** Writes an already-built order to Firestore (call after optimistic local insert). */
export async function persistConfirmedOrder(order: MirrorPricingConfirmedOrder): Promise<void> {
  if (isMockMode || !isFirebaseConfigured) {
    return;
  }

  const payload = toFirestoreSafePayload({
    ...order,
    invoiceNumber: normalizeMirrorOrderInvoiceNumber(order.invoiceNumber),
    confirmedAt: order.confirmedAt,
    statusChangedAt: order.statusChangedAt ?? order.confirmedAt,
  });

  await setDoc(doc(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS, order.id), payload);
  void reconcileMirrorOrderInvoiceCounter(order.invoiceNumber ?? 0);
  setTimeout(() => {
    recordConfirmedOrderNotification(order);
  }, 0);
}

export async function createConfirmedOrder(
  order: Omit<MirrorPricingConfirmedOrder, 'id' | 'confirmedAt'>,
): Promise<string> {
  if (isMockMode) {
    throw new Error('Confirmed orders are local-only in mock mode.');
  }

  const savedOrder = buildConfirmedOrderRecord(order, createConfirmedOrderDraftId());
  useMirrorPricingConfirmedOrdersStore.getState().upsertOrders([savedOrder]);
  enableOrdersBackgroundSync();
  await persistConfirmedOrder(savedOrder);
  return savedOrder.id;
}

export function getConfirmedOrderSaveErrorKey(error: unknown): string {
  const code = (error as {code?: string})?.code;
  if (code === 'permission-denied') {
    return 'confirmedOrderSavePermissionDenied';
  }
  if (code === 'unavailable' || code === 'failed-precondition') {
    return 'confirmedOrderSaveOffline';
  }
  return 'saveFailed';
}

export async function updateConfirmedOrderStatus(
  orderId: string,
  status: MirrorPricingOrderStatus,
): Promise<void> {
  if (isMockMode) {
    return;
  }

  const current = useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === orderId);
  const indexFields = resolveConfirmedOrderIndexFields({
    status,
    homeCardId: current?.homeCardId,
    total: current?.total ?? 0,
    collectedAmount: current?.collectedAmount ?? 0,
    remainingAmount: current?.remainingAmount,
    paymentFollowUpRequired: current?.paymentFollowUpRequired,
  });

  await updateDoc(doc(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS, orderId), {
    status,
    statusChangedAt: new Date().toISOString(),
    listBucket: indexFields.listBucket,
    hasOutstandingBalance: indexFields.hasOutstandingBalance,
    isOrderActive: indexFields.isOrderActive,
  });
}

export type ConfirmedOrderUpdatePayload = Pick<
  MirrorPricingConfirmedOrder,
  | 'customerName'
  | 'fulfillmentType'
  | 'customerPhone'
  | 'customerPhone2'
  | 'customerLocation'
  | 'customerNotes'
  | 'customerPhotosLink'
  | 'catalogMirrorImages'
  | 'catalogMirrorImageAnnotationData'
  | 'studioOrderImages'
  | 'collectedAmount'
  | 'subtotal'
  | 'discountAmount'
  | 'total'
  | 'remainingAmount'
  | 'items'
  | 'status'
  | 'statusChangedAt'
  | 'lastMovedByUserId'
  | 'lastMovedByUserName'
  | 'lastMovedFromLabel'
  | 'lastMovedToLabel'
  | 'homeCardId'
  | 'paymentFollowUpRequired'
  | 'paymentFollowUpNote'
  | 'paymentFollowUpAt'
  | 'orderCardNote'
  | 'priorCollectedAmount'
  | 'invoiceExtraLines'
  | 'invoiceNote'
  | 'isFavorite'
  | 'favoritedAt'
>;

export async function updateConfirmedOrder(
  orderId: string,
  updates: ConfirmedOrderUpdatePayload,
): Promise<void> {
  if (isMockMode) {
    return;
  }

  const payload: Record<string, unknown> = {
    ...toFirestoreSafePayload(updates),
    status: resolveMirrorPricingOrderStatus(updates.status),
  };
  const updatedAt = new Date().toISOString();
  payload.lastUpdatedAt = updatedAt;
  const currentUser = useAuthStore.getState().user;
  if (currentUser?.id) {
    payload.lastUpdatedByUserId = currentUser.id;
  }

  const current = useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === orderId);
  const mergedForIndex = {
    status: resolveMirrorPricingOrderStatus(updates.status ?? current?.status),
    homeCardId: 'homeCardId' in updates ? updates.homeCardId : current?.homeCardId,
    total: updates.total ?? current?.total ?? 0,
    collectedAmount: updates.collectedAmount ?? current?.collectedAmount ?? 0,
    remainingAmount: updates.remainingAmount ?? current?.remainingAmount,
    paymentFollowUpRequired: updates.paymentFollowUpRequired ?? current?.paymentFollowUpRequired,
  };
  const indexFields = resolveConfirmedOrderIndexFields(mergedForIndex);
  payload.listBucket = indexFields.listBucket;
  payload.hasOutstandingBalance = indexFields.hasOutstandingBalance;
  payload.isOrderActive = indexFields.isOrderActive;

  if ('homeCardId' in updates && updates.homeCardId === undefined) {
    payload.homeCardId = deleteField();
  }

  if ('paymentFollowUpNote' in updates && updates.paymentFollowUpNote === undefined) {
    payload.paymentFollowUpNote = deleteField();
  }

  if ('paymentFollowUpAt' in updates && updates.paymentFollowUpAt === undefined) {
    payload.paymentFollowUpAt = deleteField();
  }

  if ('orderCardNote' in updates && updates.orderCardNote === undefined) {
    payload.orderCardNote = deleteField();
  }

  if ('priorCollectedAmount' in updates && updates.priorCollectedAmount === undefined) {
    payload.priorCollectedAmount = deleteField();
  }

  if ('catalogMirrorImages' in updates && updates.catalogMirrorImages === undefined) {
    payload.catalogMirrorImages = deleteField();
  }

  if (
    'catalogMirrorImageAnnotationData' in updates &&
    updates.catalogMirrorImageAnnotationData === undefined
  ) {
    payload.catalogMirrorImageAnnotationData = deleteField();
  }

  if ('studioOrderImages' in updates && updates.studioOrderImages === undefined) {
    payload.studioOrderImages = deleteField();
  }

  if ('invoiceExtraLines' in updates && updates.invoiceExtraLines === undefined) {
    payload.invoiceExtraLines = deleteField();
  }

  if ('invoiceNote' in updates && updates.invoiceNote === undefined) {
    payload.invoiceNote = deleteField();
  }

  if ('customerPhone2' in updates && updates.customerPhone2 === undefined) {
    payload.customerPhone2 = deleteField();
  }

  if ('isFavorite' in updates && updates.isFavorite === false) {
    payload.isFavorite = false;
    payload.favoritedAt = deleteField();
  } else if ('favoritedAt' in updates && updates.favoritedAt === undefined) {
    payload.favoritedAt = deleteField();
  }

  await updateDoc(doc(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS, orderId), payload);

  if (
    updates.lastMovedByUserId &&
    updates.lastMovedFromLabel &&
    updates.lastMovedToLabel &&
    updates.statusChangedAt &&
    current
  ) {
    recordOrderMoveNotification({
      ...current,
      ...updates,
      status: resolveMirrorPricingOrderStatus(updates.status ?? current.status),
    });
    return;
  }

  if (current) {
    recordOrderUpdatedNotification(
      {
        ...current,
        ...updates,
        status: resolveMirrorPricingOrderStatus(updates.status ?? current.status),
      },
      updatedAt,
    );
  }
}

export async function updateConfirmedOrderCatalogAnnotationData(
  orderId: string,
  annotationData: CatalogMirrorImageAnnotationData | undefined,
): Promise<void> {
  if (isMockMode) {
    return;
  }

  const updatedAt = new Date().toISOString();
  const currentUser = useAuthStore.getState().user;
  const updatePayload: Record<string, unknown> = {
    catalogMirrorImageAnnotationData: annotationData ?? deleteField(),
    lastUpdatedAt: updatedAt,
  };
  if (currentUser?.id) {
    updatePayload.lastUpdatedByUserId = currentUser.id;
  }
  await updateDoc(doc(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS, orderId), updatePayload);
  const current = useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === orderId);
  if (current) {
    recordOrderUpdatedNotification(
      {...current, catalogMirrorImageAnnotationData: annotationData},
      updatedAt,
    );
  }
}

export async function updateConfirmedOrderFavorite(
  orderId: string,
  isFavorite: boolean,
): Promise<void> {
  if (isMockMode) {
    return;
  }

  const updatedAt = new Date().toISOString();
  const currentUser = useAuthStore.getState().user;
  const favoritePayload: Record<string, unknown> = isFavorite
    ? {isFavorite: true, favoritedAt: updatedAt, lastUpdatedAt: updatedAt}
    : {isFavorite: false, favoritedAt: deleteField(), lastUpdatedAt: updatedAt};
  if (currentUser?.id) {
    favoritePayload.lastUpdatedByUserId = currentUser.id;
  }
  await updateDoc(doc(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS, orderId), favoritePayload);
  const current = useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === orderId);
  if (current) {
    recordOrderUpdatedNotification(
      {
        ...current,
        isFavorite,
        favoritedAt: isFavorite ? updatedAt : undefined,
      },
      updatedAt,
    );
  }
}

export async function updateConfirmedOrderCardNote(
  orderId: string,
  note: string | undefined,
): Promise<void> {
  if (isMockMode) {
    return;
  }

  const trimmed = note?.trim();
  const updatedAt = new Date().toISOString();
  const currentUser = useAuthStore.getState().user;
  const notePayload: Record<string, unknown> = trimmed
    ? {orderCardNote: trimmed, lastUpdatedAt: updatedAt}
    : {orderCardNote: deleteField(), lastUpdatedAt: updatedAt};
  if (currentUser?.id) {
    notePayload.lastUpdatedByUserId = currentUser.id;
  }
  await updateDoc(doc(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS, orderId), notePayload);
  const current = useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === orderId);
  if (current) {
    recordOrderUpdatedNotification(
      {...current, orderCardNote: trimmed || undefined},
      updatedAt,
    );
  }
}

export async function deleteConfirmedOrder(orderId: string): Promise<void> {
  const currentUser = useAuthStore.getState().user;
  if (!canDeleteOrders(currentUser)) {
    const error = new Error('permission-denied') as Error & {code?: string};
    error.code = 'permission-denied';
    throw error;
  }

  const store = useMirrorPricingConfirmedOrdersStore.getState();
  const removedOrder = store.orders.find((entry) => entry.id === orderId) ?? null;

  store.removeOrder(orderId);
  removeOrderFromConfirmedOrdersListCache(orderId);

  if (isMockMode) {
    store.acknowledgePendingDeletedOrder(orderId);
    if (removedOrder) {
      recordOrderDeletedNotification(removedOrder, {
        actorUserId: currentUser?.id,
        actorName: currentUser?.name?.trim() || currentUser?.id || '—',
      });
    }
    return;
  }

  try {
    if (isFirebaseConfigured) {
      await deleteDoc(doc(getFirebaseDb(), MIRROR_CONFIRMED_ORDERS, orderId));
    }
    if (removedOrder) {
      recordOrderDeletedNotification(removedOrder, {
        actorUserId: currentUser?.id,
        actorName: currentUser?.name?.trim() || currentUser?.id || '—',
      });
    }
  } catch (error) {
    if (removedOrder) {
      store.restoreOrder(removedOrder);
    } else {
      store.acknowledgePendingDeletedOrder(orderId);
    }
    throw error;
  }
}

export async function deleteAllConfirmedOrders(): Promise<number> {
  if (!isFirebaseConfigured) {
    return 0;
  }

  return deleteAllDocumentsInCollection(MIRROR_CONFIRMED_ORDERS);
}

export async function resetMirrorOrderInvoiceCounter(): Promise<void> {
  if (!isFirebaseConfigured) {
    return;
  }

  const counterRef = doc(getFirebaseDb(), ...MIRROR_ORDER_INVOICE_COUNTER_DOC);
  await setDoc(counterRef, {lastNumber: 0});
}
