import type {AppUser, EmployeePermissions, EmployeePermissionModule} from '@app/types/models';

export function getDefaultEmployeePermissions(): EmployeePermissions {
  return {
    finance: true,
    attendanceLocationRequired: true,
    attendanceGpsLinked: false,
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
    attendanceLocationRequired: Boolean(user.permissions.attendanceLocationRequired),
    attendanceGpsLinked: Boolean(user.permissions.attendanceGpsLinked),
  };
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
  if (permissions.attendanceLocationRequired) {
    labels.push(t('permissionAttendanceLocation'));
  }
  if (permissions.attendanceGpsLinked) {
    labels.push(t('permissionAttendanceGpsLinked'));
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
