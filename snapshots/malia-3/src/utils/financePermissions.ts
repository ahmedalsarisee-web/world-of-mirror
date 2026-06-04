import type {AppUser, Transaction, UserRole} from '@app/types/models';

import {isPrimaryAdmin} from '@app/utils/adminPermissions';

import {isWithinEmployeeTransactionEditWindow} from '@app/utils/financeTransactionWindow';



type FinanceUser = Pick<AppUser, 'id' | 'role' | 'isPrimaryAdmin' | 'email'>;



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

    return isEmployeePinnedTransaction(transaction);

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

    return true;

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

  transaction: ModifiableTransaction,

  now = Date.now(),

): boolean {

  if (!viewer || !canViewFinanceAccount(viewer, target)) {

    return false;

  }

  if (canAdminModifyTransaction(viewer, target, transaction)) {

    return true;

  }

  return canEmployeeModifyOwnTransaction(viewer, target, transaction, now);

}



export function canDeleteFinanceTransaction(

  viewer: FinanceUser | null | undefined,

  target: FinanceUser,

  transaction: ModifiableTransaction,

  now = Date.now(),

): boolean {

  return canEditFinanceTransaction(viewer, target, transaction, now);

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


