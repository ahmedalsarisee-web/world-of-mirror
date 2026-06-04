import type {AppUser, Transaction, TransactionType} from '@app/types/models';
import {canViewAllFinanceCards} from '@app/utils/adminPermissions';
import {sortFinanceLedgersByCreatedAt} from '@app/utils/financeLedgers';
import {
  filterVisibleFinanceLedgers,
  shouldListFinanceLedgerOnFinanceHome,
} from '@app/utils/financePermissions';

/** Finance accounts/cards visible to the current viewer on Finance home. */
export function filterFinanceUsersForViewer(
  viewer: Pick<AppUser, 'id' | 'role' | 'isPrimaryAdmin' | 'email' | 'adminPermissions'> | null | undefined,
  financeUsers: AppUser[],
): AppUser[] {
  if (!viewer?.id) {
    return financeUsers;
  }
  if (viewer.role !== 'admin' || canViewAllFinanceCards(viewer as AppUser)) {
    return financeUsers;
  }
  return financeUsers.filter((user) => user.id === viewer.id);
}

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

export function affectsUserStoredBalance(type: TransactionType, ledgerId?: string): boolean {
  if (ledgerId) {
    return false;
  }
  return !isCustomLedgerTransactionType(type);
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

export function getCustomLedgerStats(
  transactions: Transaction[],
  ledgerId: string,
): {transactionCount: number; lastTransactionAt: string | null} {
  const ledgerTxs = filterCustomLedgerTransactions(transactions, ledgerId);
  if (ledgerTxs.length === 0) {
    return {transactionCount: 0, lastTransactionAt: null};
  }

  const lastTransactionAt = ledgerTxs.reduce(
    (latest, tx) => (tx.createdAt.localeCompare(latest) > 0 ? tx.createdAt : latest),
    ledgerTxs[0].createdAt,
  );

  return {transactionCount: ledgerTxs.length, lastTransactionAt};
}

export function filterSubLedgerScopeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => isSubLedgerTransactionType(tx.type));
}

export function filterCashScopeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => !isSubLedgerTransactionType(tx.type) && !tx.ledgerId);
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

/** Balance shown on finance home cash account rows. */
export function resolveFinanceAccountDisplayBalance(
  user: Pick<AppUser, 'balance'>,
  transactions: Transaction[],
): number {
  return resolveCashAccountBalance(user.balance, transactions);
}

export function computeFinanceAccountsTotalBalance(
  users: Array<Pick<AppUser, 'id' | 'balance'>>,
  transactions: Transaction[],
): number {
  return users.reduce((sum, user) => {
    const userTransactions = transactions.filter((transaction) => transaction.userId === user.id);
    return sum + resolveFinanceAccountDisplayBalance(user, userTransactions);
  }, 0);
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

export function computeAllCustomLedgersTotalBalance(
  users: Array<Pick<AppUser, 'id' | 'financeLedgers'>>,
  transactions: Transaction[],
): number {
  return users.reduce((sum, user) => {
    const userTransactions = transactions.filter((transaction) => transaction.userId === user.id);
    const ledgers = user.financeLedgers ?? [];
    const ledgersTotal = ledgers.reduce(
      (ledgerSum, ledger) => ledgerSum + computeCustomLedgerBalance(userTransactions, ledger.id),
      0,
    );
    return sum + ledgersTotal;
  }, 0);
}

/** Cash accounts plus all additional finance cards. */
export function computeFinanceGrandTotalBalance(
  users: Array<Pick<AppUser, 'id' | 'balance' | 'financeLedgers'>>,
  transactions: Transaction[],
): number {
  return (
    computeFinanceAccountsTotalBalance(users, transactions) +
    computeAllCustomLedgersTotalBalance(users, transactions)
  );
}

/** Sum of every finance card rendered on FinanceHome for the current viewer. */
export function computeFinanceHomePageTotalBalance(
  currentUser: Pick<AppUser, 'id' | 'role' | 'financeLedgers' | 'isPrimaryAdmin' | 'email' | 'adminPermissions'> | null | undefined,
  financeUsers: AppUser[],
  transactions: Transaction[],
): number {
  if (!currentUser?.id) {
    return 0;
  }

  const visibleFinanceUsers = filterFinanceUsersForViewer(currentUser, financeUsers);

  const cashAccountUsers =
    currentUser.role === 'admin'
      ? visibleFinanceUsers
      : [visibleFinanceUsers.find((user) => user.id === currentUser.id) ?? (currentUser as AppUser)];

  let total = computeFinanceAccountsTotalBalance(cashAccountUsers, transactions);

  const ownAccount =
    visibleFinanceUsers.find((user) => user.id === currentUser.id) ?? (currentUser as AppUser);
  const ownTransactions = transactions.filter((transaction) => transaction.userId === ownAccount.id);
  const visibleOwnLedgers = filterVisibleFinanceLedgers(
    currentUser,
    ownAccount,
    ownAccount.financeLedgers ?? [],
  );

  for (const ledger of visibleOwnLedgers) {
    total += computeCustomLedgerBalance(ownTransactions, ledger.id);
  }

  for (const owner of visibleFinanceUsers) {
    if (owner.id === currentUser.id) {
      continue;
    }

    const ownerTransactions = transactions.filter((transaction) => transaction.userId === owner.id);
    const ledgers = sortFinanceLedgersByCreatedAt(owner.financeLedgers ?? []);

    for (const ledger of ledgers) {
      if (!shouldListFinanceLedgerOnFinanceHome(currentUser, owner, ledger)) {
        continue;
      }
      total += computeCustomLedgerBalance(ownerTransactions, ledger.id);
    }
  }

  return total;
}
