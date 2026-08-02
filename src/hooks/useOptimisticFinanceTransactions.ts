import {useCallback, useEffect, useMemo, useState} from 'react';
import type {Transaction} from '@app/types/models';

function sortNewestFirst(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function matchesOptimisticTransaction(real: Transaction, pending: Transaction): boolean {
  if (!pending.id.startsWith('pending-')) {
    return false;
  }
  if (real.userId !== pending.userId || real.type !== pending.type) {
    return false;
  }
  if (pending.ledgerId && real.ledgerId !== pending.ledgerId) {
    return false;
  }
  if (Math.abs(real.amount - pending.amount) >= 0.005) {
    return false;
  }
  const pendingAt = Date.parse(pending.createdAt);
  const realAt = Date.parse(real.createdAt);
  if (!Number.isFinite(pendingAt) || !Number.isFinite(realAt)) {
    return false;
  }
  return Math.abs(realAt - pendingAt) < 30_000;
}

export function useOptimisticFinanceTransactions(source: Transaction[]) {
  const [pending, setPending] = useState<Transaction[]>([]);

  useEffect(() => {
    if (pending.length === 0) {
      return;
    }
    setPending((current) =>
      current.filter((candidate) => !source.some((tx) => matchesOptimisticTransaction(tx, candidate))),
    );
  }, [pending.length, source]);

  const appendPending = useCallback((transaction: Transaction) => {
    setPending((current) => [transaction, ...current]);
  }, []);

  const removePending = useCallback((id: string) => {
    setPending((current) => current.filter((tx) => tx.id !== id));
  }, []);

  const transactions = useMemo(
    () => sortNewestFirst([...pending, ...source]),
    [pending, source],
  );

  return {transactions, appendPending, removePending};
}
