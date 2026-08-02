import {useEffect, useSyncExternalStore} from 'react';
import {subscribeToEmployeeUsers, subscribeToUsers} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser} from '@app/types/models';

export type UsersDirectoryScope = 'all' | 'employees';

interface ScopeRuntime {
  users: AppUser[];
  refs: number;
  ready: boolean;
  unsubscribe?: () => void;
}

const EMPTY_USERS: AppUser[] = [];

const scopes: Record<UsersDirectoryScope, ScopeRuntime> = {
  all: {users: EMPTY_USERS, refs: 0, ready: false},
  employees: {users: EMPTY_USERS, refs: 0, ready: false},
};

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function acquire(scope: UsersDirectoryScope): void {
  const runtime = scopes[scope];
  runtime.refs += 1;
  if (runtime.refs !== 1) {
    return;
  }

  const subscribeFn = scope === 'all' ? subscribeToUsers : subscribeToEmployeeUsers;
  runtime.unsubscribe = subscribeFn((users) => {
    runtime.users = users;
    runtime.ready = true;
    notify();
  });
}

function release(scope: UsersDirectoryScope): void {
  const runtime = scopes[scope];
  runtime.refs = Math.max(0, runtime.refs - 1);
  if (runtime.refs !== 0) {
    return;
  }

  runtime.unsubscribe?.();
  runtime.unsubscribe = undefined;
  runtime.users = EMPTY_USERS;
  runtime.ready = false;
  notify();
}

function getAllUsersSnapshot(): AppUser[] {
  return scopes.all.users;
}

function getEmployeeUsersSnapshot(): AppUser[] {
  return scopes.employees.users;
}

function getEmptyUsersSnapshot(): AppUser[] {
  return EMPTY_USERS;
}

const SNAPSHOT_BY_SCOPE: Record<UsersDirectoryScope, () => AppUser[]> = {
  all: getAllUsersSnapshot,
  employees: getEmployeeUsersSnapshot,
};

export function useUsersDirectory(
  scope: UsersDirectoryScope,
  enabled = true,
): {users: AppUser[]; isLoading: boolean} {
  const currentUser = useAuthStore((s) => s.user);
  // Firestore rules only allow full user collection queries for admins.
  const directoryEnabled = enabled && currentUser?.role === 'admin';

  const users = useSyncExternalStore(
    subscribe,
    directoryEnabled ? SNAPSHOT_BY_SCOPE[scope] : getEmptyUsersSnapshot,
    getEmptyUsersSnapshot,
  );

  useEffect(() => {
    if (!directoryEnabled) {
      return;
    }
    acquire(scope);
    return () => release(scope);
  }, [directoryEnabled, scope]);

  const isLoading = directoryEnabled && !scopes[scope].ready;

  return {users, isLoading};
}
