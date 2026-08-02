import {StorageKeys} from '@app/constants/StorageKeys';
import type {AppUser} from '@app/types/models';
import {storage} from '@app/utils/storage';

export async function readCachedAuthProfile(): Promise<AppUser | null> {
  const raw = await storage.getString(StorageKeys.CACHED_USER_PROFILE);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

export async function writeCachedAuthProfile(user: AppUser | null): Promise<void> {
  if (!user) {
    await storage.delete(StorageKeys.CACHED_USER_PROFILE);
    return;
  }

  await storage.set(StorageKeys.CACHED_USER_PROFILE, JSON.stringify(user));
}
