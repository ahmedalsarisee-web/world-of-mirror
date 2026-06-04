import React, {useEffect, useMemo, useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import AddFinanceLedgerSheet from '@app/components/finance/AddFinanceLedgerSheet';
import EmployeeFinanceQuickCard from '@app/components/finance/EmployeeFinanceQuickCard';
import {useDirection} from '@app/hooks/useDirection';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {useTheme} from '@app/context/ThemeContext';
import {addFinanceLedger, renameFinanceLedger, subscribeToUser} from '@app/services/users.service';
import {subscribeToUserTransactions} from '@app/services/transactions.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, Transaction} from '@app/types/models';
import {canManageFinanceLedgers} from '@app/utils/financePermissions';
import {resolveCustomLedgerColor, sortFinanceLedgersByCreatedAt} from '@app/utils/financeLedgers';
import {computeCustomLedgerBalance} from '@app/utils/financeTotals';

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

  const canManageLedgers = targetUser ? canManageFinanceLedgers(currentUser, targetUser) : false;
  const customLedgers = useMemo(
    () => sortFinanceLedgersByCreatedAt(targetUser?.financeLedgers ?? []),
    [targetUser?.financeLedgers],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginTop: theme.spacing.xl,
        },
        sectionTitle: {
          fontSize: theme.typographyScale.size.lg,
          fontWeight: '600',
          marginBottom: theme.spacing.md,
        },
        hint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
          marginBottom: theme.spacing.sm,
        },
        cardsWrap: {
          gap: theme.spacing.md,
        },
        addBtn: {
          marginTop: theme.spacing.sm,
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

  const customLedgerBalances = useMemo(
    () =>
      customLedgers.map((ledger) => ({
        ledger,
        balance: computeCustomLedgerBalance(transactions, ledger.id),
      })),
    [customLedgers, transactions],
  );

  const handleAddLedger = async (name: string) => {
    if (!currentUser) return;
    setSavingLedger(true);
    try {
      await addFinanceLedger(userId, name, currentUser.id);
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

  const openRename = (ledgerId: string, initialName: string) => {
    setRenameInitialName(initialName);
    setRenameLedgerId(ledgerId);
  };

  if (!canManageLedgers) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
        {t('customFinanceCards')}
      </Text>
      {customLedgers.length === 0 ? (
        <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
          {t('addFinanceLedgerHint')}
        </Text>
      ) : null}
      <View style={styles.cardsWrap}>
        {customLedgerBalances.map(({ledger, balance}, index) => {
          const color = resolveCustomLedgerColor(index);
          return (
            <EmployeeFinanceQuickCard
              key={ledger.id}
              icon="book-account-outline"
              iconColor={color}
              iconBackground={`${color}22`}
              label={ledger.name}
              amount={balance}
              currencyLabel={t('currencyLabel')}
              actionLabel={t('viewTransactions')}
              actionBackground={`${color}22`}
              actionTextColor={color}
              onPress={() => onOpenCustomLedger(ledger.id, ledger.name, color)}
              onRename={() => openRename(ledger.id, ledger.name)}
            />
          );
        })}
      </View>
      <AppButton
        label={t('addFinanceLedger')}
        variant="outline"
        onPress={() => setAddLedgerVisible(true)}
        style={styles.addBtn}
      />
      <AddFinanceLedgerSheet
        visible={addLedgerVisible}
        mode="add"
        saving={savingLedger}
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
