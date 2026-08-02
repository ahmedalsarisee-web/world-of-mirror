import type {AppUser} from '@app/types/models';
import type {OrdersHomeCardConfig} from '@app/types/ordersHomeCard';
import {isPrimaryAdmin} from '@app/utils/adminPermissions';
import {isArchivedEmployee} from '@app/services/users.service';

type Viewer = Pick<AppUser, 'id' | 'role' | 'isPrimaryAdmin' | 'email'> | null | undefined;

export function getOrdersHomeCardVisibilityCandidates(users: AppUser[]): AppUser[] {
  return users
    .filter((user) => {
      if (user.role === 'admin') {
        return true;
      }
      if (user.role === 'employee') {
        return !isArchivedEmployee(user);
      }
      return false;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterOrdersHomeCardVisibilitySelection(
  userIds: string[],
  candidates: AppUser[],
): string[] {
  const allowed = new Set(candidates.map((user) => user.id));
  return userIds.filter((id) => allowed.has(id));
}

export function canViewOrdersHomeCard(
  viewer: Viewer,
  authEmail: string | null | undefined,
  card: Pick<OrdersHomeCardConfig, 'visibleToUserIds'>,
): boolean {
  if (!viewer?.id) {
    return false;
  }

  if (isPrimaryAdmin(viewer, authEmail)) {
    return true;
  }

  const visibleTo = card.visibleToUserIds ?? [];
  if (visibleTo.length === 0) {
    return viewer.role === 'admin' || viewer.role === 'employee';
  }

  return visibleTo.includes(viewer.id);
}

export function filterVisibleOrdersHomeCards(
  viewer: Viewer,
  authEmail: string | null | undefined,
  cards: OrdersHomeCardConfig[],
): OrdersHomeCardConfig[] {
  return cards.filter((card) => canViewOrdersHomeCard(viewer, authEmail, card));
}

export function normalizeOrdersHomeCardVisibility(userIds: string[]): string[] | undefined {
  const unique = [...new Set(userIds.filter(Boolean))];
  return unique.length > 0 ? unique : undefined;
}
