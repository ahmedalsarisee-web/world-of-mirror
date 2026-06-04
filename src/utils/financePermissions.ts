import type {AppUser, Transaction, UserRole} from '@app/types/models';

import {canViewAllFinanceCards, isPrimaryAdmin} from '@app/utils/adminPermissions';
import {buildDelegatedFinanceLedgerAccessKey} from '@app/utils/financeLedgers';

import {isWithinEmployeeTransactionEditWindow} from '@app/utils/financeTransactionWindow';



type FinanceUser = Pick<
  AppUser,
  'id' | 'role' | 'isPrimaryAdmin' | 'email' | 'delegatedFinanceLedgerAccess' | 'adminPermissions'
>;



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



export function canViewFinanceAccount(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  if (!viewer) {

    return false;

  }

  if (viewer.role === 'admin') {

    return canViewAllFinanceCards(viewer) || viewer.id === target.id;

  }

  return viewer.id === target.id;

}



export function canManageFinanceAccount(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  if (!viewer || !canViewFinanceAccount(viewer, target)) {

    return false;

  }

  if (viewer.role === 'employee') {

    return viewer.id === target.id;

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

  return viewer?.role === 'admin' && canManageFinanceAccount(viewer, target);

}



export function canClearCashScopeTransactions(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  return viewer?.role === 'admin' && canManageFinanceAccount(viewer, target);

}



export function canManageFinanceLedgers(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

): boolean {

  if (!viewer || viewer.role !== 'admin' || !canManageFinanceAccount(viewer, target)) {

    return false;

  }

  return target.role === 'employee' || target.id === viewer.id;

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

  ledger: Pick<import('@app/types/models').EmployeeFinanceLedger, 'id' | 'visibleToUserIds'>,

): boolean {

  if (!viewer) {

    return false;

  }

  if (viewer.id === accountOwner.id) {

    return true;

  }

  if (viewer.role === 'admin' && canManageFinanceAccount(viewer, accountOwner)) {

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
  ledger: Pick<import('@app/types/models').EmployeeFinanceLedger, 'id' | 'visibleToUserIds'>,
): boolean {
  if (!viewer?.id || viewer.id === accountOwner.id) {
    return false;
  }
  return canViewFinanceLedger(viewer, accountOwner, ledger);
}

export function canManageFinanceLedgerTransactions(

  viewer: FinanceUser | null | undefined,

  accountOwner: FinanceUser,

  ledger: Pick<import('@app/types/models').EmployeeFinanceLedger, 'visibleToUserIds'>,

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

  return viewer?.role === 'admin';

}

export function canClearFinanceLedgerTransactions(

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

  return canManageFinanceLedgers(viewer, accountOwner);

}


