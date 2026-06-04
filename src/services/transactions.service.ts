import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import dayjs from 'dayjs';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb} from '@app/config/firebase';
import {subscribeMockDb, useMockDb} from '@app/mock/mockDb';
import {updateUserBalance} from '@app/services/users.service';
import type {AppUser, Transaction, TransactionType, UserRole} from '@app/types/models';
import {
  affectsUserStoredBalance,
  filterAdvanceScopeTransactions,
  filterCashScopeTransactions,
  filterCustomLedgerTransactions,
  normalizeTransactionAmount,
  normalizeTransactionType,
} from '@app/utils/financeTotals';
import {shouldPinTransactionOnCreate} from '@app/utils/financePermissions';

const TRANSACTIONS = 'transactions';

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
      const list = useMockDb
        .getState()
        .transactions.filter((t) => t.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      callback(list);
    };
    emit();
    return subscribeMockDb(emit);
  }
  const q = query(collection(getFirebaseDb(), TRANSACTIONS), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapTransaction(d.id, d.data()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
      const list = [...useMockDb.getState().transactions].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      callback(list);
    };
    emit();
    return subscribeMockDb(emit);
  }

  return onSnapshot(
    collection(getFirebaseDb(), TRANSACTIONS),
    (snap) => {
      const list = snap.docs
        .map((d) => mapTransaction(d.id, d.data()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      callback(list);
    },
    (error) => {
      console.error('[subscribeToAllTransactions]', error);
      callback([]);
    },
  );
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

  await addDoc(collection(getFirebaseDb(), TRANSACTIONS), {
    userId,
    type,
    amount: signedAmount,
    note,
    createdAt: now,
    ...metadata,
  });

  if (affectsUserStoredBalance(type, options?.ledgerId)) {
    await updateUserBalance(userId, signedAmount);
  }
}

export async function updateTransaction(
  transaction: Transaction,
  updates: {amount: number; note: string},
  updatedByUserId: string,
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
    return;
  }

  await updateDoc(doc(getFirebaseDb(), TRANSACTIONS, transaction.id), {
    amount: nextAmount,
    note: updates.note,
    updatedAt: now,
    updatedByUserId,
  });

  if (Math.abs(balanceDelta) >= 0.005 && affectsUserStoredBalance(transaction.type, transaction.ledgerId)) {
    await updateUserBalance(transaction.userId, balanceDelta);
  }
}

export async function deleteTransaction(transaction: Transaction): Promise<void> {
  const balanceDelta = -transaction.amount;

  if (isMockMode) {
    useMockDb.getState().deleteTransaction(transaction.id, balanceDelta);
    return;
  }

  await deleteDoc(doc(getFirebaseDb(), TRANSACTIONS, transaction.id));

  if (Math.abs(balanceDelta) >= 0.005 && affectsUserStoredBalance(transaction.type, transaction.ledgerId)) {
    await updateUserBalance(transaction.userId, balanceDelta);
  }
}

export async function deleteCashScopeTransactionsForUser(
  userId: string,
  transactions: Transaction[],
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
    return toDelete.length;
  }

  await Promise.all(
    toDelete.map((transaction) => deleteDoc(doc(getFirebaseDb(), TRANSACTIONS, transaction.id))),
  );

  if (Math.abs(balanceDelta) >= 0.005) {
    await updateUserBalance(userId, balanceDelta);
  }

  return toDelete.length;
}

export async function deleteAdvanceScopeTransactionsForUser(
  userId: string,
  transactions: Transaction[],
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
    return toDelete.length;
  }

  await Promise.all(
    toDelete.map((transaction) => deleteDoc(doc(getFirebaseDb(), TRANSACTIONS, transaction.id))),
  );

  if (Math.abs(balanceDelta) >= 0.005) {
    await updateUserBalance(userId, balanceDelta);
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
    return toDelete.length;
  }

  await Promise.all(
    toDelete.map((transaction) => deleteDoc(doc(getFirebaseDb(), TRANSACTIONS, transaction.id))),
  );

  return toDelete.length;
}

export async function deleteAllTransactionsForUser(userId: string): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().deleteAllTransactionsForUser(userId);
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
  if (isMockMode) {
    const count = useMockDb.getState().transactions.length;
    useMockDb.setState({transactions: []});
    return count;
  }

  const snap = await getDocs(collection(getFirebaseDb(), TRANSACTIONS));
  if (snap.empty) {
    return 0;
  }

  await Promise.all(snap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  return snap.size;
}
