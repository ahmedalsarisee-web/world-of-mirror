import type {TFunction} from 'i18next';
import type {EmployeeFinanceCardLabels} from '@app/types/models';

export const CUSTOM_LEDGER_COLORS = ['#7C3AED', '#059669', '#D97706', '#DB2777', '#0891B2'];

export function resolveCustomLedgerColor(index: number): string {
  return CUSTOM_LEDGER_COLORS[index % CUSTOM_LEDGER_COLORS.length];
}

export function createFinanceLedgerId(): string {
  return `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildDelegatedFinanceLedgerAccessKey(ownerUserId: string, ledgerId: string): string {
  return `${ownerUserId}:${ledgerId}`;
}

export function sortFinanceLedgersByCreatedAt<T extends {createdAt?: string}>(ledgers: T[]): T[] {
  return [...ledgers].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return 0;
  });
}

export function resolveCashCardLabel(
  labels: EmployeeFinanceCardLabels | undefined,
  t: TFunction,
): string {
  const custom = labels?.cash?.trim();
  return custom || t('currentBalance');
}

export function resolveSalaryAdvanceCardLabel(
  labels: EmployeeFinanceCardLabels | undefined,
  userName: string,
  t: TFunction,
): string {
  const custom = labels?.salaryAdvance?.trim();
  if (custom) {
    return custom;
  }
  return t('salaryAdvanceAccount', {name: userName});
}

export function resolveSalaryAdvanceScreenTitle(
  labels: EmployeeFinanceCardLabels | undefined,
  t: TFunction,
): string {
  const custom = labels?.salaryAdvance?.trim();
  return custom || t('salaryAdvanceAccountTitle');
}
