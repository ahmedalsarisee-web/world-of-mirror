import type {TFunction} from 'i18next';
import type {TransactionType} from '@app/types/models';

export function getTransactionTypeLabel(type: TransactionType, t: TFunction): string {
  switch (type) {
    case 'received':
      return t('received');
    case 'paid':
      return t('paid');
    case 'advance':
      return t('advanceDeposit');
    case 'advance_repayment':
      return t('advanceWithdraw');
    case 'ledger_debit':
      return t('paid');
    case 'ledger_credit':
      return t('received');
    case 'order_collection':
      return t('orderCollection');
    default:
      return t('received');
  }
}

export function isAdvanceTransactionType(type: TransactionType): boolean {
  return type === 'advance' || type === 'advance_repayment';
}

export function isCustomLedgerTransactionType(type: TransactionType): boolean {
  return type === 'ledger_debit' || type === 'ledger_credit';
}

export function isSubLedgerTransactionType(type: TransactionType): boolean {
  return isAdvanceTransactionType(type) || isCustomLedgerTransactionType(type);
}
