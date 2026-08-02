import type {AppUser} from '@app/types/models';

/** Lightweight session snapshot to avoid service ↔ authStore import cycles. */
let sessionUser: AppUser | null = null;

export function syncAuthSession(user: AppUser | null): void {
  sessionUser = user;
}

export function getAuthSessionUser(): AppUser | null {
  return sessionUser;
}

export function getAuthSessionUserId(): string | undefined {
  return sessionUser?.id;
}
