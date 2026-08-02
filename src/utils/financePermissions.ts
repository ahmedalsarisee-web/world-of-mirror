import type {AppUser, Transaction, UserRole} from '@app/types/models';

import {canViewAllFinanceCards, isPrimaryAdmin} from '@app/utils/adminPermissions';
import {
  canEditFinanceTransactionsUnrestricted,
  canManageEmployeeFinance,
  resolveEmployeePermissions,
} from '@app/utils/employeePermissions';
import {buildDelegatedFinanceLedgerAccessKey, isMemoFinanceLedger} from '@app/utils/financeLedgers';
import {isWithinEmployeeTransactionEditWindow} from '@app/utils/financeTransactionWindow';

type FinanceUser = Pick<
  AppUser,
  | 'id'
  | 'role'
  | 'isPrimaryAdmin'
  | 'email'
  | 'archivedAt'
  | 'delegatedFinanceLedgerAccess'
  | 'adminPermissions'
  | 'permissions'
>;

function isArchivedFinanceAccount(target: Pick<AppUser, 'role' | 'archivedAt'>): boolean {
  return target.role === 'employee' && Boolean(target.archivedAt);
}

type ModifiableTransaction = Pick<

  Transaction,

  'isPinned' | 'createdByRole' | 'createdByUserId' | 'pinnedAt' | 'createdAt'

>;



export function isEmployeePinnedTransaction(transaction: Pick<Transaction, 'isPinned' | 'createdByRole'>): boolean {

  if (transaction.createdByRole === 'admin') {

    return false;

  }

  if (transaction.isPinned === true || transaction.createdByRole === 'employee') {

    return true;

  }

  return transaction.createdByRole === undefined;

}



export function shouldPinTransactionOnCreate(createdByRole: UserRole): boolean {

  return createdByRole === 'employee';

}



export function isTransactionCreatedByEmployee(

  viewer: FinanceUser,

  transaction: Pick<Transaction, 'createdByUserId' | 'createdByRole'>,

): boolean {

  if (transaction.createdByUserId) {

    return transaction.createdByUserId === viewer.id;

  }

  return transaction.createdByRole === 'employee';

}



export function shouldShowEditableWindowBadge(

  transaction: ModifiableTransaction,

  now = Date.now(),

): boolean {

  return isEmployeePinnedTransaction(transaction) && isWithinEmployeeTransactionEditWindow(transaction, now);

}



export function shouldShowPinnedBadge(

  transaction: ModifiableTransaction,

  now = Date.now(),

): boolean {

  return isEmployeePinnedTransaction(transaction) && !isWithinEmployeeTransactionEditWindow(transaction, now);

}



function canEmployeeModifyOwnTransaction(

  viewer: FinanceUser,

  target: FinanceUser,

  transaction: ModifiableTransaction,

  now = Date.now(),

): boolean {

  if (viewer.role !== 'employee' || viewer.id !== target.id) {

    return false;

  }

  if (!isTransactionCreatedByEmployee(viewer, transaction)) {

    return false;

  }

  return isWithinEmployeeTransactionEditWindow(transaction, now);

}



function canAdminModifyTransaction(

  viewer: FinanceUser,

  target: FinanceUser,

  transaction: ModifiableTransaction,

): boolean {

  if (viewer.role !== 'admin') {

    return false;

  }

  if (target.role === 'employee') {
    return true;
  }

  if (isPrimaryAdmin(viewer) && target.id !== viewer.id) {

    return true;

  }

  return target.id === viewer.id;

}



function canEmployeeFinanceManagerModifyTransaction(

  viewer: FinanceUser,

  target: FinanceUser,

): boolean {

  return canManageEmployeeFinance(viewer as AppUser) && target.role === 'employee';

}



function canPrimaryAdminManageFinanceCard(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  return Boolean(viewer && isPrimaryAdmin(viewer) && canViewFinanceAccount(viewer, target));

}



export function canViewFinanceAccount(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  if (!viewer) {

    return false;

  }

  if (isArchivedFinanceAccount(target)) {
    return false;
  }

  if (viewer.role === 'admin') {
    if (target.role === 'employee') {
      return false;
    }
    return canViewAllFinanceCards(viewer) || viewer.id === target.id;
  }

  if (viewer.id === target.id) {
    if (viewer.role === 'employee') {
      return false;
    }
    return resolveEmployeePermissions(viewer as AppUser).finance;
  }

  return canManageEmployeeFinance(viewer as AppUser) && target.role === 'employee';

}

/** Firestore `users.balance` is maintained only for admins and employee-finance managers. */
export function canPersistStoredBalance(
  viewer: FinanceUser | null | undefined,
  target: Pick<AppUser, 'id' | 'role' | 'archivedAt'>,
): boolean {
  if (!viewer || isArchivedFinanceAccount(target)) {
    return false;
  }

  if (viewer.role === 'admin') {
    return true;
  }

  return (
    viewer.role === 'employee' &&
    canManageEmployeeFinance(viewer as AppUser) &&
    target.role === 'employee'
  );
}



export function canManageFinanceAccount(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  if (!viewer) {

    return false;

  }

  if (!canViewFinanceAccount(viewer, target)) {

    return false;

  }

  if (viewer.role === 'employee') {

    if (viewer.id === target.id) {
      return resolveEmployeePermissions(viewer as AppUser).finance;
    }

    return canManageEmployeeFinance(viewer as AppUser) && target.role === 'employee';

  }

  if (target.role === 'employee') {

    return true;

  }

  if (target.role === 'admin') {

    return target.id === viewer.id || isPrimaryAdmin(viewer);

  }

  return target.id === viewer.id;

}



export function canEditFinanceTransaction(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

  transaction: ModifiableTransaction & Pick<Transaction, 'ledgerId'>,

  now = Date.now(),

  ledger?: Pick<import('@app/types/models').EmployeeFinanceLedger, 'id' | 'visibleToUserIds'>,

): boolean {

  if (!viewer) {

    return false;

  }

  const canAccessTarget =
    canViewFinanceAccount(viewer, target) ||
    (ledger ? canViewFinanceLedger(viewer, target, ledger) : false);

  if (!canAccessTarget) {

    return false;

  }

  if (
    ledger &&
    transaction.ledgerId &&
    transaction.ledgerId === ledger.id &&
    hasFullFinanceLedgerTransactionControl(viewer, target, ledger)
  ) {

    return true;

  }

  if (canAdminModifyTransaction(viewer, target, transaction)) {

    return true;

  }

  if (canEmployeeFinanceManagerModifyTransaction(viewer, target)) {

    return true;

  }

  if (
    viewer.role === 'employee' &&
    canEditFinanceTransactionsUnrestricted(viewer as AppUser)
  ) {
    if (viewer.id === target.id && canManageFinanceAccount(viewer, target)) {
      if (ledger) {
        if (transaction.ledgerId === ledger.id) {
          return true;
        }
      } else if (!transaction.ledgerId) {
        return true;
      }
    }

    if (
      ledger &&
      transaction.ledgerId === ledger.id &&
      canViewFinanceLedger(viewer, target, ledger)
    ) {
      return true;
    }
  }

  return canEmployeeModifyOwnTransaction(viewer, target, transaction, now);

}



export function canDeleteFinanceTransaction(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

  transaction: ModifiableTransaction & Pick<Transaction, 'ledgerId'>,

  now = Date.now(),

  ledger?: Pick<import('@app/types/models').EmployeeFinanceLedger, 'id' | 'visibleToUserIds'>,

): boolean {

  return canEditFinanceTransaction(viewer, target, transaction, now, ledger);

}



export function canClearAdvanceScopeTransactions(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  if (!viewer || !canManageFinanceAccount(viewer, target)) {
    return false;
  }

  if (canPrimaryAdminManageFinanceCard(viewer, target)) {
    return true;
  }

  if (target.role !== 'employee') {
    return false;
  }

  return viewer.role === 'admin' || canManageEmployeeFinance(viewer as AppUser);

}



export function canClearCashScopeTransactions(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  if (!viewer || !canManageFinanceAccount(viewer, target)) {
    return false;
  }

  if (canPrimaryAdminManageFinanceCard(viewer, target)) {
    return true;
  }

  if (target.role !== 'employee') {
    return false;
  }

  return viewer.role === 'admin' || canManageEmployeeFinance(viewer as AppUser);

}



export function canEmployeeManageOwnMemoLedgers(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  return (

    viewer?.role === 'employee' &&

    viewer.id === target.id &&

    resolveEmployeePermissions(viewer as AppUser).finance

  );

}



function canAdminManageEmployeeMemoLedgers(

  viewer: FinanceUser | null | undefined,

  accountOwner: FinanceUser,

): boolean {

  return (

    viewer?.role === 'admin' &&

    accountOwner.role === 'employee' &&

    canManageFinanceAccount(viewer, accountOwner)

  );

}



export function canAddFinanceLedger(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  if (!viewer || !canManageFinanceAccount(viewer, target)) {

    return false;

  }

  if (canPrimaryAdminManageFinanceCard(viewer, target)) {
    return true;
  }

  if (canEmployeeManageOwnMemoLedgers(viewer, target)) {
    return true;
  }

  if (viewer.role === 'employee') {
    return canManageEmployeeFinance(viewer as AppUser) && target.role === 'employee';
  }

  return target.role === 'employee' || target.id === viewer.id;

}



export function canManageFinanceLedgers(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  if (!viewer || !canManageFinanceAccount(viewer, target)) {

    return false;

  }

  if (canPrimaryAdminManageFinanceCard(viewer, target)) {
    return true;
  }

  if (viewer.role === 'employee') {
    return canManageEmployeeFinance(viewer as AppUser) && target.role === 'employee';
  }

  return target.role === 'employee' || target.id === viewer.id;

}



export function canToggleFinanceLedgerMemoMode(
  viewer: FinanceUser | null | undefined,
  accountOwner: FinanceUser,
): boolean {
  return viewer?.role === 'admin' && canManageFinanceAccount(viewer, accountOwner);
}

export function canManageFinanceLedgerEntry(

  viewer: FinanceUser | null | undefined,

  accountOwner: FinanceUser,

  ledger: Pick<import('@app/types/models').EmployeeFinanceLedger, 'memoOnly' | 'visibleToUserIds'>,

): boolean {

  if (isMemoFinanceLedger(ledger)) {
    if (canEmployeeManageOwnMemoLedgers(viewer, accountOwner)) {
      return true;
    }
    if (canAdminManageEmployeeMemoLedgers(viewer, accountOwner)) {
      return true;
    }
    return canPrimaryAdminManageFinanceCard(viewer, accountOwner);
  }

  return canManageFinanceLedgers(viewer, accountOwner);

}



export function canClearLedgerTransactions(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  return canManageFinanceLedgers(viewer, target);

}

export function canViewFinanceLedger(

  viewer: FinanceUser | null | undefined,

  accountOwner: FinanceUser,

  ledger: Pick<import('@app/types/models').EmployeeFinanceLedger, 'id' | 'visibleToUserIds' | 'memoOnly'>,

): boolean {

  if (!viewer) {

    return false;

  }

  if (isArchivedFinanceAccount(accountOwner)) {
    return false;
  }

  if (isMemoFinanceLedger(ledger)) {
    if (viewer.id === accountOwner.id) {
      return true;
    }
    if (canAdminManageEmployeeMemoLedgers(viewer, accountOwner)) {
      return true;
    }

    const visibleTo = ledger.visibleToUserIds ?? [];
    if (visibleTo.includes(viewer.id)) {
      return true;
    }

    const accessKey = buildDelegatedFinanceLedgerAccessKey(accountOwner.id, ledger.id);
    return (viewer.delegatedFinanceLedgerAccess ?? []).includes(accessKey);
  }

  if (viewer.id === accountOwner.id) {

    return true;

  }

  if (viewer.role === 'admin' && canManageFinanceAccount(viewer, accountOwner)) {

    return true;

  }

  if (
    viewer.role === 'employee' &&
    canManageEmployeeFinance(viewer as AppUser) &&
    accountOwner.role === 'employee'
  ) {
    return true;
  }

  const visibleTo = ledger.visibleToUserIds ?? [];

  if (visibleTo.includes(viewer.id)) {

    return true;

  }

  const accessKey = buildDelegatedFinanceLedgerAccessKey(accountOwner.id, ledger.id);

  return (viewer.delegatedFinanceLedgerAccess ?? []).includes(accessKey);

}

export function filterVisibleFinanceLedgers<T extends import('@app/types/models').EmployeeFinanceLedger>(

  viewer: FinanceUser | null | undefined,

  accountOwner: FinanceUser,

  ledgers: T[],

): T[] {

  return ledgers.filter((ledger) => canViewFinanceLedger(viewer, accountOwner, ledger));

}

export function isExplicitlySharedFinanceLedger(

  viewer: FinanceUser | null | undefined,

  accountOwner: FinanceUser,

  ledger: Pick<import('@app/types/models').EmployeeFinanceLedger, 'visibleToUserIds'>,

): boolean {

  if (!viewer || viewer.id === accountOwner.id) {

    return false;

  }

  const visibleTo = ledger.visibleToUserIds ?? [];

  return visibleTo.includes(viewer.id);

}

/** Custom finance cards listed on Finance home (other owners), excluding the viewer's own cards. */
export function shouldListFinanceLedgerOnFinanceHome(
  viewer: FinanceUser | null | undefined,
  accountOwner: FinanceUser,
  ledger: Pick<import('@app/types/models').EmployeeFinanceLedger, 'id' | 'visibleToUserIds' | 'memoOnly'>,
): boolean {
  if (!viewer?.id || viewer.id === accountOwner.id) {
    return false;
  }
  if (accountOwner.role === 'employee') {
    return false;
  }
  if (isArchivedFinanceAccount(accountOwner)) {
    return false;
  }
  return canViewFinanceLedger(viewer, accountOwner, ledger);
}

export function shouldListSharedFinanceLedgerForViewer(
  viewer: FinanceUser | null | undefined,
  accountOwner: FinanceUser,
  ledger: Pick<import('@app/types/models').EmployeeFinanceLedger, 'id' | 'visibleToUserIds' | 'memoOnly'>,
  options?: {adminOwnedOnly?: boolean},
): boolean {
  if (!viewer?.id || viewer.id === accountOwner.id) {
    return false;
  }
  if (accountOwner.role === 'employee') {
    return false;
  }
  if (options?.adminOwnedOnly && accountOwner.role !== 'admin') {
    return false;
  }
  if (isArchivedFinanceAccount(accountOwner)) {
    return false;
  }

  return (
    shouldListFinanceLedgerOnFinanceHome(viewer, accountOwner, ledger) ||
    (viewer.delegatedFinanceLedgerAccess ?? []).includes(
      buildDelegatedFinanceLedgerAccessKey(accountOwner.id, ledger.id),
    )
  );
}

/** Employees viewing an admin-owned shared ledger must query by ledgerId (Firestore rules). */
export function shouldUseLedgerScopedFinanceTransactions(
  viewer: FinanceUser | null | undefined,
  accountOwner: Pick<AppUser, 'id' | 'role'> | null | undefined,
): boolean {
  return Boolean(
    viewer?.role === 'employee' &&
      accountOwner?.role === 'admin' &&
      viewer.id !== accountOwner.id,
  );
}

export function canManageFinanceLedgerTransactions(

  viewer: FinanceUser | null | undefined,

  accountOwner: FinanceUser,

  ledger: Pick<import('@app/types/models').EmployeeFinanceLedger, 'visibleToUserIds' | 'memoOnly'>,

): boolean {

  if (!viewer || !canViewFinanceLedger(viewer, accountOwner, ledger)) {

    return false;

  }

  if (viewer.id === accountOwner.id) {

    return true;

  }

  if (viewer.role === 'admin' && canManageFinanceAccount(viewer, accountOwner)) {

    return true;

  }

  if (
    viewer.role === 'employee' &&
    canManageEmployeeFinance(viewer as AppUser) &&
    accountOwner.role === 'employee'
  ) {
    return true;
  }

  return isExplicitlySharedFinanceLedger(viewer, accountOwner, ledger);

}

export function hasFullFinanceLedgerTransactionControl(

  viewer: FinanceUser | null | undefined,

  accountOwner: FinanceUser,

  ledger: Pick<import('@app/types/models').EmployeeFinanceLedger, 'visibleToUserIds'>,

): boolean {

  if (!canManageFinanceLedgerTransactions(viewer, accountOwner, ledger)) {

    return false;

  }

  if (isExplicitlySharedFinanceLedger(viewer, accountOwner, ledger)) {

    return true;

  }

  if (
    viewer?.role === 'employee' &&
    canManageEmployeeFinance(viewer as AppUser) &&
    accountOwner.role === 'employee'
  ) {
    return true;
  }

  return viewer?.role === 'admin';

}

export function canClearFinanceLedgerTransactions(

  viewer: FinanceUser | null | undefined,

  accountOwner: FinanceUser,

  ledger: Pick<import('@app/types/models').EmployeeFinanceLedger, 'visibleToUserIds' | 'memoOnly'>,

): boolean {

  if (!canManageFinanceLedgerTransactions(viewer, accountOwner, ledger)) {

    return false;

  }

  if (isMemoFinanceLedger(ledger)) {
    if (canEmployeeManageOwnMemoLedgers(viewer, accountOwner)) {
      return true;
    }
    if (canAdminManageEmployeeMemoLedgers(viewer, accountOwner)) {
      return true;
    }
    return canPrimaryAdminManageFinanceCard(viewer, accountOwner);
  }

  if (isExplicitlySharedFinanceLedger(viewer, accountOwner, ledger)) {

    return true;

  }

  if (canPrimaryAdminManageFinanceCard(viewer, accountOwner)) {
    return true;
  }

  return canManageFinanceLedgers(viewer, accountOwner);

}

