import type {AppUser, Transaction, TransactionType} from '@app/types/models';

export interface FinanceTotals {
  cashIn: number;
  cashOut: number;
}

export interface AdvanceTotals {
  totalAdvanced: number;
  totalRepaid: number;
  outstanding: number;
}

const DEBIT_TYPES = new Set(['paid', 'advance', 'ledger_debit']);

export function normalizeTransactionType(type: string): TransactionType {
  if (
    type === 'received' ||
    type === 'paid' ||
    type === 'order_collection' ||
    type === 'advance' ||
    type === 'advance_repayment' ||
    type === 'ledger_debit' ||
    type === 'ledger_credit'
  ) {
    return type;
  }
  return 'received';
}

export function normalizeTransactionAmount(type: string, amount: number): number {
  const numeric = Number(amount) || 0;
  if (numeric < 0) {
    return numeric;
  }
  if (DEBIT_TYPES.has(type)) {
    return -Math.abs(numeric);
  }
  return Math.abs(numeric);
}

export function computeAccountBalance(transactions: Transaction[]): number {
  return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
}

export function computeBalancesByUserId(transactions: Transaction[]): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const transaction of transactions) {
    balances[transaction.userId] = (balances[transaction.userId] ?? 0) + transaction.amount;
  }
  return balances;
}

export function resolveAccountBalance(storedBalance: number, transactions: Transaction[]): number {
  if (transactions.length === 0) {
    return storedBalance;
  }
  return computeAccountBalance(transactions);
}

export function computeFinanceTotals(transactions: Transaction[]): FinanceTotals {
  const cashIn = transactions.filter((tx) => tx.amount >= 0).reduce((sum, tx) => sum + tx.amount, 0);
  const cashOut = transactions
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  return {cashIn, cashOut};
}

export function computeAdvanceTotals(transactions: Transaction[]): AdvanceTotals {
  const totalAdvanced = transactions
    .filter((tx) => tx.type === 'advance')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const totalRepaid = transactions
    .filter((tx) => tx.type === 'advance_repayment')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  return {
    totalAdvanced,
    totalRepaid,
    outstanding: Math.max(0, totalAdvanced - totalRepaid),
  };
}

export function isAdvanceScopeTransactionType(type: TransactionType): boolean {
  return type === 'advance' || type === 'advance_repayment';
}

export function isCustomLedgerTransactionType(type: TransactionType): boolean {
  return type === 'ledger_debit' || type === 'ledger_credit';
}

export function isSubLedgerTransactionType(type: TransactionType): boolean {
  return isAdvanceScopeTransactionType(type) || isCustomLedgerTransactionType(type);
}

export function filterAdvanceScopeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => isAdvanceScopeTransactionType(tx.type));
}

export function filterCustomLedgerTransactions(
  transactions: Transaction[],
  ledgerId: string,
): Transaction[] {
  return transactions.filter((tx) => tx.ledgerId === ledgerId);
}

export function filterSubLedgerScopeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => isSubLedgerTransactionType(tx.type));
}

export function filterCashScopeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => !isSubLedgerTransactionType(tx.type));
}

export function filterTransactionsForUsers(
  transactions: Transaction[],
  users: Array<Pick<AppUser, 'id'>>,
): Transaction[] {
  const userIds = new Set(users.map((user) => user.id));
  return transactions.filter((transaction) => userIds.has(transaction.userId));
}

export function resolveCashAccountBalance(storedBalance: number, transactions: Transaction[]): number {
  if (transactions.length === 0) {
    return storedBalance;
  }
  return computeAccountBalance(filterCashScopeTransactions(transactions));
}

export function resolveEmployeeFinanceTotalBalance(
  storedBalance: number,
  transactions: Transaction[],
): number {
  if (transactions.length === 0) {
    return storedBalance;
  }
  const cashBalance = resolveCashAccountBalance(storedBalance, transactions);
  const subLedgerBalance = computeAccountBalance(filterSubLedgerScopeTransactions(transactions));
  return cashBalance - subLedgerBalance;
}

/** Net salary-advance balance — same summation model as the cash account page. */
export function computeAdvanceAccountBalance(transactions: Transaction[]): number {
  return computeAccountBalance(filterAdvanceScopeTransactions(transactions));
}

export function resolveAdvanceAccountBalance(
  transactions: Transaction[],
): number {
  return computeAdvanceAccountBalance(transactions);
}

/** Net balance for an admin-defined custom finance card. */
export function computeCustomLedgerBalance(
  transactions: Transaction[],
  ledgerId: string,
): number {
  return computeAccountBalance(filterCustomLedgerTransactions(transactions, ledgerId));
}
