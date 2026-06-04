import type {TFunction} from 'i18next';
import type {Transaction} from '@app/types/models';
import {formatCurrency} from '@app/utils/format';
import {getTransactionTypeLabel} from '@app/utils/transactionLabels';

export interface FinanceNotificationContent {
  title: string;
  body: string;
  userId: string;
  transactionId: string;
}

export function buildFinanceNotificationContent(
  transaction: Transaction,
  accountName: string,
  t: TFunction,
): FinanceNotificationContent {
  const typeLabel = getTransactionTypeLabel(transaction.type, t);
  const amountLabel = formatCurrency(transaction.amount, t('currencyLabel'));
  const note = transaction.note.trim();
  const body = note
    ? t('financeNotificationBodyWithNote', {accountName, typeLabel, amountLabel, note})
    : t('financeNotificationBody', {accountName, typeLabel, amountLabel});

  return {
    title: t('financeNotificationTitle'),
    body,
    userId: transaction.userId,
    transactionId: transaction.id,
  };
}
