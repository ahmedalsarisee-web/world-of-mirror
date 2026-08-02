import type {TFunction} from 'i18next';
import type {AppUser} from '@app/types/models';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import type {UserRole} from '@app/types/models';

export function resolveConfirmedByRoleLabel(role: UserRole | undefined, t: TFunction): string {
  return role === 'admin' ? t('adminRole') : t('employeeRole');
}

/** Display who confirmed the order, e.g. "أكّد الطلب: أحمد · مدير" */
export function formatOrderConfirmedByLabel(
  order: Pick<MirrorPricingConfirmedOrder, 'confirmedByUserName' | 'confirmedByUserRole'>,
  t: TFunction,
): string | null {
  const name = order.confirmedByUserName?.trim();
  if (!name) {
    return null;
  }

  const roleLabel = resolveConfirmedByRoleLabel(order.confirmedByUserRole, t);
  return t('mirrorOrdersConfirmedBy', {name, role: roleLabel});
}

/** Compact note for order cards, e.g. "أكّد: أحمد" */
export function formatOrderConfirmedByShortNote(
  order: Pick<MirrorPricingConfirmedOrder, 'confirmedByUserName' | 'confirmedByUserRole'>,
  t: TFunction,
): string | null {
  const name = order.confirmedByUserName?.trim();
  if (!name) {
    return null;
  }

  return t('mirrorOrdersConfirmedByShort', {name});
}

export function resolveOrderConfirmedByLabel(
  order: Pick<
    MirrorPricingConfirmedOrder,
    'confirmedByUserId' | 'confirmedByUserName' | 'confirmedByUserRole'
  >,
  usersById: ReadonlyMap<string, Pick<AppUser, 'name' | 'role'>>,
  t: TFunction,
): string | null {
  const direct = formatOrderConfirmedByLabel(order, t);
  if (direct) {
    return direct;
  }

  if (!order.confirmedByUserId) {
    return null;
  }

  const user = usersById.get(order.confirmedByUserId);
  if (!user?.name.trim()) {
    return null;
  }

  return formatOrderConfirmedByLabel(
    {confirmedByUserName: user.name, confirmedByUserRole: user.role},
    t,
  );
}

export function resolveOrderConfirmedByName(
  order: Pick<MirrorPricingConfirmedOrder, 'confirmedByUserId' | 'confirmedByUserName'>,
  usersById: ReadonlyMap<string, Pick<AppUser, 'name'>>,
): string | null {
  const direct = order.confirmedByUserName?.trim();
  if (direct) {
    return direct;
  }

  if (!order.confirmedByUserId) {
    return null;
  }

  return usersById.get(order.confirmedByUserId)?.name?.trim() || null;
}

export function resolveOrderConfirmedByShortNote(
  order: Pick<
    MirrorPricingConfirmedOrder,
    'confirmedByUserId' | 'confirmedByUserName' | 'confirmedByUserRole'
  >,
  usersById: ReadonlyMap<string, Pick<AppUser, 'name' | 'role'>>,
  t: TFunction,
): string | null {
  const direct = formatOrderConfirmedByShortNote(order, t);
  if (direct) {
    return direct;
  }

  if (!order.confirmedByUserId) {
    return null;
  }

  const user = usersById.get(order.confirmedByUserId);
  if (!user?.name.trim()) {
    return null;
  }

  return formatOrderConfirmedByShortNote(
    {confirmedByUserName: user.name, confirmedByUserRole: user.role},
    t,
  );
}

export function buildConfirmedByFieldsFromUser(
  user: {id: string; name: string; role: UserRole} | null | undefined,
): Pick<MirrorPricingConfirmedOrder, 'confirmedByUserId' | 'confirmedByUserName' | 'confirmedByUserRole'> {
  if (!user) {
    return {};
  }

  const name = user.name.trim();
  return {
    confirmedByUserId: user.id,
    ...(name
      ? {
          confirmedByUserName: name,
          confirmedByUserRole: user.role,
        }
      : {}),
  };
}
