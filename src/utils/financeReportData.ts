import type {AppUser, Transaction} from '@app/types/models';
import {roundMoney} from '@app/utils/format';

export interface FinanceReportSummary {
  transactionCount: number;
  accountCount: number;
  periodReceived: number;
  periodPaid: number;
  periodNet: number;
  currentTotalBalance: number;
}

export interface FinanceReportAccountRow {
  userId: string;
  name: string;
  role: AppUser['role'];
  currentBalance: number;
  periodReceived: number;
  periodPaid: number;
  periodNet: number;
  periodTransactionCount: number;
}

export interface FinanceReportData {
  summary: FinanceReportSummary;
  accounts: FinanceReportAccountRow[];
  transactions: Transaction[];
}

export function buildFinanceReportData(users: AppUser[], transactions: Transaction[]): FinanceReportData {
  const userMap = new Map(users.map((user) => [user.id, user]));
  const sortedTransactions = [...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  let periodReceived = 0;
  let periodPaid = 0;

  const accountStats = new Map<
    string,
    {periodReceived: number; periodPaid: number; periodTransactionCount: number}
  >();

  for (const transaction of sortedTransactions) {
    if (transaction.amount >= 0) {
      periodReceived += transaction.amount;
    } else {
      periodPaid += Math.abs(transaction.amount);
    }

    const stats = accountStats.get(transaction.userId) ?? {
      periodReceived: 0,
      periodPaid: 0,
      periodTransactionCount: 0,
    };
    if (transaction.amount >= 0) {
      stats.periodReceived += transaction.amount;
    } else {
      stats.periodPaid += Math.abs(transaction.amount);
    }
    stats.periodTransactionCount += 1;
    accountStats.set(transaction.userId, stats);
  }

  const accounts = users.map((user) => {
      const stats = accountStats.get(user.id);
      const received = roundMoney(stats?.periodReceived ?? 0);
      const paid = roundMoney(stats?.periodPaid ?? 0);
      return {
        userId: user.id,
        name: user.name,
        role: user.role,
        currentBalance: roundMoney(user.balance),
        periodReceived: received,
        periodPaid: paid,
        periodNet: roundMoney(received - paid),
        periodTransactionCount: stats?.periodTransactionCount ?? 0,
      };
    })
    .sort((a, b) => b.periodNet - a.periodNet || b.periodReceived - a.periodReceived);

  return {
    summary: {
      transactionCount: sortedTransactions.length,
      accountCount: users.length,
      periodReceived: roundMoney(periodReceived),
      periodPaid: roundMoney(periodPaid),
      periodNet: roundMoney(periodReceived - periodPaid),
      currentTotalBalance: roundMoney(users.reduce((sum, user) => sum + user.balance, 0)),
    },
    accounts,
    transactions: sortedTransactions,
  };
}
