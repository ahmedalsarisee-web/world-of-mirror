import React, {useEffect, useMemo, useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AddFinanceLedgerSheet from '@app/components/finance/AddFinanceLedgerSheet';
import EmployeeFinanceQuickCard from '@app/components/finance/EmployeeFinanceQuickCard';
import AccountStatementExportButton from '@app/components/finance/AccountStatementExportButton';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {useTheme} from '@app/context/ThemeContext';
import {addFinanceLedger, renameFinanceLedger, subscribeToUser, updateFinanceCardLabel} from '@app/services/users.service';
import {subscribeToUserTransactions} from '@app/services/transactions.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, Transaction} from '@app/types/models';
import {exportEmployeeAccountReport} from '@app/utils/exportFinanceReport';
import {canManageFinanceLedgers} from '@app/utils/financePermissions';
import {resolveCustomLedgerColor, resolveCashCardLabel, resolveSalaryAdvanceCardLabel, sortFinanceLedgersByCreatedAt} from '@app/utils/financeLedgers';
import {
  computeAdvanceAccountBalance,
  computeCustomLedgerBalance,
  filterAdvanceScopeTransactions,
  resolveCashAccountBalance,
} from '@app/utils/financeTotals';

type RenameTarget =
  | {kind: 'salaryAdvance'; initialName: string}
  | {kind: 'custom'; ledgerId: string; initialName: string};

interface Props {
  userId: string;
  userName: string;
  onOpenCashAccount: () => void;
  onOpenSalaryAdvance: () => void;
  onOpenCustomLedger: (ledgerId: string, ledgerName: string, ledgerColor: string) => void;
  wrapInScreenContainer?: boolean;
}

const EmployeeFinanceHubPanel: React.FC<Props> = ({
  userId,
  userName,
  onOpenCashAccount,
  onOpenSalaryAdvance,
  onOpenCustomLedger,
  wrapInScreenContainer = true,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, isRTL} = useDirection();
  const currentUser = useAuthStore((s) => s.user);
  const [exporting, setExporting] = useState(false);
  const [addLedgerVisible, setAddLedgerVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [savingLedger, setSavingLedger] = useState(false);
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);

  const isOwnAccount = currentUser?.id === userId;
  const panelTitle = isOwnAccount ? t('myAccount') : userName;
  const canManageLedgers = targetUser ? canManageFinanceLedgers(currentUser, targetUser) : false;
  const customLedgers = useMemo(
    () => sortFinanceLedgersByCreatedAt(targetUser?.financeLedgers ?? []),
    [targetUser?.financeLedgers],
  );
  const cardLabels = targetUser?.financeCardLabels;
  const cashCardLabel = resolveCashCardLabel(cardLabels, t);
  const salaryAdvanceCardLabel = resolveSalaryAdvanceCardLabel(cardLabels, userName, t);

  const viewStyles = useMemo(
    () =>
      StyleSheet.create({
        titleRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.sm,
        },
        titleText: {
          flex: 1,
          fontSize: theme.typographyScale.size.xl,
          fontWeight: '700',
        },
        cardsWrap: {
          gap: theme.spacing.md,
        },
        addBtn: {
          marginTop: theme.spacing.xs,
        },
        customCardsTitle: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
          marginTop: theme.spacing.md,
          marginBottom: theme.spacing.xs,
        },
        customCardsHint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
          marginBottom: theme.spacing.xs,
        },
      }),
    [row, theme],
  );

  const {data: transactions} = useFirestoreSubscription<Transaction[]>(
    [],
    (callback) => subscribeToUserTransactions(userId, callback),
    [userId],
    {enabled: Boolean(userId)},
  );

  useEffect(() => {
    return subscribeToUser(userId, setTargetUser);
  }, [userId]);

  const cashBalance = useMemo(
    () => resolveCashAccountBalance(targetUser?.balance ?? 0, transactions),
    [targetUser?.balance, transactions],
  );

  const salaryAdvanceBalance = useMemo(
    () => computeAdvanceAccountBalance(transactions),
    [transactions],
  );

  const advanceTransactions = useMemo(
    () => filterAdvanceScopeTransactions(transactions),
    [transactions],
  );

  const customLedgerBalances = useMemo(
    () =>
      customLedgers.map((ledger) => ({
        ledger,
        balance: computeCustomLedgerBalance(transactions, ledger.id),
      })),
    [customLedgers, transactions],
  );

  const handleExport = async () => {
    if (!targetUser) return;
    setExporting(true);
    try {
      await exportEmployeeAccountReport(targetUser, transactions, t, {
        isRtl: isRTL,
        appName: t('appName'),
      });
    } catch (error) {
      console.error('[EmployeeFinanceHubPanel] export failed', error);
      Alert.alert(t('error'), t('exportFinanceFailed'));
    } finally {
      setExporting(false);
    }
  };

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

  const handleRenameCard = async (name: string) => {
    if (!renameTarget) return;
    setSavingLedger(true);
    try {
      if (renameTarget.kind === 'custom') {
        await renameFinanceLedger(userId, renameTarget.ledgerId, name);
      } else {
        await updateFinanceCardLabel(userId, renameTarget.kind, name);
      }
      setRenameTarget(null);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingLedger(false);
    }
  };

  const openRename = (target: RenameTarget) => {
    setRenameTarget(target);
  };

  const content = (
    <>
      <View style={viewStyles.titleRow}>
        <Text style={[viewStyles.titleText, textStyle, {color: theme.typography.primary}]}>{panelTitle}</Text>
        <AccountStatementExportButton onPress={handleExport} loading={exporting} disabled={!targetUser} />
      </View>
      <View style={viewStyles.cardsWrap}>
        <EmployeeFinanceQuickCard
          icon="wallet-outline"
          iconColor={theme.colors.primary}
          iconBackground={theme.colors.primaryLight}
          label={cashCardLabel}
          amount={cashBalance}
          currencyLabel={t('currencyLabel')}
          actionLabel={t('viewTransactions')}
          actionBackground={theme.colors.surfaceSecondary}
          actionTextColor={theme.colors.primary}
          onPress={onOpenCashAccount}
        />
        {advanceTransactions.length > 0 ? (
          <EmployeeFinanceQuickCard
            icon="hand-coin-outline"
            iconColor="#2563EB"
            iconBackground="#2563EB18"
            label={salaryAdvanceCardLabel}
            amount={salaryAdvanceBalance}
            currencyLabel={t('currencyLabel')}
            amountTone="negative"
            actionLabel={t('viewTransactions')}
            actionBackground="#2563EB18"
            actionTextColor="#2563EB"
            onPress={onOpenSalaryAdvance}
            onRename={
              canManageLedgers
                ? () => openRename({kind: 'salaryAdvance', initialName: salaryAdvanceCardLabel})
                : undefined
            }
          />
        ) : null}
        {canManageLedgers ? (
          <Text style={[viewStyles.customCardsTitle, textStyle, {color: theme.typography.primary}]}>
            {t('customFinanceCards')}
          </Text>
        ) : null}
        {canManageLedgers && customLedgers.length === 0 ? (
          <Text style={[viewStyles.customCardsHint, textStyle, {color: theme.typography.secondary}]}>
            {t('addFinanceLedgerHint')}
          </Text>
        ) : null}
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
              onRename={
                canManageLedgers
                  ? () =>
                      openRename({kind: 'custom', ledgerId: ledger.id, initialName: ledger.name})
                  : undefined
              }
            />
          );
        })}
      </View>
      {canManageLedgers ? (
        <AppButton
          label={t('addFinanceLedger')}
          variant="outline"
          onPress={() => setAddLedgerVisible(true)}
          style={viewStyles.addBtn}
        />
      ) : null}
      <AddFinanceLedgerSheet
        visible={addLedgerVisible}
        mode="add"
        saving={savingLedger}
        onClose={() => setAddLedgerVisible(false)}
        onSave={handleAddLedger}
      />
      <AddFinanceLedgerSheet
        visible={renameTarget !== null}
        mode="rename"
        initialName={renameTarget?.initialName ?? ''}
        saving={savingLedger}
        onClose={() => setRenameTarget(null)}
        onSave={handleRenameCard}
      />
      <LoadingOverlay visible={exporting || savingLedger} />
    </>
  );

  if (wrapInScreenContainer) {
    return <ScreenContainer>{content}</ScreenContainer>;
  }

  return content;
};

export default EmployeeFinanceHubPanel;
