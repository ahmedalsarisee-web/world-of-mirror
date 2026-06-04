import type {Transaction} from '@app/types/models';

export const EMPLOYEE_TRANSACTION_EDIT_WINDOW_MS = 60 * 60 * 1000;

type TimedTransaction = Pick<Transaction, 'pinnedAt' | 'createdAt'>;

export function getTransactionConfirmedAt(transaction: TimedTransaction): string {
  return transaction.pinnedAt ?? transaction.createdAt;
}

export function isWithinEmployeeTransactionEditWindow(
  transaction: TimedTransaction,
  now = Date.now(),
): boolean {
  const confirmedAt = getTransactionConfirmedAt(transaction);
  if (!confirmedAt) {
    return false;
  }
  const confirmedMs = Date.parse(confirmedAt);
  if (Number.isNaN(confirmedMs)) {
    return false;
  }
  return now - confirmedMs < EMPLOYEE_TRANSACTION_EDIT_WINDOW_MS;
}

export function getEmployeeTransactionEditWindowRemainingMs(
  transaction: TimedTransaction,
  now = Date.now(),
): number {
  const confirmedAt = getTransactionConfirmedAt(transaction);
  const confirmedMs = Date.parse(confirmedAt);
  if (Number.isNaN(confirmedMs)) {
    return 0;
  }
  return Math.max(0, EMPLOYEE_TRANSACTION_EDIT_WINDOW_MS - (now - confirmedMs));
}
