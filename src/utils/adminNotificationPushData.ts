import type {AdminNotificationMetadata, FinanceNotificationMetadata} from '@app/types/adminNotificationMetadata';
import {normalizeTransactionType} from '@app/utils/financeTotals';

export function parseFinanceNotificationMetadataFromPushData(
  data: Record<string, unknown>,
): FinanceNotificationMetadata | undefined {
  const metadataJson = data.metadataJson;
  if (typeof metadataJson === 'string' && metadataJson.trim()) {
    try {
      const parsed = JSON.parse(metadataJson) as FinanceNotificationMetadata;
      if (parsed?.transactionId) {
        return parsed;
      }
    } catch {
      // Fall through to field-by-field parsing.
    }
  }

  const transactionId = String(data.transactionId ?? '');
  if (!transactionId) {
    return undefined;
  }

  const createdAt = String(data.createdAt ?? '');
  const actorName = String(data.actorName ?? '');
  const accountName = String(data.accountName ?? '');
  const typeLabel = String(data.typeLabel ?? '');
  const amountLabel = String(data.amountLabel ?? '');
  const note = String(data.note ?? '');
  const description = String(data.description ?? (note || typeLabel));
  const transactionType = normalizeTransactionType(String(data.transactionType ?? 'received'));
  const amount = Number(data.amount ?? 0);

  if (!actorName || !accountName) {
    return undefined;
  }

  return {
    transactionId,
    accountUserId: String(data.userId ?? ''),
    accountName,
    actorUserId: data.actorUserId ? String(data.actorUserId) : undefined,
    actorName,
    transactionType,
    typeLabel,
    amount,
    amountLabel,
    note,
    description,
    ledgerId: data.ledgerId ? String(data.ledgerId) : undefined,
    ledgerName: data.ledgerName ? String(data.ledgerName) : undefined,
    createdAt: createdAt || new Date().toISOString(),
  };
}

export function buildFinanceMetadataFromPushData(
  data: Record<string, unknown>,
): AdminNotificationMetadata | undefined {
  const finance = parseFinanceNotificationMetadataFromPushData(data);
  return finance ? {finance} : undefined;
}

export function parseNotificationEventAtFromPushData(data: Record<string, unknown>): number | undefined {
  const raw = data.eventAt;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
    const createdAtMs = Date.parse(raw);
    if (Number.isFinite(createdAtMs)) {
      return createdAtMs;
    }
  }
  const createdAt = data.createdAt;
  if (typeof createdAt === 'string' && createdAt.trim()) {
    const createdAtMs = Date.parse(createdAt);
    if (Number.isFinite(createdAtMs)) {
      return createdAtMs;
    }
  }
  return undefined;
}
