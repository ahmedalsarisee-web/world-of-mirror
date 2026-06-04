import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import FinanceCustomLedgersList, {
  type FinanceCustomLedgerListItem,
} from '@app/components/finance/FinanceCustomLedgersList';
import FinanceSectionHeader from '@app/components/finance/FinanceSectionHeader';
import {useTheme} from '@app/context/ThemeContext';
import type {AppUser, Transaction} from '@app/types/models';
import {
  canManageFinanceLedgerTransactions,
  shouldListFinanceLedgerOnFinanceHome,
} from '@app/utils/financePermissions';
import {resolveCustomLedgerColor, sortFinanceLedgersByCreatedAt} from '@app/utils/financeLedgers';
import {computeCustomLedgerBalance, getCustomLedgerStats} from '@app/utils/financeTotals';

export interface SharedFinanceLedgerItem {
  owner: AppUser;
  ledgerId: string;
  ledgerName: string;
  ledgerColor: string;
  visibleToUserIds: string[];
  balance: number;
  transactionCount: number;
  lastTransactionAt: string | null;
}

interface Props {
  users: AppUser[];
  transactions: Transaction[];
  currentUser: AppUser | null | undefined;
  adminOwnedOnly?: boolean;
  onOpenCustomLedger: (
    ownerUserId: string,
    ownerUserName: string,
    ledgerId: string,
    ledgerName: string,
    ledgerColor: string,
  ) => void;
}

export function buildSharedFinanceLedgerItems(
  users: AppUser[],
  transactions: Transaction[],
  currentUser: AppUser | null | undefined,
  options?: {adminOwnedOnly?: boolean},
): SharedFinanceLedgerItem[] {
  if (!currentUser?.id) {
    return [];
  }

  const items: SharedFinanceLedgerItem[] = [];

  for (const owner of users) {
    if (owner.id === currentUser.id) {
      continue;
    }

    if (options?.adminOwnedOnly && owner.role !== 'admin') {
      continue;
    }

    const ledgers = sortFinanceLedgersByCreatedAt(owner.financeLedgers ?? []);
    const ownerTransactions = transactions.filter((tx) => tx.userId === owner.id);

    ledgers.forEach((ledger, index) => {
      if (!shouldListFinanceLedgerOnFinanceHome(currentUser, owner, ledger)) {
        return;
      }

      const stats = getCustomLedgerStats(ownerTransactions, ledger.id);

      items.push({
        owner,
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        ledgerColor: resolveCustomLedgerColor(index),
        visibleToUserIds: ledger.visibleToUserIds ?? [],
        balance: computeCustomLedgerBalance(ownerTransactions, ledger.id),
        transactionCount: stats.transactionCount,
        lastTransactionAt: stats.lastTransactionAt,
      });
    });
  }

  return items;
}

const SharedFinanceLedgersSection: React.FC<Props> = ({
  users,
  transactions,
  currentUser,
  adminOwnedOnly = false,
  onOpenCustomLedger,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();

  const items = useMemo(
    () => buildSharedFinanceLedgerItems(users, transactions, currentUser, {adminOwnedOnly}),
    [adminOwnedOnly, currentUser, transactions, users],
  );

  const ledgerListItems = useMemo<FinanceCustomLedgerListItem[]>(
    () =>
      items.map((item) => ({
        id: `${item.owner.id}-${item.ledgerId}`,
        name: item.ledgerName,
        balance: item.balance,
        transactionCount: item.transactionCount,
        lastTransactionAt: item.lastTransactionAt,
        accentColor: item.ledgerColor,
        ownerName: item.owner.name,
        ownerRole: item.owner.role,
        viewOnly: !canManageFinanceLedgerTransactions(currentUser, item.owner, {
          visibleToUserIds: item.visibleToUserIds,
        }),
      })),
    [currentUser, items],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginTop: 0,
        },
      }),
    [theme],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <FinanceSectionHeader title={t('sharedFinanceCards')} />
      <FinanceCustomLedgersList
        items={ledgerListItems}
        currencyLabel={t('currencyLabel')}
        onSelect={(selected) => {
          const item = items.find(
            (entry) => `${entry.owner.id}-${entry.ledgerId}` === selected.id,
          );
          if (!item) {
            return;
          }
          onOpenCustomLedger(
            item.owner.id,
            item.owner.name,
            item.ledgerId,
            item.ledgerName,
            item.ledgerColor,
          );
        }}
      />
    </View>
  );
};

export default SharedFinanceLedgersSection;
