import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import dayjs from 'dayjs';
import {isMockMode} from '@app/config/appMode';
import {
  ADMIN_TRANSACTIONS_LIVE_LIMIT,
  FIRESTORE_IN_QUERY_CHUNK_SIZE,
  FIRESTORE_MAX_QUERY_LIMIT,
  USER_TRANSACTIONS_LIVE_LIMIT,
} from '@app/constants/performanceLimits';
import {getFirebaseDb, isFirebaseConfigured} from '@app/config/firebase';
import {deleteAllDocumentsInCollection} from '@app/utils/firestoreBatchDelete';
import {subscribeMockDb, useMockDb} from '@app/mock/mockDb';
import {applyUserBalanceDelta} from '@app/services/userBalance.service';
import type {AppUser, Transaction, TransactionType, UserRole} from '@app/types/models';
import {canPersistStoredBalance} from '@app/utils/financePermissions';
import {
  affectsUserStoredBalance,
  filterAdvanceScopeTransactions,
  filterCashScopeTransactions,
  filterCustomLedgerTransactions,
  normalizeTransactionAmount,
  normalizeTransactionType,
} from '@app/utils/financeTotals';
import {shouldPinTransactionOnCreate} from '@app/utils/financePermissions';
import {
  recordFinanceTransactionCreated,
  recordFinanceTransactionDeleted,
  recordFinanceTransactionUpdated,
} from '@app/utils/recordAdminOperationNotifications';

const TRANSACTIONS = 'transactions';
const USERS = 'users';

function shouldApplyBalanceDelta(
  delta: number,
  type: TransactionType,
  ledgerId: string | undefined,
  viewer: AppUser | null | undefined,
  userId: string,
  targetRole: UserRole,
): boolean {
  return (
    Math.abs(delta) >= 0.005 &&
    affectsUserStoredBalance(type, ledgerId) &&
    canPersistStoredBalance(viewer, {id: userId, role: targetRole})
  );
}

function chunkUserIds(userIds: string[]): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < userIds.length; index += FIRESTORE_IN_QUERY_CHUNK_SIZE) {
    chunks.push(userIds.slice(index, index + FIRESTORE_IN_QUERY_CHUNK_SIZE));
  }
  return chunks;
}

function isFirestoreIndexPendingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('currently building') ||
    message.includes('requires an index') ||
    message.includes('FAILED_PRECONDITION')
  );
}

const SHARED_LEDGER_INDEX_RETRY_MS = 15_000;

function subscribeToQueryWithIndexRetry(
  q: ReturnType<typeof query>,
  bucketKey: string,
  logLabel: string,
  onData: (transactions: Transaction[]) => void,
  onEmpty: () => void,
): Unsubscribe {
  let activeUnsub: Unsubscribe | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const attach = () => {
    if (cancelled) {
      return;
    }

    activeUnsub = onSnapshot(
      q,
      (snap) => {
        clearRetry();
        onData(snap.docs.map((d) => mapTransaction(d.id, d.data())));
      },
      (error) => {
        if (!cancelled && isFirestoreIndexPendingError(error)) {
          console.warn(`[${logLabel}] Firestore index pending for ${bucketKey}, retrying soon`);
          activeUnsub?.();
          activeUnsub = null;
          onEmpty();
          clearRetry();
          retryTimer = setTimeout(attach, SHARED_LEDGER_INDEX_RETRY_MS);
          return;
        }

        console.error(`[${logLabel}]`, bucketKey, error);
        onEmpty();
      },
    );
  };

  attach();

  return () => {
    cancelled = true;
    clearRetry();
    activeUnsub?.();
    activeUnsub = null;
  };
}

function sortTransactionsNewestFirst(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function capTransactions(list: Transaction[], max: number): Transaction[] {
  if (list.length <= max) {
    return list;
  }
  return sortTransactionsNewestFirst(list).slice(0, max);
}

async function syncUserBalanceSafely(
  userId: string,
  delta: number,
  viewer: AppUser | null | undefined,
  targetRole: UserRole = 'employee',
  type: TransactionType = 'received',
  ledgerId?: string,
): Promise<void> {
  if (!shouldApplyBalanceDelta(delta, type, ledgerId, viewer, userId, targetRole)) {
    return;
  }

  try {
    await applyUserBalanceDelta(userId, delta);
  } catch (error) {
    console.warn('[transactions.service] balance sync failed', {userId, delta, error});
  }
}

function mapTransaction(id: string, data: Record<string, unknown>): Transaction {
  const createdAt = data.createdAt;
  const createdAtStr =
    createdAt && typeof createdAt === 'object' && 'toDate' in createdAt
      ? dayjs((createdAt as {toDate: () => Date}).toDate()).toISOString()
      : String(createdAt ?? '');
  const rawType = String(data.type ?? 'received');
  const createdByRole = data.createdByRole;
  const parsedRole =
    createdByRole === 'admin' || createdByRole === 'employee' ? createdByRole : undefined;

  return {
    id,
    userId: String(data.userId ?? ''),
    type: normalizeTransactionType(rawType),
    amount: normalizeTransactionAmount(rawType, Number(data.amount ?? 0)),
    note: String(data.note ?? ''),
    createdAt: createdAtStr,
    isPinned: data.isPinned === undefined ? undefined : Boolean(data.isPinned),
    pinnedAt: data.pinnedAt ? String(data.pinnedAt) : undefined,
    createdByUserId: data.createdByUserId ? String(data.createdByUserId) : undefined,
    createdByRole: parsedRole,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    updatedByUserId: data.updatedByUserId ? String(data.updatedByUserId) : undefined,
    ledgerId: data.ledgerId ? String(data.ledgerId) : undefined,
  };
}

export function subscribeToUserTransactions(
  userId: string,
  callback: (transactions: Transaction[]) => void,
): Unsubscribe {
  if (isMockMode) {
    const emit = () => {
      const list = capTransactions(
        useMockDb
          .getState()
          .transactions.filter((t) => t.userId === userId),
        USER_TRANSACTIONS_LIVE_LIMIT,
      );
      callback(list);
    };
    emit();
    return subscribeMockDb(emit);
  }
  const q = query(
    collection(getFirebaseDb(), TRANSACTIONS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(USER_TRANSACTIONS_LIVE_LIMIT),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => mapTransaction(d.id, d.data()));
      callback(list);
    },
    (error) => {
      console.error('[subscribeToUserTransactions]', error);
      callback([]);
    },
  );
}

export function subscribeToAllTransactions(
  callback: (transactions: Transaction[]) => void,
): Unsubscribe {
  if (isMockMode) {
    const emit = () => {
      const list = capTransactions(useMockDb.getState().transactions, ADMIN_TRANSACTIONS_LIVE_LIMIT);
      callback(list);
    };
    emit();
    return subscribeMockDb(emit);
  }

  const q = query(
    collection(getFirebaseDb(), TRANSACTIONS),
    orderBy('createdAt', 'desc'),
    limit(ADMIN_TRANSACTIONS_LIVE_LIMIT),
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => mapTransaction(d.id, d.data()));
      callback(list);
    },
    (error) => {
      console.error('[subscribeToAllTransactions]', error);
      callback([]);
    },
  );
}

export interface SharedLedgerTransactionScope {
  userId: string;
  ledgerId: string;
}

/** Subscribe to transactions for explicitly shared finance ledgers (employee delegated access). */
export function subscribeToSharedLedgerTransactions(
  scopes: SharedLedgerTransactionScope[],
  callback: (transactions: Transaction[]) => void,
): Unsubscribe {
  const uniqueScopes = [
    ...new Map(
      scopes
        .filter((scope) => scope.userId && scope.ledgerId)
        .map((scope) => [`${scope.userId}:${scope.ledgerId}`, scope] as const),
    ).values(),
  ];

  if (!uniqueScopes.length) {
    callback([]);
    return () => undefined;
  }

  if (isMockMode) {
    const emit = () => {
      const all = useMockDb.getState().transactions;
      const merged = uniqueScopes.flatMap((scope) =>
        filterCustomLedgerTransactions(
          all.filter((tx) => tx.userId === scope.userId),
          scope.ledgerId,
        ),
      );
      callback(capTransactions(sortTransactionsNewestFirst(merged), USER_TRANSACTIONS_LIVE_LIMIT * uniqueScopes.length));
    };
    emit();
    return subscribeMockDb(emit);
  }

  const buckets = new Map<string, Transaction[]>();
  const emit = () => {
    const merged = sortTransactionsNewestFirst([...buckets.values()].flat());
    callback(capTransactions(merged, USER_TRANSACTIONS_LIVE_LIMIT * uniqueScopes.length));
  };

  const unsubs = uniqueScopes.map((scope) => {
    const bucketKey = `${scope.userId}:${scope.ledgerId}`;
    const q = query(
      collection(getFirebaseDb(), TRANSACTIONS),
      where('ledgerId', '==', scope.ledgerId),
      where('userId', '==', scope.userId),
      orderBy('createdAt', 'desc'),
      limit(USER_TRANSACTIONS_LIVE_LIMIT),
    );

    return subscribeToQueryWithIndexRetry(
      q,
      bucketKey,
      'subscribeToSharedLedgerTransactions',
      (transactions) => {
        buckets.set(bucketKey, transactions);
        emit();
      },
      () => {
        buckets.set(bucketKey, []);
        emit();
      },
    );
  });

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
}

/** Subscribe to transactions for a single custom/shared finance ledger. */
export function subscribeToLedgerTransactions(
  userId: string,
  ledgerId: string,
  callback: (transactions: Transaction[]) => void,
): Unsubscribe {
  return subscribeToSharedLedgerTransactions([{userId, ledgerId}], callback);
}

export function subscribeToUsersTransactions(
  userIds: string[],
  callback: (transactions: Transaction[]) => void,
): Unsubscribe {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueUserIds.length) {
    callback([]);
    return () => undefined;
  }

  if (isMockMode) {
    const buckets = new Map<string, Transaction[]>();
    const emit = () => {
      const merged = sortTransactionsNewestFirst([...buckets.values()].flat());
      callback(capTransactions(merged, USER_TRANSACTIONS_LIVE_LIMIT * uniqueUserIds.length));
    };

    const unsubs = uniqueUserIds.map((userId) =>
      subscribeToUserTransactions(userId, (transactions) => {
        buckets.set(userId, transactions);
        emit();
      }),
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }

  const chunks = chunkUserIds(uniqueUserIds);
  const buckets = new Map<number, Transaction[]>();
  const emit = () => {
    const merged = sortTransactionsNewestFirst([...buckets.values()].flat());
    callback(merged);
  };

  const unsubs = chunks.map((chunkIds, chunkIndex) => {
    const q = query(
      collection(getFirebaseDb(), TRANSACTIONS),
      where('userId', 'in', chunkIds),
      orderBy('createdAt', 'desc'),
      limit(Math.min(FIRESTORE_MAX_QUERY_LIMIT, USER_TRANSACTIONS_LIVE_LIMIT * chunkIds.length)),
    );
    return onSnapshot(
      q,
      (snap) => {
        buckets.set(
          chunkIndex,
          snap.docs.map((d) => mapTransaction(d.id, d.data())),
        );
        emit();
      },
      (error) => {
        console.error('[subscribeToUsersTransactions]', error);
        buckets.set(chunkIndex, []);
        emit();
      },
    );
  });

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
}

export async function getAllTransactions(users: AppUser[] = []): Promise<Transaction[]> {
  if (isMockMode) {
    return [...useMockDb.getState().transactions].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  try {
    const snap = await getDocs(collection(getFirebaseDb(), TRANSACTIONS));
    return snap.docs
      .map((d) => mapTransaction(d.id, d.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    console.warn('[getAllTransactions] collection query failed, falling back per user', error);
  }

  if (!users.length) {
    return [];
  }

  const perUser = await Promise.all(
    users.map(async (user) => {
      const q = query(collection(getFirebaseDb(), TRANSACTIONS), where('userId', '==', user.id));
      const snap = await getDocs(q);
      return snap.docs.map((d) => mapTransaction(d.id, d.data()));
    }),
  );

  return perUser
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createTransaction(
  userId: string,
  type: TransactionType,
  amount: number,
  note: string,
  options?: {
    createdByUserId?: string;
    createdByRole?: UserRole;
    ledgerId?: string;
    pinOnCreate?: boolean;
    targetRole?: UserRole;
    balanceSyncViewer?: AppUser | null;
  },
): Promise<void> {
  const signedAmount = normalizeTransactionAmount(type, amount);
  const createdByRole = options?.createdByRole;
  const isPinned =
    options?.pinOnCreate === false
      ? false
      : createdByRole
        ? shouldPinTransactionOnCreate(createdByRole)
        : false;
  const now = new Date().toISOString();
  const metadata = {
    ...(options?.createdByUserId ? {createdByUserId: options.createdByUserId} : {}),
    ...(createdByRole ? {createdByRole} : {}),
    ...(isPinned ? {isPinned: true, pinnedAt: now} : {}),
    ...(options?.ledgerId ? {ledgerId: options.ledgerId} : {}),
  };

  if (isMockMode) {
    useMockDb.getState().addTransaction(userId, type, amount, note, metadata);
    return;
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);
  const txRef = doc(collection(db, TRANSACTIONS));
  batch.set(txRef, {
    userId,
    type,
    amount: signedAmount,
    note,
    createdAt: now,
    ...metadata,
  });

  if (
    shouldApplyBalanceDelta(
      signedAmount,
      type,
      options?.ledgerId,
      options?.balanceSyncViewer,
      userId,
      options?.targetRole ?? 'employee',
    )
  ) {
    batch.update(doc(db, USERS, userId), {balance: increment(signedAmount)});
  }

  await batch.commit();

  recordFinanceTransactionCreated({
    id: txRef.id,
    userId,
    type,
    amount: signedAmount,
    note,
    createdAt: now,
    ...metadata,
  });
}

export async function updateTransaction(
  transaction: Transaction,
  updates: {amount: number; note: string},
  updatedByUserId: string,
  options?: {balanceSyncViewer?: AppUser | null; targetRole?: UserRole},
): Promise<void> {
  const nextAmount = normalizeTransactionAmount(transaction.type, updates.amount);
  const balanceDelta = nextAmount - transaction.amount;
  const now = new Date().toISOString();

  if (isMockMode) {
    useMockDb.getState().updateTransaction(transaction.id, {
      amount: nextAmount,
      note: updates.note,
      updatedAt: now,
      updatedByUserId,
    }, balanceDelta);
    recordFinanceTransactionUpdated({
      ...transaction,
      amount: nextAmount,
      note: updates.note,
      updatedAt: now,
      updatedByUserId,
    });
    return;
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);
  batch.update(doc(db, TRANSACTIONS, transaction.id), {
    amount: nextAmount,
    note: updates.note,
    updatedAt: now,
    updatedByUserId,
  });

  if (
    shouldApplyBalanceDelta(
      balanceDelta,
      transaction.type,
      transaction.ledgerId,
      options?.balanceSyncViewer,
      transaction.userId,
      options?.targetRole ?? 'employee',
    )
  ) {
    batch.update(doc(db, USERS, transaction.userId), {balance: increment(balanceDelta)});
  }

  await batch.commit();

  recordFinanceTransactionUpdated({
    ...transaction,
    amount: nextAmount,
    note: updates.note,
    updatedAt: now,
    updatedByUserId,
  });
}

export async function deleteTransaction(
  transaction: Transaction,
  options?: {balanceSyncViewer?: AppUser | null; targetRole?: UserRole},
): Promise<void> {
  const balanceDelta = -transaction.amount;

  if (isMockMode) {
    useMockDb.getState().deleteTransaction(transaction.id, balanceDelta);
    if (!isFirebaseConfigured) {
      return;
    }
  }

  if (!isFirebaseConfigured) {
    return;
  }

  const db = getFirebaseDb();
  const batch = writeBatch(db);
  batch.delete(doc(db, TRANSACTIONS, transaction.id));

  if (
    shouldApplyBalanceDelta(
      balanceDelta,
      transaction.type,
      transaction.ledgerId,
      options?.balanceSyncViewer,
      transaction.userId,
      options?.targetRole ?? 'employee',
    )
  ) {
    batch.update(doc(db, USERS, transaction.userId), {balance: increment(balanceDelta)});
  }

  await batch.commit();

  recordFinanceTransactionDeleted(transaction);
}

export async function deleteCashScopeTransactionsForUser(
  userId: string,
  transactions: Transaction[],
  options?: {balanceSyncViewer?: AppUser | null; targetRole?: UserRole},
): Promise<number> {
  const toDelete = filterCashScopeTransactions(transactions);
  if (toDelete.length === 0) {
    return 0;
  }

  const balanceDelta = toDelete.reduce((sum, transaction) => sum - transaction.amount, 0);

  if (isMockMode) {
    useMockDb
      .getState()
      .deleteTransactions(
        toDelete.map((transaction) => transaction.id),
        balanceDelta,
        userId,
      );
    if (!isFirebaseConfigured) {
      return toDelete.length;
    }
  }

  if (!isFirebaseConfigured) {
    return 0;
  }

  await Promise.all(
    toDelete.map((transaction) => deleteDoc(doc(getFirebaseDb(), TRANSACTIONS, transaction.id))),
  );

  if (Math.abs(balanceDelta) >= 0.005) {
    await syncUserBalanceSafely(userId, balanceDelta, options?.balanceSyncViewer, options?.targetRole ?? 'employee');
  }

  return toDelete.length;
}

export async function deleteAdvanceScopeTransactionsForUser(
  userId: string,
  transactions: Transaction[],
  options?: {balanceSyncViewer?: AppUser | null; targetRole?: UserRole},
): Promise<number> {
  const toDelete = filterAdvanceScopeTransactions(transactions);
  if (toDelete.length === 0) {
    return 0;
  }

  const balanceDelta = toDelete.reduce((sum, transaction) => sum - transaction.amount, 0);

  if (isMockMode) {
    useMockDb
      .getState()
      .deleteTransactions(
        toDelete.map((transaction) => transaction.id),
        balanceDelta,
        userId,
      );
    if (!isFirebaseConfigured) {
      return toDelete.length;
    }
  }

  if (!isFirebaseConfigured) {
    return 0;
  }

  await Promise.all(
    toDelete.map((transaction) => deleteDoc(doc(getFirebaseDb(), TRANSACTIONS, transaction.id))),
  );

  if (Math.abs(balanceDelta) >= 0.005) {
    await syncUserBalanceSafely(userId, balanceDelta, options?.balanceSyncViewer, options?.targetRole ?? 'employee');
  }

  return toDelete.length;
}

export async function deleteLedgerTransactionsForUser(
  userId: string,
  ledgerId: string,
  transactions: Transaction[],
): Promise<number> {
  const toDelete = filterCustomLedgerTransactions(transactions, ledgerId);
  if (toDelete.length === 0) {
    return 0;
  }

  if (isMockMode) {
    useMockDb
      .getState()
      .deleteTransactions(
        toDelete.map((transaction) => transaction.id),
        0,
        userId,
      );
    if (!isFirebaseConfigured) {
      return toDelete.length;
    }
  }

  if (!isFirebaseConfigured) {
    return 0;
  }

  await Promise.all(
    toDelete.map((transaction) => deleteDoc(doc(getFirebaseDb(), TRANSACTIONS, transaction.id))),
  );

  return toDelete.length;
}

export async function deleteAllTransactionsForUser(userId: string): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().deleteAllTransactionsForUser(userId);
    if (!isFirebaseConfigured) {
      return;
    }
  }

  if (!isFirebaseConfigured) {
    return;
  }

  const q = query(collection(getFirebaseDb(), TRANSACTIONS), where('userId', '==', userId));
  const snap = await getDocs(q);
  if (snap.empty) {
    return;
  }

  await Promise.all(snap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
}

export async function deleteAllTransactions(): Promise<number> {
  let count = 0;

  if (isMockMode) {
    count = useMockDb.getState().transactions.length;
    useMockDb.setState({transactions: []});
    if (!isFirebaseConfigured) {
      return count;
    }
  }

  if (!isFirebaseConfigured) {
    return count;
  }

  return deleteAllDocumentsInCollection(TRANSACTIONS);
}
