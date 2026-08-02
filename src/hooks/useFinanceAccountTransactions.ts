import {useCallback, useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import {subscribeToUsersTransactions} from '@app/services/transactions.service';
import type {Transaction} from '@app/types/models';

const EMPTY_TRANSACTIONS: Transaction[] = [];

interface Pool {
  userIds: string[];
  transactions: Transaction[];
  refs: number;
  ready: boolean;
  unsubscribe?: () => void;
}

const pools = new Map<string, Pool>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function buildPoolKey(userIds: string[]): string {
  return [...new Set(userIds.filter(Boolean))].sort().join('|');
}

function acquire(userIds: string[]): string {
  const key = buildPoolKey(userIds);
  if (!key) {
    return '';
  }

  let pool = pools.get(key);
  if (!pool) {
    pool = {
      userIds: key.split('|'),
      transactions: EMPTY_TRANSACTIONS,
      refs: 0,
      ready: false,
    };
    pools.set(key, pool);
  }

  pool.refs += 1;
  if (pool.refs !== 1) {
    return key;
  }

  pool.unsubscribe = subscribeToUsersTransactions(pool.userIds, (transactions) => {
    pool!.transactions = transactions;
    pool!.ready = true;
    notify();
  });

  return key;
}

function release(key: string): void {
  if (!key) {
    return;
  }

  const pool = pools.get(key);
  if (!pool) {
    return;
  }

  pool.refs = Math.max(0, pool.refs - 1);
  if (pool.refs !== 0) {
    return;
  }

  pool.unsubscribe?.();
  pools.delete(key);
  notify();
}

function getTransactionsSnapshot(key: string): Transaction[] {
  return pools.get(key)?.transactions ?? EMPTY_TRANSACTIONS;
}

function getEmptySnapshot(): Transaction[] {
  return EMPTY_TRANSACTIONS;
}

/** Shared finance-account transactions listener keyed by user id set (refcounted). */
export function useFinanceAccountTransactions(
  userIds: string[],
  enabled = true,
): {transactions: Transaction[]; isLoading: boolean} {
  const poolKey = useMemo(() => buildPoolKey(userIds), [userIds.join('|')]);
  const activeKeyRef = useRef('');
  activeKeyRef.current = enabled && poolKey ? poolKey : '';

  const getSnapshot = useCallback(() => {
    const key = activeKeyRef.current;
    return key ? getTransactionsSnapshot(key) : getEmptySnapshot();
  }, []);

  const transactions = useSyncExternalStore(subscribe, getSnapshot, getEmptySnapshot);

  useEffect(() => {
    if (!enabled || !poolKey) {
      return;
    }
    acquire(userIds);
    return () => release(poolKey);
  }, [enabled, poolKey, userIds]);

  const isLoading = enabled && Boolean(poolKey) && !pools.get(poolKey)?.ready;

  return {transactions, isLoading};
}
