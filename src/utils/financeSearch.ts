import dayjs from 'dayjs';
import type {Transaction} from '@app/types/models';

function normalizeAmountQuery(query: string): string {
  return query.replace(/[,٬]/g, '').replace(/[^\d.-]/g, '').trim();
}

function getTransactionDateTokens(iso: string): string[] {
  const date = dayjs(iso);
  if (!date.isValid()) {
    return [];
  }

  return [
    date.format('YYYY-MM-DD'),
    date.format('DD/MM/YYYY'),
    date.format('DD-MM-YYYY'),
    date.format('DD MM YYYY'),
    date.format('DD MMM YYYY'),
    date.format('MMMM YYYY'),
    date.format('MMM YYYY'),
    date.format('YYYY'),
    date.format('MM'),
    date.format('DD'),
    date.format('HH:mm'),
    date.format('hh:mm A'),
  ].map((value) => value.toLowerCase());
}

function getTransactionAmountTokens(amount: number): string[] {
  const absolute = Math.abs(amount);
  const fixed = absolute.toFixed(2);
  const signedFixed = amount.toFixed(2);

  return [
    String(amount),
    String(absolute),
    fixed,
    signedFixed,
    fixed.replace('.', ','),
    absolute.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
  ].map((value) => value.toLowerCase());
}

export function searchTransactions(transactions: Transaction[], searchQuery: string): Transaction[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return transactions;
  }

  const amountQuery = normalizeAmountQuery(query);

  return transactions.filter((transaction) => {
    const note = (transaction.note ?? '').toLowerCase();
    if (note.includes(query)) {
      return true;
    }

    if (getTransactionDateTokens(transaction.createdAt).some((token) => token.includes(query))) {
      return true;
    }

    const amountTokens = getTransactionAmountTokens(transaction.amount);
    if (amountQuery && amountTokens.some((token) => token.includes(amountQuery))) {
      return true;
    }

    return amountTokens.some((token) => token.includes(query));
  });
}
