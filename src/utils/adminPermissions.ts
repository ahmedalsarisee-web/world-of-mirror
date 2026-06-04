import {isPrimaryAdminEmail} from '@app/config/adminAccess';
import type {AdminPermissions, AppUser} from '@app/types/models';

type AdminActor = Pick<AppUser, 'id' | 'role' | 'isPrimaryAdmin' | 'email'>;
type AdminTarget = Pick<AppUser, 'id' | 'role' | 'isPrimaryAdmin'>;

export const ADMIN_PERMISSION_OPTIONS: {
  field: keyof AdminPermissions;
  labelKey: string;
  icon: string;
}[] = [
  {field: 'showMirrorCartCostPrice', labelKey: 'permissionShowMirrorCartCostPrice', icon: 'cash-lock'},
  {field: 'showEmployeeManagement', labelKey: 'permissionShowEmployeeManagement', icon: 'account-supervisor'},
  {field: 'showAllFinanceCards', labelKey: 'permissionShowAllFinanceCards', icon: 'wallet-outline'},
];

export function getDefaultAdminPermissions(): AdminPermissions {
  return {
    showMirrorCartCostPrice: false,
    showEmployeeManagement: false,
    showAllFinanceCards: false,
  };
}

export function resolveAdminPermissions(user: AppUser | null | undefined): AdminPermissions {
  const defaults = getDefaultAdminPermissions();
  if (!user || user.role !== 'admin') {
    return defaults;
  }
  if (user.isPrimaryAdmin || isPrimaryAdminEmail(user.email)) {
    return {
      showMirrorCartCostPrice: true,
      showEmployeeManagement: true,
      showAllFinanceCards: true,
    };
  }
  if (!user.adminPermissions) {
    return defaults;
  }
  return {
    showMirrorCartCostPrice: Boolean(user.adminPermissions.showMirrorCartCostPrice),
    showEmployeeManagement: Boolean(user.adminPermissions.showEmployeeManagement),
    showAllFinanceCards: Boolean(user.adminPermissions.showAllFinanceCards),
  };
}

export function canViewAllFinanceCards(user: AppUser | null | undefined): boolean {
  return resolveAdminPermissions(user).showAllFinanceCards;
}

export function canViewMirrorCartCost(user: AppUser | null | undefined): boolean {
  return resolveAdminPermissions(user).showMirrorCartCostPrice;
}

export function canAccessEmployeeManagement(user: AppUser | null | undefined): boolean {
  if (!user || user.role !== 'admin') {
    return false;
  }
  return resolveAdminPermissions(user).showEmployeeManagement;
}

export function isPrimaryAdmin(
  user: AdminActor | null | undefined,
  authEmail?: string | null,
): boolean {
  if (!user) {
    return false;
  }
  if (user.isPrimaryAdmin) {
    return true;
  }
  return isPrimaryAdminEmail(user.email ?? authEmail);
}

export function canManageAdmins(
  actor: AdminActor | null | undefined,
  authEmail?: string | null,
): boolean {
  return isPrimaryAdmin(actor, authEmail);
}

export function canDeleteUser(
  actor: AdminActor | null | undefined,
  target: AdminTarget,
  authEmail?: string | null,
): boolean {
  if (!actor || actor.role !== 'admin' || actor.id === target.id) {
    return false;
  }

  if (target.isPrimaryAdmin) {
    return false;
  }

  if (target.role === 'employee') {
    return true;
  }

  if (target.role === 'admin') {
    return isPrimaryAdmin(actor, authEmail);
  }

  return false;
}

export function getAdminUsers(users: AppUser[]): AppUser[] {
  return users
    .filter((user) => user.role === 'admin')
    .sort((a, b) => a.name.localeCompare(b.name));
}
