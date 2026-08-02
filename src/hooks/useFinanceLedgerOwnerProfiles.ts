import {useEffect, useMemo, useState} from 'react';
import {subscribeToUser} from '@app/services/users.service';
import type {AppUser} from '@app/types/models';
import {getDelegatedFinanceLedgerOwnerIds} from '@app/utils/financeLedgers';

/** Live admin owner profiles for shared finance cards (financeLedgers stay fresh). */
export function useFinanceLedgerOwnerProfiles(
  viewer: AppUser | null | undefined,
  ownerIds: string[],
  enabled: boolean,
): {owners: AppUser[]; isLoading: boolean} {
  const [ownersById, setOwnersById] = useState<Record<string, AppUser | null>>({});
  const [readyById, setReadyById] = useState<Record<string, boolean>>({});

  const uniqueOwnerIds = useMemo(
    () => [...new Set(ownerIds.filter((id) => id && id !== viewer?.id))],
    [ownerIds, viewer?.id],
  );
  const ownerIdsKey = uniqueOwnerIds.join('|');

  useEffect(() => {
    if (!enabled || !viewer?.id || !uniqueOwnerIds.length) {
      setOwnersById({});
      setReadyById({});
      return;
    }

    setReadyById({});
    const unsubs = uniqueOwnerIds.map((ownerId) =>
      subscribeToUser(ownerId, (owner) => {
        setOwnersById((prev) => ({...prev, [ownerId]: owner}));
        setReadyById((prev) => ({...prev, [ownerId]: true}));
      }),
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [enabled, ownerIdsKey, uniqueOwnerIds, viewer?.id]);

  const owners = useMemo(
    () =>
      uniqueOwnerIds
        .map((ownerId) => ownersById[ownerId])
        .filter((owner): owner is AppUser => Boolean(owner)),
    [ownersById, uniqueOwnerIds],
  );

  const isLoading =
    enabled &&
    Boolean(viewer?.id) &&
    uniqueOwnerIds.length > 0 &&
    !uniqueOwnerIds.every((ownerId) => readyById[ownerId]);

  return {owners, isLoading};
}

export function mergeFinanceDirectoryUsers(
  directoryUsers: AppUser[],
  ownerProfiles: AppUser[],
): AppUser[] {
  const byId = new Map(directoryUsers.map((user) => [user.id, user]));
  for (const owner of ownerProfiles) {
    const existing = byId.get(owner.id);
    byId.set(owner.id, existing ? {...existing, ...owner, financeLedgers: owner.financeLedgers ?? existing.financeLedgers} : owner);
  }
  return [...byId.values()];
}

export function resolveFinanceOwnerIdsForSharedCards(
  viewer: AppUser | null | undefined,
  directoryUsers: AppUser[],
): string[] {
  const ownerIds = new Set<string>(getDelegatedFinanceLedgerOwnerIds(viewer));
  for (const user of directoryUsers) {
    if (user.role === 'admin') {
      ownerIds.add(user.id);
    }
  }
  return [...ownerIds];
}
