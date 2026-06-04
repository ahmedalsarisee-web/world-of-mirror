import {create} from 'zustand';
import dayjs from 'dayjs';
import {DEFAULT_ATTENDANCE_WORKPLACE} from '@app/constants/attendanceLocation';
import type {
  AppUser,
  AttendanceRecord,
  AttendanceWorkplace,
  Transaction,
  TransactionType,
  UserRole,
} from '@app/types/models';
import {createSeedUsers, MOCK_EMPLOYEE_IDS, MOCK_ADMIN_ID} from '@app/mock/mockUsers';
import {getDefaultEmployeePermissions} from '@app/utils/employeePermissions';
import {affectsUserStoredBalance, normalizeTransactionAmount} from '@app/utils/financeTotals';

function seedTransactions(): Transaction[] {
  const now = dayjs();
  return [
    {
      id: 'tx-1',
      userId: MOCK_EMPLOYEE_IDS.abdullah,
      type: 'received',
      amount: 200,
      note: 'Cash from shop sales',
      createdAt: now.subtract(1, 'day').toISOString(),
      isPinned: true,
      pinnedAt: now.subtract(1, 'day').toISOString(),
      createdByRole: 'employee',
    },
    {
      id: 'tx-2',
      userId: MOCK_EMPLOYEE_IDS.abdullah,
      type: 'order_collection',
      amount: 150,
      note: 'Customer payment collection',
      createdAt: now.subtract(2, 'hour').toISOString(),
      isPinned: true,
      pinnedAt: now.subtract(2, 'hour').toISOString(),
      createdByRole: 'employee',
    },
    {
      id: 'tx-3',
      userId: MOCK_EMPLOYEE_IDS.ahmed,
      type: 'paid',
      amount: -50,
      note: 'Delivery fuel',
      createdAt: now.subtract(3, 'day').toISOString(),
      isPinned: true,
      pinnedAt: now.subtract(3, 'day').toISOString(),
      createdByRole: 'employee',
    },
    {
      id: 'tx-4',
      userId: MOCK_ADMIN_ID,
      type: 'received',
      amount: 500,
      note: 'Office deposit',
      createdAt: now.subtract(4, 'day').toISOString(),
      createdByRole: 'admin',
    },
  ];
}

function seedAttendance(): AttendanceRecord[] {
  const now = dayjs();
  return [
    {
      id: 'att-1',
      userId: MOCK_EMPLOYEE_IDS.abdullah,
      type: 'check_in',
      createdAt: now.subtract(1, 'day').hour(9).minute(5).second(0).toISOString(),
    },
    {
      id: 'att-2',
      userId: MOCK_EMPLOYEE_IDS.abdullah,
      type: 'check_out',
      createdAt: now.subtract(1, 'day').hour(17).minute(15).second(0).toISOString(),
    },
    {
      id: 'att-3',
      userId: MOCK_EMPLOYEE_IDS.abdullah,
      type: 'check_in',
      createdAt: now.hour(8).minute(58).second(0).toISOString(),
    },
    {
      id: 'att-4',
      userId: MOCK_EMPLOYEE_IDS.owais,
      type: 'check_in',
      createdAt: now.subtract(2, 'day').hour(9).minute(20).second(0).toISOString(),
    },
    {
      id: 'att-5',
      userId: MOCK_EMPLOYEE_IDS.owais,
      type: 'check_out',
      createdAt: now.subtract(2, 'day').hour(16).minute(45).second(0).toISOString(),
    },
  ];
}

interface MockDbState {
  users: AppUser[];
  transactions: Transaction[];
  attendance: AttendanceRecord[];
  attendanceWorkplace: AttendanceWorkplace;
  setAttendanceWorkplace: (workplace: AttendanceWorkplace) => void;
  reset: () => void;
  setUser: (userId: string, patch: Partial<AppUser>) => void;
  addUser: (data: {
    name: string;
    role: AppUser['role'];
    permissions?: AppUser['permissions'];
    email?: string;
    isPrimaryAdmin?: boolean;
  }) => string;
  deleteUser: (userId: string) => void;
  addTransaction: (
    userId: string,
    type: TransactionType,
    amount: number,
    note: string,
    metadata?: {
      createdByUserId?: string;
      createdByRole?: UserRole;
      isPinned?: boolean;
      pinnedAt?: string;
      ledgerId?: string;
    },
  ) => void;
  updateTransaction: (
    transactionId: string,
    patch: Pick<Transaction, 'amount' | 'note' | 'updatedAt' | 'updatedByUserId'>,
    balanceDelta: number,
  ) => void;
  deleteTransaction: (transactionId: string, balanceDelta: number) => void;
  deleteTransactions: (transactionIds: string[], balanceDelta: number, userId: string) => void;
  deleteAllTransactionsForUser: (userId: string) => void;
  clearAllBusinessRecords: () => void;
  addAttendanceRecord: (
    userId: string,
    type: AttendanceRecord['type'],
    note?: string,
    options?: {createdAt?: string; resetTotalSeconds?: number},
  ) => void;
  updateAttendanceRecord: (
    recordId: string,
    updates: Partial<Pick<AttendanceRecord, 'type' | 'createdAt' | 'note' | 'resetTotalSeconds'>>,
  ) => void;
  deleteAttendanceRecord: (recordId: string) => void;
}

let idCounter = 100;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export const useMockDb = create<MockDbState>((set, get) => ({
  users: createSeedUsers(),
  transactions: seedTransactions(),
  attendance: seedAttendance(),
  attendanceWorkplace: DEFAULT_ATTENDANCE_WORKPLACE,

  setAttendanceWorkplace: (workplace) => set({attendanceWorkplace: workplace}),

  reset: () =>
    set({
      users: createSeedUsers(),
      transactions: seedTransactions(),
      attendance: seedAttendance(),
      attendanceWorkplace: DEFAULT_ATTENDANCE_WORKPLACE,
    }),

  setUser: (userId, patch) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? {...u, ...patch} : u)),
    })),

  addUser: (data) => {
    const id = nextId('user');
    const user: AppUser = {
      id,
      name: data.name,
      role: data.role,
      balance: 0,
      createdAt: new Date().toISOString(),
      ...(data.email ? {email: data.email} : {}),
      ...(data.isPrimaryAdmin ? {isPrimaryAdmin: true} : {}),
      permissions: data.role === 'employee' ? (data.permissions ?? getDefaultEmployeePermissions()) : undefined,
    };
    set((state) => ({users: [...state.users, user]}));
    return id;
  },

  deleteUser: (userId) =>
    set((state) => ({
      users: state.users.filter((u) => u.id !== userId),
      transactions: state.transactions.filter((tx) => tx.userId !== userId),
      attendance: state.attendance.filter((record) => record.userId !== userId),
    })),

  addTransaction: (userId, type, amount, note, metadata) => {
    const signedAmount = normalizeTransactionAmount(type, amount);
    const tx: Transaction = {
      id: nextId('tx'),
      userId,
      type,
      amount: signedAmount,
      note,
      createdAt: new Date().toISOString(),
      ...(metadata?.createdByUserId ? {createdByUserId: metadata.createdByUserId} : {}),
      ...(metadata?.createdByRole ? {createdByRole: metadata.createdByRole} : {}),
      ...(metadata?.isPinned ? {isPinned: true, pinnedAt: metadata.pinnedAt ?? new Date().toISOString()} : {}),
      ...(metadata?.ledgerId ? {ledgerId: metadata.ledgerId} : {}),
    };
    set((state) => ({
      transactions: [tx, ...state.transactions],
      users: state.users.map((u) =>
        u.id === userId && affectsUserStoredBalance(type, metadata?.ledgerId)
          ? {...u, balance: u.balance + signedAmount}
          : u,
      ),
    }));
  },

  updateTransaction: (transactionId, patch, balanceDelta) =>
    set((state) => {
      const targetTx = state.transactions.find((tx) => tx.id === transactionId);
      if (!targetTx) {
        return state;
      }

      return {
        transactions: state.transactions.map((tx) =>
          tx.id === transactionId ? {...tx, ...patch} : tx,
        ),
        users: state.users.map((u) =>
          u.id === targetTx.userId && affectsUserStoredBalance(targetTx.type, targetTx.ledgerId)
            ? {...u, balance: u.balance + balanceDelta}
            : u,
        ),
      };
    }),

  deleteTransaction: (transactionId, balanceDelta) =>
    set((state) => {
      const targetTx = state.transactions.find((tx) => tx.id === transactionId);
      if (!targetTx) {
        return state;
      }

      return {
        transactions: state.transactions.filter((tx) => tx.id !== transactionId),
        users: state.users.map((u) =>
          u.id === targetTx.userId && affectsUserStoredBalance(targetTx.type, targetTx.ledgerId)
            ? {...u, balance: u.balance + balanceDelta}
            : u,
        ),
      };
    }),

  deleteTransactions: (transactionIds, balanceDelta, userId) =>
    set((state) => {
      const ids = new Set(transactionIds);
      return {
        transactions: state.transactions.filter((tx) => !ids.has(tx.id)),
        users: state.users.map((u) =>
          u.id === userId ? {...u, balance: u.balance + balanceDelta} : u,
        ),
      };
    }),

  deleteAllTransactionsForUser: (userId) =>
    set((state) => ({
      transactions: state.transactions.filter((tx) => tx.userId !== userId),
    })),

  clearAllBusinessRecords: () =>
    set((state) => ({
      transactions: [],
      attendance: [],
      users: state.users.map((user) => ({
        ...user,
        balance: 0,
        financeLedgers: undefined,
        financeCardLabels: undefined,
        attendanceResetSchedule: undefined,
        attendanceResetScheduleUpdatedAt: undefined,
        attendanceLastResetBoundary: undefined,
        delegatedFinanceLedgerAccess: undefined,
      })),
    })),

  addAttendanceRecord: (userId, type, note = '', options) => {
    const state = get();
    const latestForUser = state.attendance
      .filter((record) => record.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    let createdAtMs = options?.createdAt ? dayjs(options.createdAt).valueOf() : Date.now();
    if (!options?.createdAt && latestForUser) {
      const latestMs = dayjs(latestForUser.createdAt).valueOf();
      if (createdAtMs <= latestMs) {
        createdAtMs = latestMs + 1000;
      }
    }

    const record: AttendanceRecord = {
      id: nextId('att'),
      userId,
      type,
      note: note || undefined,
      createdAt: new Date(createdAtMs).toISOString(),
      resetTotalSeconds: options?.resetTotalSeconds,
    };
    set((current) => ({
      attendance: [record, ...current.attendance],
    }));
  },

  updateAttendanceRecord: (recordId, updates) =>
    set((state) => ({
      attendance: state.attendance.map((record) =>
        record.id === recordId
          ? {
              ...record,
              ...updates,
              note: updates.note !== undefined ? updates.note || undefined : record.note,
            }
          : record,
      ),
    })),

  deleteAttendanceRecord: (recordId) =>
    set((state) => ({
      attendance: state.attendance.filter((record) => record.id !== recordId),
    })),
}));

export function subscribeMockDb(listener: () => void): () => void {
  return useMockDb.subscribe(listener);
}
