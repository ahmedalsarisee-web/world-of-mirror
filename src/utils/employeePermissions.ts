import type {AppUser, EmployeePermissions, EmployeePermissionModule} from '@app/types/models';

export function getDefaultEmployeePermissions(): EmployeePermissions {
  return {
    finance: true,
    employeeFinance: false,
    employeeAttendance: false,
    attendanceLocationRequired: true,
    attendanceGpsLinked: false,
    moveOrders: false,
    deleteOrders: false,
    orderCardNotes: false,
    editFinanceTransactions: false,
    showNotificationsIcon: false,
  };
}

export function resolveEmployeePermissions(user: AppUser | null | undefined): EmployeePermissions {
  const defaults = getDefaultEmployeePermissions();
  if (!user || user.role === 'admin') {
    return defaults;
  }
  if (!user.permissions) {
    return defaults;
  }
  return {
    ...defaults,
    ...user.permissions,
    finance: Boolean(user.permissions.finance),
    employeeFinance: Boolean(user.permissions.employeeFinance),
    employeeAttendance: Boolean(user.permissions.employeeAttendance),
    attendanceLocationRequired: Boolean(user.permissions.attendanceLocationRequired),
    attendanceGpsLinked: Boolean(user.permissions.attendanceGpsLinked),
    moveOrders: Boolean(user.permissions.moveOrders),
    deleteOrders: Boolean(user.permissions.deleteOrders),
    orderCardNotes: Boolean(user.permissions.orderCardNotes),
    editFinanceTransactions: Boolean(user.permissions.editFinanceTransactions),
    showNotificationsIcon: Boolean(user.permissions.showNotificationsIcon),
  };
}

export function canManageEmployeeFinance(user: AppUser | null | undefined): boolean {
  return user?.role === 'employee' && resolveEmployeePermissions(user).employeeFinance;
}

export function canViewEmployeeAttendance(user: AppUser | null | undefined): boolean {
  return user?.role === 'employee' && resolveEmployeePermissions(user).employeeAttendance;
}

export function canMoveOrders(user: AppUser | null | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  return resolveEmployeePermissions(user).moveOrders;
}

export function canLeaveOrderCardNotes(user: AppUser | null | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  return resolveEmployeePermissions(user).orderCardNotes;
}

export function canDeleteOrders(user: AppUser | null | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  return resolveEmployeePermissions(user).deleteOrders;
}

export function canEditFinanceTransactionsUnrestricted(user: AppUser | null | undefined): boolean {
  return user?.role === 'employee' && resolveEmployeePermissions(user).editFinanceTransactions;
}

export function canViewNotificationsLog(user: AppUser | null | undefined): boolean {
  if (!user?.id) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  return resolveEmployeePermissions(user).showNotificationsIcon;
}

export function filterEmployeesForAttendanceViewer(
  viewer: AppUser | null | undefined,
  employees: AppUser[],
): AppUser[] {
  if (!viewer?.id) {
    return [];
  }
  if (viewer.role === 'admin') {
    return employees;
  }
  if (canViewEmployeeAttendance(viewer)) {
    return employees.filter((employee) => employee.role === 'employee');
  }
  return [];
}

export function canAccessFinanceTab(user: AppUser | null | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  const permissions = resolveEmployeePermissions(user);
  const hasDelegatedFinanceCards = (user.delegatedFinanceLedgerAccess ?? []).length > 0;
  return permissions.finance || permissions.employeeFinance || hasDelegatedFinanceCards;
}

export function canAccessModule(
  user: AppUser | null | undefined,
  module: EmployeePermissionModule,
): boolean {
  return resolveEmployeePermissions(user)[module];
}

export function formatPermissionSummary(
  permissions: EmployeePermissions,
  t: (key: string) => string,
): string {
  const labels: string[] = [];
  if (permissions.finance) {
    labels.push(t('permissionFinance'));
  }
  if (permissions.employeeFinance) {
    labels.push(t('permissionEmployeeFinance'));
  }
  if (permissions.employeeAttendance) {
    labels.push(t('permissionEmployeeAttendance'));
  }
  if (permissions.attendanceLocationRequired) {
    labels.push(t('permissionAttendanceLocation'));
  }
  if (permissions.attendanceGpsLinked) {
    labels.push(t('permissionAttendanceGpsLinked'));
  }
  if (permissions.moveOrders) {
    labels.push(t('permissionMoveOrders'));
  }
  if (permissions.deleteOrders) {
    labels.push(t('permissionDeleteOrders'));
  }
  if (permissions.orderCardNotes) {
    labels.push(t('permissionOrderCardNotes'));
  }
  if (permissions.editFinanceTransactions) {
    labels.push(t('permissionEditFinanceTransactions'));
  }
  if (permissions.showNotificationsIcon) {
    labels.push(t('permissionShowNotificationsIcon'));
  }
  if (labels.length === 0) {
    return t('noPermissions');
  }
  return labels.join(' · ');
}

export function requiresAttendanceLocationCheck(user: AppUser | null | undefined): boolean {
  return resolveEmployeePermissions(user).attendanceLocationRequired;
}

export function requiresAttendanceGpsLinked(user: AppUser | null | undefined): boolean {
  return resolveEmployeePermissions(user).attendanceGpsLinked;
}
