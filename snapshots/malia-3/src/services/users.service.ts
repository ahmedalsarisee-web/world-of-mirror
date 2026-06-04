import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  increment,
  type Unsubscribe,
} from 'firebase/firestore';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb} from '@app/config/firebase';
import {registerAuthUser} from '@app/services/auth.service';
import {deleteAllTransactionsForUser} from '@app/services/transactions.service';
import {subscribeMockDb, useMockDb} from '@app/mock/mockDb';
import type {AppUser, EmployeeFinanceLedger, EmployeeFinanceCardLabels, EmployeePermissions, UserRole, AttendanceHoursResetSchedule} from '@app/types/models';
import {isPrimaryAdminEmail, normalizeAdminEmail} from '@app/config/adminAccess';
import {getDefaultEmployeePermissions} from '@app/utils/employeePermissions';
import {createFinanceLedgerId} from '@app/utils/financeLedgers';

const USERS = 'users';

function parsePermissions(value: unknown): EmployeePermissions | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  return {
    finance: Boolean(data.finance ?? true),
  };
}

function parseAttendanceResetSchedule(value: unknown): AttendanceHoursResetSchedule | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  const type = data.type;
  if (type !== 'none' && type !== 'weekly' && type !== 'monthly') {
    return undefined;
  }
  return {
    type,
    weeklyDay: data.weeklyDay === undefined ? undefined : Number(data.weeklyDay),
    monthlyDay: data.monthlyDay === undefined ? undefined : Number(data.monthlyDay),
  };
}

function parseFinanceLedgers(value: unknown): EmployeeFinanceLedger[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const ledgers: EmployeeFinanceLedger[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const data = item as Record<string, unknown>;
    const id = String(data.id ?? '').trim();
    const name = String(data.name ?? '').trim();
    if (!id || !name) {
      continue;
    }
    ledgers.push({
      id,
      name,
      createdAt: String(data.createdAt ?? ''),
      ...(data.createdByUserId ? {createdByUserId: String(data.createdByUserId)} : {}),
    });
  }

  return ledgers.length > 0 ? ledgers : undefined;
}

function parseFinanceCardLabels(value: unknown): EmployeeFinanceCardLabels | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  const cash = data.cash === undefined ? undefined : String(data.cash).trim();
  const salaryAdvance =
    data.salaryAdvance === undefined ? undefined : String(data.salaryAdvance).trim();
  if (!cash && !salaryAdvance) {
    return undefined;
  }
  return {
    ...(cash ? {cash} : {}),
    ...(salaryAdvance ? {salaryAdvance} : {}),
  };
}

function mapUser(id: string, data: Record<string, unknown>): AppUser {
  const role = (data.role as AppUser['role']) ?? 'employee';
  const email = data.email ? normalizeAdminEmail(String(data.email)) : undefined;
  return {
    id,
    name: String(data.name ?? ''),
    role,
    balance: Number(data.balance ?? 0),
    createdAt: String(data.createdAt ?? ''),
    ...(email ? {email} : {}),
    isPrimaryAdmin: Boolean(data.isPrimaryAdmin) || isPrimaryAdminEmail(email),
    permissions: role === 'employee' ? parsePermissions(data.permissions) ?? getDefaultEmployeePermissions() : undefined,
    financeLedgers: parseFinanceLedgers(data.financeLedgers),
    financeCardLabels: parseFinanceCardLabels(data.financeCardLabels),
    attendanceResetSchedule: parseAttendanceResetSchedule(data.attendanceResetSchedule),
    attendanceResetScheduleUpdatedAt: data.attendanceResetScheduleUpdatedAt
      ? String(data.attendanceResetScheduleUpdatedAt)
      : undefined,
    attendanceLastResetBoundary: data.attendanceLastResetBoundary
      ? String(data.attendanceLastResetBoundary)
      : undefined,
  };
}

export async function getUserById(userId: string): Promise<AppUser | null> {
  if (isMockMode) {
    return useMockDb.getState().users.find((u) => u.id === userId) ?? null;
  }
  const snap = await getDoc(doc(getFirebaseDb(), USERS, userId));
  if (!snap.exists()) return null;
  return mapUser(snap.id, snap.data());
}

export async function getAllUsers(): Promise<AppUser[]> {
  if (isMockMode) {
    return useMockDb.getState().users;
  }
  const snap = await getDocs(collection(getFirebaseDb(), USERS));
  return snap.docs.map((d) => mapUser(d.id, d.data()));
}

export function subscribeToUsers(callback: (users: AppUser[]) => void): Unsubscribe {
  if (isMockMode) {
    callback(useMockDb.getState().users);
    return subscribeMockDb(() => callback(useMockDb.getState().users));
  }
  return onSnapshot(
    collection(getFirebaseDb(), USERS),
    (snap) => {
      callback(snap.docs.map((d) => mapUser(d.id, d.data())));
    },
    (error) => {
      console.error('[subscribeToUsers]', error);
      callback([]);
    },
  );
}

export function subscribeToUser(userId: string, callback: (user: AppUser | null) => void): Unsubscribe {
  if (isMockMode) {
    const emit = () => {
      callback(useMockDb.getState().users.find((u) => u.id === userId) ?? null);
    };
    emit();
    return subscribeMockDb(emit);
  }
  return onSnapshot(
    doc(getFirebaseDb(), USERS, userId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(mapUser(snap.id, snap.data()));
    },
    (error) => {
      console.error('[subscribeToUser]', error);
      callback(null);
    },
  );
}

export async function updateUserBalance(userId: string, delta: number): Promise<void> {
  if (isMockMode) {
    const user = useMockDb.getState().users.find((u) => u.id === userId);
    if (user) {
      useMockDb.getState().setUser(userId, {balance: user.balance + delta});
    }
    return;
  }
  await updateDoc(doc(getFirebaseDb(), USERS, userId), {balance: increment(delta)});
}

export async function setUserBalance(userId: string, balance: number): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().setUser(userId, {balance});
    return;
  }
  await updateDoc(doc(getFirebaseDb(), USERS, userId), {balance});
}

export function getEmployees(users: AppUser[]): AppUser[] {
  return users.filter((u) => u.role === 'employee');
}

export function getAdmins(users: AppUser[]): AppUser[] {
  return users
    .filter((user) => user.role === 'admin')
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function syncPrimaryAdminProfile(
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  if (!email || !isPrimaryAdminEmail(email)) {
    return;
  }

  const normalizedEmail = normalizeAdminEmail(email);
  if (isMockMode) {
    useMockDb.getState().setUser(userId, {email: normalizedEmail, isPrimaryAdmin: true});
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {
    email: normalizedEmail,
    isPrimaryAdmin: true,
  });
}

export function getFinanceAccounts(users: AppUser[]): AppUser[] {
  return users
    .filter(
      (user) =>
        (user.role === 'admin' || user.role === 'employee') &&
        user.id.trim().length > 0 &&
        user.name.trim().length > 0,
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<string> {
  if (isMockMode) {
    return useMockDb.getState().addUser({
      name: data.name,
      role: data.role,
      email: normalizeAdminEmail(data.email),
      isPrimaryAdmin: isPrimaryAdminEmail(data.email),
      permissions: data.role === 'employee' ? getDefaultEmployeePermissions() : undefined,
    });
  }

  const uid = await registerAuthUser(data.email, data.password);
  const normalizedEmail = normalizeAdminEmail(data.email);
  const isPrimaryAdmin = isPrimaryAdminEmail(normalizedEmail);
  await setDoc(doc(getFirebaseDb(), USERS, uid), {
    name: data.name,
    role: data.role,
    balance: 0,
    createdAt: new Date().toISOString(),
    email: normalizedEmail,
    ...(isPrimaryAdmin ? {isPrimaryAdmin: true} : {}),
    ...(data.role === 'employee' ? {permissions: getDefaultEmployeePermissions()} : {}),
  });
  return uid;
}

export async function updateEmployeePermissions(
  userId: string,
  permissions: EmployeePermissions,
): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().setUser(userId, {permissions});
    return;
  }
  await updateDoc(doc(getFirebaseDb(), USERS, userId), {permissions});
}

export async function updateEmployeeAttendanceResetSchedule(
  userId: string,
  schedule: AttendanceHoursResetSchedule,
): Promise<void> {
  const payload =
    schedule.type === 'none'
      ? {
          attendanceResetSchedule: schedule,
          attendanceResetScheduleUpdatedAt: new Date().toISOString(),
          attendanceLastResetBoundary: deleteField(),
        }
      : {
          attendanceResetSchedule: schedule,
          attendanceResetScheduleUpdatedAt: new Date().toISOString(),
          attendanceLastResetBoundary: deleteField(),
        };

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {
      attendanceResetSchedule: schedule,
      attendanceResetScheduleUpdatedAt: payload.attendanceResetScheduleUpdatedAt,
      attendanceLastResetBoundary: undefined,
    });
    return;
  }
  await updateDoc(doc(getFirebaseDb(), USERS, userId), payload);
}

export async function setEmployeeAttendanceLastResetBoundary(
  userId: string,
  boundaryIso: string,
): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().setUser(userId, {attendanceLastResetBoundary: boundaryIso});
    return;
  }
  await updateDoc(doc(getFirebaseDb(), USERS, userId), {attendanceLastResetBoundary: boundaryIso});
}

export async function deleteUser(userId: string): Promise<void> {
  await deleteAllTransactionsForUser(userId);

  if (isMockMode) {
    useMockDb.getState().deleteUser(userId);
    return;
  }
  await deleteDoc(doc(getFirebaseDb(), USERS, userId));
}

export async function addFinanceLedger(
  userId: string,
  name: string,
  createdByUserId: string,
): Promise<EmployeeFinanceLedger> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Finance ledger name is required');
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const ledger: EmployeeFinanceLedger = {
    id: createFinanceLedgerId(),
    name: trimmedName,
    createdAt: new Date().toISOString(),
    createdByUserId,
  };
  const nextLedgers = [...(user.financeLedgers ?? []), ledger];

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {financeLedgers: nextLedgers});
    return ledger;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {financeLedgers: nextLedgers});
  return ledger;
}

export async function renameFinanceLedger(
  userId: string,
  ledgerId: string,
  name: string,
): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Finance ledger name is required');
  }

  const user = await getUserById(userId);
  if (!user?.financeLedgers?.some((ledger) => ledger.id === ledgerId)) {
    throw new Error('Finance ledger not found');
  }

  const nextLedgers = user.financeLedgers.map((ledger) =>
    ledger.id === ledgerId ? {...ledger, name: trimmedName} : ledger,
  );

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {financeLedgers: nextLedgers});
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {financeLedgers: nextLedgers});
}

export async function updateFinanceCardLabel(
  userId: string,
  key: keyof EmployeeFinanceCardLabels,
  name: string,
): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Finance card label is required');
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const nextLabels: EmployeeFinanceCardLabels = {
    ...(user.financeCardLabels ?? {}),
    [key]: trimmedName,
  };

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {financeCardLabels: nextLabels});
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {financeCardLabels: nextLabels});
}

export async function clearFinanceCardLabel(
  userId: string,
  key: keyof EmployeeFinanceCardLabels,
): Promise<void> {
  const user = await getUserById(userId);
  if (!user?.financeCardLabels?.[key]) {
    return;
  }

  const nextLabels = {...user.financeCardLabels};
  delete nextLabels[key];

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {
      financeCardLabels: Object.keys(nextLabels).length > 0 ? nextLabels : undefined,
    });
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {
    financeCardLabels: Object.keys(nextLabels).length > 0 ? nextLabels : deleteField(),
  });
}

export async function deleteFinanceLedger(userId: string, ledgerId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user?.financeLedgers?.some((ledger) => ledger.id === ledgerId)) {
    throw new Error('Finance ledger not found');
  }

  const nextLedgers = user.financeLedgers.filter((ledger) => ledger.id !== ledgerId);

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {
      financeLedgers: nextLedgers.length > 0 ? nextLedgers : undefined,
    });
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {
    financeLedgers: nextLedgers.length > 0 ? nextLedgers : deleteField(),
  });
}
