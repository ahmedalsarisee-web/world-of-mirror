import type {Transaction} from '@app/types/models';

export function indexTransactionsByUserId(transactions: Transaction[]): Map<string, Transaction[]> {
  const byUserId = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const bucket = byUserId.get(transaction.userId);
    if (bucket) {
      bucket.push(transaction);
    } else {
      byUserId.set(transaction.userId, [transaction]);
    }
  }
  return byUserId;
}

export function getLatestTransactionAt(transactions: Transaction[]): string | null {
  if (transactions.length === 0) {
    return null;
  }
  let latest = transactions[0].createdAt;
  for (let index = 1; index < transactions.length; index += 1) {
    const createdAt = transactions[index].createdAt;
    if (createdAt.localeCompare(latest) > 0) {
      latest = createdAt;
    }
  }
  return latest;
}
