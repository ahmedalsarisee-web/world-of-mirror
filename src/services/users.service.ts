import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb, isFirebaseConfigured} from '@app/config/firebase';
import {canPersistStoredBalance} from '@app/utils/financePermissions';
import {registerAuthUser, tryDeleteAuthAccount} from '@app/services/authRegistration.service';
import {applyUserBalanceDelta, persistUserBalance} from '@app/services/userBalance.service';
import {deleteAllAttendanceRecordsForUser} from '@app/services/attendance.service';
import {removeDeletedUserFromOrdersHomeCards} from '@app/services/ordersHomeCards.service';
import {subscribeMockDb, useMockDb} from '@app/mock/mockDb';
import type {AppUser, AdminPermissions, EmployeeFinanceLedger, EmployeeFinanceCardLabels, EmployeePermissions, UserRole, AttendanceHoursResetSchedule, EmployeeLastLocation} from '@app/types/models';
import {isPrimaryAdminEmail, normalizeAdminEmail} from '@app/config/adminAccess';
import {getDefaultAdminPermissions} from '@app/utils/adminPermissions';
import {getDefaultEmployeePermissions} from '@app/utils/employeePermissions';
import {normalizeAttendanceShiftHours} from '@app/utils/attendanceShiftHours';
import {createFinanceLedgerId, buildDelegatedFinanceLedgerAccessKey} from '@app/utils/financeLedgers';

const USERS = 'users';

function parseAdminPermissions(value: unknown): AdminPermissions | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  return {
    showMirrorCartCostPrice: Boolean(data.showMirrorCartCostPrice),
    showEmployeeManagement: Boolean(data.showEmployeeManagement),
    showAllFinanceCards: Boolean(data.showAllFinanceCards),
  };
}

function parsePermissions(value: unknown): EmployeePermissions | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const data = value as Record<string, unknown>;
  return {
    finance: Boolean(data.finance ?? true),
    employeeFinance: Boolean(data.employeeFinance ?? false),
    employeeAttendance: Boolean(data.employeeAttendance ?? false),
    attendanceLocationRequired: Boolean(data.attendanceLocationRequired ?? true),
    attendanceGpsLinked: Boolean(data.attendanceGpsLinked ?? false),
    moveOrders: Boolean(data.moveOrders ?? false),
    deleteOrders: Boolean(data.deleteOrders ?? false),
    orderCardNotes: Boolean(data.orderCardNotes ?? false),
    editFinanceTransactions: Boolean(data.editFinanceTransactions ?? false),
    showNotificationsIcon: Boolean(data.showNotificationsIcon ?? false),
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
      ...(Array.isArray(data.visibleToUserIds)
        ? {
            visibleToUserIds: data.visibleToUserIds
              .map((entry) => String(entry).trim())
              .filter(Boolean),
          }
        : {}),
      ...(data.memoOnly === true ? {memoOnly: true} : {}),
    });
  }

  return ledgers.length > 0 ? ledgers : undefined;
}

function parseDelegatedFinanceLedgerAccess(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const keys = value.map((entry) => String(entry).trim()).filter(Boolean);
  return keys.length > 0 ? keys : undefined;
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

function parseLastLocation(value: unknown): EmployeeLastLocation | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const data = value as Record<string, unknown>;
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  const updatedAt = String(data.updatedAt ?? '').trim();

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !updatedAt) {
    return undefined;
  }

  const accuracy = data.accuracy === undefined ? undefined : Number(data.accuracy);

  return {
    latitude,
    longitude,
    updatedAt,
    ...(accuracy != null && Number.isFinite(accuracy) ? {accuracy} : {}),
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
    adminPermissions:
      role === 'admin'
        ? parseAdminPermissions(data.adminPermissions) ?? getDefaultAdminPermissions()
        : undefined,
    financeLedgers: parseFinanceLedgers(data.financeLedgers),
    financeCardLabels: parseFinanceCardLabels(data.financeCardLabels),
    delegatedFinanceLedgerAccess: parseDelegatedFinanceLedgerAccess(data.delegatedFinanceLedgerAccess),
    attendanceResetSchedule: parseAttendanceResetSchedule(data.attendanceResetSchedule),
    attendanceResetScheduleUpdatedAt: data.attendanceResetScheduleUpdatedAt
      ? String(data.attendanceResetScheduleUpdatedAt)
      : undefined,
    attendanceLastResetBoundary: data.attendanceLastResetBoundary
      ? String(data.attendanceLastResetBoundary)
      : undefined,
    attendanceShiftHours: normalizeAttendanceShiftHours(data.attendanceShiftHours),
    attendanceShiftHoursUpdatedAt: data.attendanceShiftHoursUpdatedAt
      ? String(data.attendanceShiftHoursUpdatedAt)
      : undefined,
    lastLocation: parseLastLocation(data.lastLocation),
    expoPushTokens: parseExpoPushTokens(data.expoPushTokens),
    attendanceGpsHeartbeatAt: data.attendanceGpsHeartbeatAt
      ? String(data.attendanceGpsHeartbeatAt)
      : undefined,
    archivedAt: data.archivedAt ? String(data.archivedAt) : undefined,
  };
}

function parseExpoPushTokens(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tokens = value.filter((token): token is string => typeof token === 'string' && token.trim().length > 0);
  return tokens.length ? tokens : undefined;
}

export async function getUserById(userId: string): Promise<AppUser | null> {
  if (isMockMode) {
    return useMockDb.getState().users.find((u) => u.id === userId) ?? null;
  }
  const snap = await getDoc(doc(getFirebaseDb(), USERS, userId));
  if (!snap.exists()) return null;
  return mapUser(snap.id, snap.data());
}

async function setDelegatedFinanceLedgerAccess(
  userId: string,
  accessKeys: string[],
): Promise<void> {
  const uniqueKeys = [...new Set(accessKeys.filter(Boolean))];

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {
      delegatedFinanceLedgerAccess: uniqueKeys.length > 0 ? uniqueKeys : undefined,
    });
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {
    delegatedFinanceLedgerAccess: uniqueKeys.length > 0 ? uniqueKeys : deleteField(),
  });
}

async function grantDelegatedFinanceLedgerAccess(
  ownerUserId: string,
  ledgerId: string,
  viewerUserIds: string[],
): Promise<void> {
  const accessKey = buildDelegatedFinanceLedgerAccessKey(ownerUserId, ledgerId);

  await Promise.all(
    viewerUserIds.map(async (viewerUserId) => {
      const viewer = await getUserById(viewerUserId);
      if (!viewer) {
        return;
      }

      const nextKeys = new Set(viewer.delegatedFinanceLedgerAccess ?? []);
      nextKeys.add(accessKey);
      await setDelegatedFinanceLedgerAccess(viewerUserId, [...nextKeys]);
    }),
  );
}

async function revokeDelegatedFinanceLedgerAccess(
  ownerUserId: string,
  ledgerId: string,
  viewerUserIds: string[],
): Promise<void> {
  const accessKey = buildDelegatedFinanceLedgerAccessKey(ownerUserId, ledgerId);

  await Promise.all(
    viewerUserIds.map(async (viewerUserId) => {
      const viewer = await getUserById(viewerUserId);
      if (!viewer) {
        return;
      }

      const nextKeys = (viewer.delegatedFinanceLedgerAccess ?? []).filter((key) => key !== accessKey);
      await setDelegatedFinanceLedgerAccess(viewerUserId, nextKeys);
    }),
  );
}

export async function rebuildAllDelegatedFinanceLedgerAccess(): Promise<void> {
  const users = await getAllUsers();
  const accessByViewer = new Map<string, Set<string>>();

  for (const owner of users) {
    for (const ledger of owner.financeLedgers ?? []) {
      const accessKey = buildDelegatedFinanceLedgerAccessKey(owner.id, ledger.id);
      for (const viewerId of ledger.visibleToUserIds ?? []) {
        const nextKeys = accessByViewer.get(viewerId) ?? new Set<string>();
        nextKeys.add(accessKey);
        accessByViewer.set(viewerId, nextKeys);
      }
    }
  }

  await Promise.all(
    users
      .filter((user) => user.role === 'employee')
      .map(async (employee) => {
        const keys = [...(accessByViewer.get(employee.id) ?? [])];
        await setDelegatedFinanceLedgerAccess(employee.id, keys);
      }),
  );
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

export function subscribeToEmployeeUsers(callback: (users: AppUser[]) => void): Unsubscribe {
  if (isMockMode) {
    const emit = () => {
      callback(useMockDb.getState().users.filter((user) => user.role === 'employee'));
    };
    emit();
    return subscribeMockDb(emit);
  }

  const employeeQuery = query(collection(getFirebaseDb(), USERS), where('role', '==', 'employee'));
  return onSnapshot(
    employeeQuery,
    (snap) => {
      callback(snap.docs.map((d) => mapUser(d.id, d.data())));
    },
    (error) => {
      console.error('[subscribeToEmployeeUsers]', error);
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
    },
  );
}

export async function updateUserBalance(
  userId: string,
  delta: number,
  viewer: AppUser | null,
  targetRole: UserRole = 'employee',
): Promise<void> {
  if (!canPersistStoredBalance(viewer, {id: userId, role: targetRole})) {
    return;
  }

  try {
    await applyUserBalanceDelta(userId, delta);
  } catch (error) {
    console.warn('[updateUserBalance] failed', {userId, delta, error});
  }
}

export async function setUserBalance(
  userId: string,
  balance: number,
  viewer: AppUser | null,
  targetRole: UserRole = 'employee',
): Promise<void> {
  if (!canPersistStoredBalance(viewer, {id: userId, role: targetRole})) {
    return;
  }

  try {
    await persistUserBalance(userId, balance);
  } catch (error) {
    console.warn('[setUserBalance] failed', {userId, balance, error});
  }
}

export async function resetAllUsersBusinessData(): Promise<void> {
  if (isMockMode) {
    useMockDb.setState((state) => ({
      users: state.users.map((user) => ({
        ...user,
        balance: 0,
        financeLedgers: undefined,
        financeCardLabels: undefined,
        attendanceResetSchedule: undefined,
        attendanceResetScheduleUpdatedAt: undefined,
        attendanceLastResetBoundary: undefined,
        delegatedFinanceLedgerAccess: undefined,
        lastLocation: undefined,
        expoPushTokens: undefined,
        attendanceGpsHeartbeatAt: undefined,
      })),
    }));
    if (!isFirebaseConfigured) {
      return;
    }
  }

  if (!isFirebaseConfigured) {
    return;
  }

  const users = await getAllUsers();
  await Promise.all(
    users.map((user) =>
      updateDoc(doc(getFirebaseDb(), USERS, user.id), {
        balance: 0,
        financeLedgers: deleteField(),
        financeCardLabels: deleteField(),
        attendanceResetSchedule: deleteField(),
        attendanceResetScheduleUpdatedAt: deleteField(),
        attendanceLastResetBoundary: deleteField(),
        delegatedFinanceLedgerAccess: deleteField(),
        lastLocation: deleteField(),
        expoPushTokens: deleteField(),
        attendanceGpsHeartbeatAt: deleteField(),
      }),
    ),
  );
}

export function isArchivedEmployee(user: Pick<AppUser, 'role' | 'archivedAt'>): boolean {
  return user.role === 'employee' && Boolean(user.archivedAt);
}

export function getEmployees(users: AppUser[]): AppUser[] {
  return users.filter((u) => u.role === 'employee' && !u.archivedAt);
}

export function getAdmins(users: AppUser[]): AppUser[] {
  return users
    .filter((user) => user.role === 'admin')
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function syncUserProfileEmail(
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  const normalizedEmail = email?.trim() ? normalizeAdminEmail(email.trim()) : undefined;
  if (!normalizedEmail) {
    return;
  }

  if (isMockMode) {
    const user = useMockDb.getState().users.find((entry) => entry.id === userId);
    if (!user) {
      return;
    }

    const patch: Partial<AppUser> = {};
    if (!user.email?.trim()) {
      patch.email = normalizedEmail;
    }
    if (isPrimaryAdminEmail(normalizedEmail)) {
      patch.email = normalizedEmail;
      patch.isPrimaryAdmin = true;
    }
    if (Object.keys(patch).length > 0) {
      useMockDb.getState().setUser(userId, patch);
    }
    return;
  }

  try {
    const existing = await getUserById(userId);
    if (!existing) {
      return;
    }

    const updates: Record<string, unknown> = {};
    if (!existing.email?.trim()) {
      updates.email = normalizedEmail;
    }
    if (isPrimaryAdminEmail(normalizedEmail)) {
      updates.email = normalizedEmail;
      updates.isPrimaryAdmin = true;
    }
    if (Object.keys(updates).length === 0) {
      return;
    }

    await updateDoc(doc(getFirebaseDb(), USERS, userId), updates);
  } catch (error) {
    console.warn('[syncUserProfileEmail] skipped', error);
  }
}

export async function syncPrimaryAdminProfile(
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  await syncUserProfileEmail(userId, email);
}

export async function backfillMissingProfileEmails(): Promise<number> {
  if (isMockMode || !isFirebaseConfigured) {
    return 0;
  }

  try {
    const {httpsCallable} = await import('firebase/functions');
    const {getFirebaseFunctions} = await import('@app/config/firebase');
    const backfill = httpsCallable<Record<string, never>, {updated: number}>(
      getFirebaseFunctions(),
      'backfillMissingProfileEmails',
    );
    const result = await backfill({});
    return result.data.updated ?? 0;
  } catch (error) {
    const code = (error as {code?: string})?.code;
    if (code === 'functions/not-found' || code === 'functions/unavailable') {
      return 0;
    }
    throw error;
  }
}

export function getFinanceAccounts(users: AppUser[]): AppUser[] {
  return users
    .filter(
      (user) =>
        (user.role === 'admin' || user.role === 'employee') &&
        !isArchivedEmployee(user) &&
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
      adminPermissions: data.role === 'admin' ? getDefaultAdminPermissions() : undefined,
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
    ...(data.role === 'admin' ? {adminPermissions: getDefaultAdminPermissions()} : {}),
  });
  return uid;
}

export async function updateUserName(userId: string, name: string): Promise<AppUser> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Name is required');
  }

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {name: trimmedName});
    const updated = useMockDb.getState().users.find((entry) => entry.id === userId);
    if (!updated) {
      throw new Error('User not found');
    }
    return updated;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {name: trimmedName});
  const updated = await getUserById(userId);
  if (!updated) {
    throw new Error('User not found');
  }
  return updated;
}

export async function updateEmployeePermissions(
  userId: string,
  permissions: EmployeePermissions,
): Promise<void> {
  const merged = {
    ...getDefaultEmployeePermissions(),
    ...permissions,
    finance: Boolean(permissions.finance),
    employeeFinance: Boolean(permissions.employeeFinance),
    employeeAttendance: Boolean(permissions.employeeAttendance),
    attendanceLocationRequired: Boolean(permissions.attendanceLocationRequired),
    attendanceGpsLinked: Boolean(permissions.attendanceGpsLinked),
    moveOrders: Boolean(permissions.moveOrders),
    deleteOrders: Boolean(permissions.deleteOrders),
    orderCardNotes: Boolean(permissions.orderCardNotes),
    editFinanceTransactions: Boolean(permissions.editFinanceTransactions),
    showNotificationsIcon: Boolean(permissions.showNotificationsIcon),
  };
  if (isMockMode) {
    useMockDb.getState().setUser(userId, {permissions: merged});
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {permissions: merged});
}

export async function updateAdminPermissions(
  userId: string,
  adminPermissions: AdminPermissions,
): Promise<void> {
  const merged = {
    ...getDefaultAdminPermissions(),
    ...adminPermissions,
    showMirrorCartCostPrice: Boolean(adminPermissions.showMirrorCartCostPrice),
    showEmployeeManagement: Boolean(adminPermissions.showEmployeeManagement),
    showAllFinanceCards: Boolean(adminPermissions.showAllFinanceCards),
  };
  if (isMockMode) {
    useMockDb.getState().setUser(userId, {adminPermissions: merged});
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {adminPermissions: merged});
}

export async function registerExpoPushToken(userId: string, token: string): Promise<void> {
  if (isMockMode) {
    return;
  }

  const trimmed = token.trim();
  if (!trimmed) {
    return;
  }

  try {
    await updateDoc(doc(getFirebaseDb(), USERS, userId), {
      expoPushTokens: arrayUnion(trimmed),
    });
  } catch {
    // Ignore permission errors during auth teardown.
  }
}

export async function unregisterExpoPushToken(userId: string, token: string): Promise<void> {
  if (isMockMode) {
    return;
  }

  const trimmed = token.trim();
  if (!trimmed) {
    return;
  }

  try {
    await updateDoc(doc(getFirebaseDb(), USERS, userId), {
      expoPushTokens: arrayRemove(trimmed),
    });
  } catch {
    // Ignore permission errors during logout teardown.
  }
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

export async function updateEmployeeAttendanceShiftHours(
  userId: string,
  hours: number | null,
): Promise<void> {
  const normalized = hours === null ? undefined : normalizeAttendanceShiftHours(hours);
  const updatedAt = new Date().toISOString();

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {
      attendanceShiftHours: normalized,
      attendanceShiftHoursUpdatedAt: normalized ? updatedAt : undefined,
    });
    return;
  }

  if (normalized === undefined) {
    await updateDoc(doc(getFirebaseDb(), USERS, userId), {
      attendanceShiftHours: deleteField(),
      attendanceShiftHoursUpdatedAt: deleteField(),
    });
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {
    attendanceShiftHours: normalized,
    attendanceShiftHoursUpdatedAt: updatedAt,
  });
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

async function removeDeletedUserFromFinanceLedgers(deletedUserId: string): Promise<void> {
  const users = await getAllUsers();
  const updates: Promise<void>[] = [];

  for (const user of users) {
    if (user.id === deletedUserId) {
      continue;
    }

    const ledgers = user.financeLedgers;
    if (!ledgers?.some((ledger) => ledger.visibleToUserIds?.includes(deletedUserId))) {
      continue;
    }

    const nextLedgers = ledgers.map((ledger) => ({
      ...ledger,
      visibleToUserIds: (ledger.visibleToUserIds ?? []).filter((id) => id !== deletedUserId),
    }));

    if (isMockMode) {
      useMockDb.getState().setUser(user.id, {financeLedgers: nextLedgers});
      continue;
    }

    updates.push(updateDoc(doc(getFirebaseDb(), USERS, user.id), {financeLedgers: nextLedgers}));
  }

  if (!isMockMode) {
    await Promise.all(updates);
  }
}

async function archiveEmployeeUser(userId: string): Promise<void> {
  await deleteAllAttendanceRecordsForUser(userId);
  await removeDeletedUserFromFinanceLedgers(userId);
  await removeDeletedUserFromOrdersHomeCards(userId);

  if (isMockMode) {
    useMockDb.getState().archiveEmployeeUser(userId);
    await rebuildAllDelegatedFinanceLedgerAccess();
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {
    archivedAt: new Date().toISOString(),
    email: deleteField(),
    permissions: deleteField(),
    financeLedgers: deleteField(),
    financeCardLabels: deleteField(),
    delegatedFinanceLedgerAccess: deleteField(),
    lastLocation: deleteField(),
    expoPushTokens: deleteField(),
    attendanceResetSchedule: deleteField(),
    attendanceResetScheduleUpdatedAt: deleteField(),
    attendanceLastResetBoundary: deleteField(),
    attendanceGpsHeartbeatAt: deleteField(),
  });
  await rebuildAllDelegatedFinanceLedgerAccess();

  // Best-effort: employee is already blocked by archivedAt if Auth delete fails.
  await tryDeleteAuthAccount(userId);
}

export async function deleteUser(userId: string): Promise<void> {
  const target = await getUserById(userId);
  if (target?.role === 'employee' && !target.archivedAt) {
    await archiveEmployeeUser(userId);
    return;
  }

  const {deleteAllTransactionsForUser} = await import('@app/services/transactions.service');
  await deleteAllTransactionsForUser(userId);
  await deleteAllAttendanceRecordsForUser(userId);
  await removeDeletedUserFromFinanceLedgers(userId);
  await removeDeletedUserFromOrdersHomeCards(userId);

  if (isMockMode) {
    useMockDb.getState().deleteUser(userId);
    await rebuildAllDelegatedFinanceLedgerAccess();
    return;
  }

  const {deleteAuthAccount} = await import('@app/services/authRegistration.service');
  await deleteAuthAccount(userId);
  await deleteDoc(doc(getFirebaseDb(), USERS, userId));
  await rebuildAllDelegatedFinanceLedgerAccess();
}

export async function addFinanceLedger(
  userId: string,
  name: string,
  createdByUserId: string,
  visibleToUserIds: string[] = [],
  options?: {memoOnly?: boolean},
): Promise<EmployeeFinanceLedger> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Finance ledger name is required');
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const memoOnly = options?.memoOnly === true;
  const uniqueVisibleTo = [...new Set(visibleToUserIds.filter((id) => id && id !== userId))];

  const ledger: EmployeeFinanceLedger = {
    id: createFinanceLedgerId(),
    name: trimmedName,
    createdAt: new Date().toISOString(),
    createdByUserId,
    ...(memoOnly ? {memoOnly: true} : {}),
    ...(uniqueVisibleTo.length > 0 ? {visibleToUserIds: uniqueVisibleTo} : {}),
  };
  const nextLedgers = [...(user.financeLedgers ?? []), ledger];

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {financeLedgers: nextLedgers});
    if (uniqueVisibleTo.length > 0) {
      await grantDelegatedFinanceLedgerAccess(userId, ledger.id, uniqueVisibleTo);
    }
    return ledger;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {financeLedgers: nextLedgers});
  if (uniqueVisibleTo.length > 0) {
    await grantDelegatedFinanceLedgerAccess(userId, ledger.id, uniqueVisibleTo);
  }
  return ledger;
}

export async function updateFinanceLedgerMemoOnly(
  userId: string,
  ledgerId: string,
  memoOnly: boolean,
): Promise<void> {
  const user = await getUserById(userId);
  const ledger = user?.financeLedgers?.find((entry) => entry.id === ledgerId);
  if (!ledger) {
    throw new Error('Finance ledger not found');
  }

  const nextLedgers = user.financeLedgers!.map((entry) => {
    if (entry.id !== ledgerId) {
      return entry;
    }

    if (memoOnly) {
      const {memoOnly: _memoOnly, ...rest} = entry;
      return {...rest, memoOnly: true};
    }

    const {memoOnly: _memoOnly, ...rest} = entry;
    return rest;
  });

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {
      financeLedgers: nextLedgers.length > 0 ? nextLedgers : undefined,
    });
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {financeLedgers: nextLedgers});
}

export async function updateFinanceLedgerVisibility(
  userId: string,
  ledgerId: string,
  visibleToUserIds: string[],
): Promise<void> {
  const user = await getUserById(userId);
  const ledger = user?.financeLedgers?.find((entry) => entry.id === ledgerId);
  if (!ledger) {
    throw new Error('Finance ledger not found');
  }

  const previousVisibleTo = ledger.visibleToUserIds ?? [];
  const uniqueVisibleTo = [...new Set(visibleToUserIds.filter((id) => id && id !== userId))];

  const nextLedgers = user.financeLedgers!.map((entry) => {
    if (entry.id !== ledgerId) {
      return entry;
    }

    if (uniqueVisibleTo.length === 0) {
      const {visibleToUserIds: _visibleToUserIds, ...rest} = entry;
      return rest;
    }

    return {...entry, visibleToUserIds: uniqueVisibleTo};
  });

  const added = uniqueVisibleTo.filter((id) => !previousVisibleTo.includes(id));
  const removed = previousVisibleTo.filter((id) => !uniqueVisibleTo.includes(id));

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {
      financeLedgers: nextLedgers.length > 0 ? nextLedgers : undefined,
    });
    if (added.length > 0) {
      await grantDelegatedFinanceLedgerAccess(userId, ledgerId, added);
    }
    if (removed.length > 0) {
      await revokeDelegatedFinanceLedgerAccess(userId, ledgerId, removed);
    }
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {financeLedgers: nextLedgers});
  if (added.length > 0) {
    await grantDelegatedFinanceLedgerAccess(userId, ledgerId, added);
  }
  if (removed.length > 0) {
    await revokeDelegatedFinanceLedgerAccess(userId, ledgerId, removed);
  }
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
  const ledger = user?.financeLedgers?.find((entry) => entry.id === ledgerId);
  if (!ledger) {
    throw new Error('Finance ledger not found');
  }

  const nextLedgers = user.financeLedgers!.filter((entry) => entry.id !== ledgerId);
  const visibleToUserIds = ledger.visibleToUserIds ?? [];

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {
      financeLedgers: nextLedgers.length > 0 ? nextLedgers : undefined,
    });
    if (visibleToUserIds.length > 0) {
      await revokeDelegatedFinanceLedgerAccess(userId, ledgerId, visibleToUserIds);
    }
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {
    financeLedgers: nextLedgers.length > 0 ? nextLedgers : deleteField(),
  });
  if (visibleToUserIds.length > 0) {
    await revokeDelegatedFinanceLedgerAccess(userId, ledgerId, visibleToUserIds);
  }
}
