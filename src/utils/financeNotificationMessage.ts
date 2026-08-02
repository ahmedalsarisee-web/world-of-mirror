import type {TFunction} from 'i18next';
import type {AppUser, Transaction} from '@app/types/models';
import type {FinanceNotificationMetadata} from '@app/types/adminNotificationMetadata';
import {formatCurrency} from '@app/utils/format';
import {getTransactionTypeLabel} from '@app/utils/transactionLabels';

export interface FinanceNotificationContent {
  title: string;
  body: string;
  userId: string;
  transactionId: string;
  eventAt: number;
  metadata: FinanceNotificationMetadata;
}

export function resolveFinanceTransactionActorName(
  transaction: Transaction,
  users: Pick<AppUser, 'id' | 'name'>[],
  accountName: string,
  t: TFunction,
): string {
  if (transaction.createdByUserId) {
    const actor = users.find((user) => user.id === transaction.createdByUserId);
    if (actor?.name) {
      return actor.name;
    }
  }

  if (transaction.userId) {
    const accountUser = users.find((user) => user.id === transaction.userId);
    if (accountUser?.name) {
      return accountUser.name;
    }
  }

  return accountName || t('unknownUser');
}

export function resolveFinanceTransactionLedgerName(
  transaction: Transaction,
  users: Pick<AppUser, 'id' | 'financeLedgers'>[],
): string | undefined {
  if (!transaction.ledgerId) {
    return undefined;
  }

  const owner = users.find((user) => user.id === transaction.userId);
  return owner?.financeLedgers?.find((ledger) => ledger.id === transaction.ledgerId)?.name;
}

export function buildFinanceNotificationContent(
  transaction: Transaction,
  accountName: string,
  actorName: string,
  t: TFunction,
  ledgerName?: string,
): FinanceNotificationContent {
  const typeLabel = getTransactionTypeLabel(transaction.type, t);
  const amountLabel = formatCurrency(transaction.amount, t('currencyLabel'));
  const note = transaction.note.trim();
  const description = note || typeLabel;
  const body = note
    ? t('financeNotificationBodyWithNote', {actorName, accountName, typeLabel, amountLabel, note})
    : t('financeNotificationBody', {actorName, accountName, typeLabel, amountLabel});

  const createdAtMs = Date.parse(transaction.createdAt);
  const eventAt = Number.isFinite(createdAtMs) ? createdAtMs : Date.now();

  return {
    title: t('financeNotificationTitle'),
    body,
    userId: transaction.userId,
    transactionId: transaction.id,
    eventAt,
    metadata: {
      transactionId: transaction.id,
      accountUserId: transaction.userId,
      accountName,
      ...(transaction.createdByUserId ? {actorUserId: transaction.createdByUserId} : {}),
      actorName,
      transactionType: transaction.type,
      typeLabel,
      amount: transaction.amount,
      amountLabel,
      note,
      description,
      ...(transaction.ledgerId ? {ledgerId: transaction.ledgerId} : {}),
      ...(ledgerName ? {ledgerName} : {}),
      createdAt: transaction.createdAt,
    },
  };
}

export function buildFinanceTransactionUpdatedContent(
  transaction: Transaction,
  accountName: string,
  actorName: string,
  t: TFunction,
  ledgerName?: string,
): FinanceNotificationContent {
  const base = buildFinanceNotificationContent(transaction, accountName, actorName, t, ledgerName);
  const updatedAt = transaction.updatedAt ?? new Date().toISOString();
  const updatedAtMs = Date.parse(updatedAt);
  const eventAt = Number.isFinite(updatedAtMs) ? updatedAtMs : Date.now();

  return {
    ...base,
    title: t('financeNotificationUpdatedTitle'),
    body: t('financeNotificationUpdatedBody', {
      actorName,
      accountName,
      typeLabel: base.metadata.typeLabel,
      amountLabel: base.metadata.amountLabel,
      note: base.metadata.note || base.metadata.typeLabel,
    }),
    eventAt,
    metadata: {
      ...base.metadata,
      updatedAt,
    },
  };
}

export function buildFinanceTransactionDeletedContent(
  transaction: Transaction,
  accountName: string,
  actorName: string,
  t: TFunction,
  ledgerName?: string,
): FinanceNotificationContent {
  const base = buildFinanceNotificationContent(transaction, accountName, actorName, t, ledgerName);
  const deletedAt = new Date().toISOString();

  return {
    ...base,
    title: t('financeNotificationDeletedTitle'),
    body: t('financeNotificationDeletedBody', {
      actorName,
      accountName,
      typeLabel: base.metadata.typeLabel,
      amountLabel: base.metadata.amountLabel,
    }),
    eventAt: Date.now(),
    metadata: {
      ...base.metadata,
      deletedAt,
    },
  };
}
