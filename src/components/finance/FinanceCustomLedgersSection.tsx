import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import AddFinanceLedgerSheet from '@app/components/finance/AddFinanceLedgerSheet';
import FinanceCustomLedgersList, {
  type FinanceCustomLedgerListItem,
} from '@app/components/finance/FinanceCustomLedgersList';
import FinanceSectionHeader from '@app/components/finance/FinanceSectionHeader';
import {useDirection} from '@app/hooks/useDirection';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {useTheme} from '@app/context/ThemeContext';
import {addFinanceLedger, getFinanceAccounts, renameFinanceLedger, subscribeToUser, subscribeToUsers} from '@app/services/users.service';
import {subscribeToUserTransactions} from '@app/services/transactions.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, Transaction} from '@app/types/models';
import {canAccessModule} from '@app/utils/employeePermissions';
import {canManageFinanceLedgers, filterVisibleFinanceLedgers} from '@app/utils/financePermissions';
import {resolveCustomLedgerColor, sortFinanceLedgersByCreatedAt} from '@app/utils/financeLedgers';
import {computeCustomLedgerBalance, getCustomLedgerStats} from '@app/utils/financeTotals';

interface Props {
  userId: string;
  onOpenCustomLedger: (ledgerId: string, ledgerName: string, ledgerColor: string) => void;
}

const FinanceCustomLedgersSection: React.FC<Props> = ({userId, onOpenCustomLedger}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const currentUser = useAuthStore((s) => s.user);
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const [addLedgerVisible, setAddLedgerVisible] = useState(false);
  const [renameLedgerId, setRenameLedgerId] = useState<string | null>(null);
  const [renameInitialName, setRenameInitialName] = useState('');
  const [savingLedger, setSavingLedger] = useState(false);
  const {data: allUsers} = useFirestoreSubscription<AppUser[]>([], subscribeToUsers);

  const canManageLedgers = targetUser ? canManageFinanceLedgers(currentUser, targetUser) : false;
  const customLedgers = useMemo(() => {
    if (!targetUser) {
      return [];
    }
    return sortFinanceLedgersByCreatedAt(
      filterVisibleFinanceLedgers(currentUser, targetUser, targetUser.financeLedgers ?? []),
    );
  }, [currentUser, targetUser]);

  const visibilityUsers = useMemo(
    () =>
      getFinanceAccounts(allUsers).filter(
        (user) => user.id !== userId && canAccessModule(user, 'finance'),
      ),
    [allUsers, userId],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginTop: 0,
        },
        hint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
          marginBottom: theme.spacing.xs,
        },
        addBtn: {
          marginTop: theme.spacing.xs,
        },
      }),
    [theme],
  );

  const {data: transactions} = useFirestoreSubscription<Transaction[]>(
    [],
    (callback) => subscribeToUserTransactions(userId, callback),
    [userId],
    {enabled: Boolean(userId)},
  );

  useEffect(() => {
    if (!userId) return;
    return subscribeToUser(userId, setTargetUser);
  }, [userId]);

  const openRename = useCallback((ledgerId: string, initialName: string) => {
    setRenameInitialName(initialName);
    setRenameLedgerId(ledgerId);
  }, []);

  const ledgerListItems = useMemo<FinanceCustomLedgerListItem[]>(
    () =>
      customLedgers.map((ledger, index) => {
        const color = resolveCustomLedgerColor(index);
        const stats = getCustomLedgerStats(transactions, ledger.id);
        return {
          id: ledger.id,
          name: ledger.name,
          balance: computeCustomLedgerBalance(transactions, ledger.id),
          transactionCount: stats.transactionCount,
          lastTransactionAt: stats.lastTransactionAt,
          accentColor: color,
          onRename: canManageLedgers ? () => openRename(ledger.id, ledger.name) : undefined,
        };
      }),
    [canManageLedgers, customLedgers, openRename, transactions],
  );

  const handleAddLedger = async (name: string, visibleToUserIds?: string[]) => {
    if (!currentUser) return;
    setSavingLedger(true);
    try {
      await addFinanceLedger(userId, name, currentUser.id, visibleToUserIds ?? []);
      setAddLedgerVisible(false);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingLedger(false);
    }
  };

  const handleRenameLedger = async (name: string) => {
    if (!renameLedgerId) return;
    setSavingLedger(true);
    try {
      await renameFinanceLedger(userId, renameLedgerId, name);
      setRenameLedgerId(null);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingLedger(false);
    }
  };

  if (!canManageLedgers && customLedgers.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <FinanceSectionHeader title={t('customFinanceCards')} />
      {canManageLedgers && customLedgers.length === 0 ? (
        <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
          {t('addFinanceLedgerHint')}
        </Text>
      ) : null}
      <FinanceCustomLedgersList
        items={ledgerListItems}
        currencyLabel={t('currencyLabel')}
        onSelect={(item) => {
          const index = customLedgers.findIndex((ledger) => ledger.id === item.id);
          const color = resolveCustomLedgerColor(index >= 0 ? index : 0);
          onOpenCustomLedger(item.id, item.name, color);
        }}
      />
      {canManageLedgers ? (
        <AppButton
          label={t('addFinanceLedger')}
          variant="outline"
          onPress={() => setAddLedgerVisible(true)}
          style={styles.addBtn}
        />
      ) : null}
      <AddFinanceLedgerSheet
        visible={addLedgerVisible}
        mode="add"
        saving={savingLedger}
        visibilityUsers={visibilityUsers}
        onClose={() => setAddLedgerVisible(false)}
        onSave={handleAddLedger}
      />
      <AddFinanceLedgerSheet
        visible={renameLedgerId !== null}
        mode="rename"
        initialName={renameInitialName}
        saving={savingLedger}
        onClose={() => setRenameLedgerId(null)}
        onSave={handleRenameLedger}
      />
      <LoadingOverlay visible={savingLedger} />
    </View>
  );
};

export default FinanceCustomLedgersSection;
