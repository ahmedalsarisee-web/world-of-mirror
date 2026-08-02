import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Text} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import AddFinanceLedgerSheet from '@app/components/finance/AddFinanceLedgerSheet';
import FinanceAccountsList, {type FinanceAccountListItem} from '@app/components/finance/FinanceAccountsList';
import FinanceCardScreen from '@app/components/finance/FinanceCardScreen';
import FinanceCustomLedgersSection from '@app/components/finance/FinanceCustomLedgersSection';
import FinanceSectionHeader from '@app/components/finance/FinanceSectionHeader';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {
  FinanceCardOptionsSheet,
  type FinanceCardMenuItem,
} from '@app/components/finance/FinanceCardOverflowMenu';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import {useDirection} from '@app/hooks/useDirection';
import {useFinanceCardHeaderMenu} from '@app/hooks/useFinanceCardHeaderMenu';
import {useOptimisticFinanceTransactions} from '@app/hooks/useOptimisticFinanceTransactions';
import {useTheme} from '@app/context/ThemeContext';
import {
  createTransaction,
  deleteCashScopeTransactionsForUser,
  subscribeToUserTransactions,
} from '@app/services/transactions.service';
import {
  clearFinanceCardLabel,
  setUserBalance,
  subscribeToUser,
  updateFinanceCardLabel,
} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, Transaction} from '@app/types/models';
import type {FinanceStackParamList} from '@app/types/navigation';
import {filterCashScopeTransactions, normalizeTransactionAmount, resolveAccountBalance} from '@app/utils/financeTotals';
import {
  canClearCashScopeTransactions,
  canManageFinanceAccount,
  canManageFinanceLedgers,
  canPersistStoredBalance,
  canViewFinanceAccount,
} from '@app/utils/financePermissions';
import {exportEmployeeAccountReport} from '@app/utils/exportFinanceReport';
import {resolveCashCardLabel} from '@app/utils/financeLedgers';
import type {TransactionFormValues} from '@app/utils/validation';

type Route = RouteProp<FinanceStackParamList, 'EmployeeAccount'>;
type Nav = NativeStackNavigationProp<FinanceStackParamList, 'EmployeeAccount'>;

const EmployeeAccountScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, isRTL} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId, userName, card, focusTransactionId, focusToken} = route.params;
  const currentUser = useAuthStore((s) => s.user);
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const [remoteTransactions, setRemoteTransactions] = useState<Transaction[]>([]);
  const {transactions, appendPending, removePending} = useOptimisticFinanceTransactions(remoteTransactions);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [cardMenuVisible, setCardMenuVisible] = useState(false);

  const canAccess = targetUser ? canViewFinanceAccount(currentUser, targetUser) : false;
  const canManage = targetUser ? canManageFinanceAccount(currentUser, targetUser) : false;
  const canClearAll = targetUser ? canClearCashScopeTransactions(currentUser, targetUser) : false;
  const canManageCard = targetUser ? canManageFinanceLedgers(currentUser, targetUser) : false;
  const isAdminViewingEmployee =
    currentUser?.role === 'admin' &&
    targetUser?.role === 'employee' &&
    currentUser.id !== userId;
  const isHubView = isAdminViewingEmployee && card !== 'cash';
  const balanceLabel = resolveCashCardLabel(targetUser?.financeCardLabels, t);

  useEffect(() => {
    const unsubUser = subscribeToUser(userId, setTargetUser);
    return unsubUser;
  }, [userId]);

  useEffect(() => {
    if (!canAccess) {
      return;
    }
    const unsubTx = subscribeToUserTransactions(userId, setRemoteTransactions);
    return unsubTx;
  }, [userId, canAccess]);

  const cashTransactions = useMemo(
    () => filterCashScopeTransactions(transactions),
    [transactions],
  );

  const balance = useMemo(
    () => resolveAccountBalance(targetUser?.balance ?? 0, cashTransactions),
    [cashTransactions, targetUser?.balance],
  );

  useEffect(() => {
    if (!targetUser || !currentUser || cashTransactions.length === 0) {
      return;
    }

    if (!canPersistStoredBalance(currentUser, targetUser)) {
      return;
    }

    const storedBalance = targetUser.balance ?? 0;
    if (Math.abs(balance - storedBalance) < 0.005) {
      return;
    }

    const timeout = setTimeout(() => {
      void setUserBalance(userId, balance, currentUser);
    }, 2500);

    return () => clearTimeout(timeout);
  }, [balance, cashTransactions.length, currentUser, targetUser, userId]);

  const handleClearAllCashTransactions = useCallback(() => {
    if (!targetUser || !canClearAll || cashTransactions.length === 0) {
      return;
    }

    Alert.alert(t('clearLedgerTransactions'), t('clearLedgerTransactionsConfirm', {name: balanceLabel}), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          try {
            await deleteCashScopeTransactionsForUser(userId, transactions, {balanceSyncViewer: currentUser});
          } catch {
            Alert.alert(t('error'), t('saveFailed'));
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  }, [balanceLabel, canClearAll, cashTransactions.length, t, targetUser, transactions, userId]);

  const handleDeleteCashCard = useCallback(() => {
    Alert.alert(t('deleteFinanceLedger'), t('deleteFinanceLedgerConfirm', {name: balanceLabel}), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setSavingCard(true);
          try {
            if (cashTransactions.length > 0) {
              await deleteCashScopeTransactionsForUser(userId, transactions);
            }
            if (targetUser?.financeCardLabels?.cash?.trim()) {
              await clearFinanceCardLabel(userId, 'cash');
            }
            navigation.goBack();
          } catch {
            Alert.alert(t('error'), t('saveFailed'));
          } finally {
            setSavingCard(false);
          }
        },
      },
    ]);
  }, [balanceLabel, cashTransactions.length, navigation, t, targetUser, transactions, userId]);

  const handleRenameCard = async (name: string) => {
    setSavingCard(true);
    try {
      await updateFinanceCardLabel(userId, 'cash', name);
      setRenameVisible(false);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingCard(false);
    }
  };

  const cardMenuItems = useMemo<FinanceCardMenuItem[]>(() => {
    const items: FinanceCardMenuItem[] = [];

    if (canClearAll && cashTransactions.length > 0) {
      items.push({
        key: 'clear',
        label: t('clearLedgerTransactions'),
        disabled: clearing,
        onPress: handleClearAllCashTransactions,
      });
    }

    if (canManageCard) {
      items.push({
        key: 'rename',
        label: t('renameFinanceLedger'),
        disabled: savingCard,
        onPress: () => setRenameVisible(true),
      });
      items.push({
        key: 'delete',
        label: t('deleteFinanceLedger'),
        destructive: true,
        disabled: savingCard,
        onPress: handleDeleteCashCard,
      });
    }

    return items;
  }, [
    canClearAll,
    canManageCard,
    cashTransactions.length,
    clearing,
    handleClearAllCashTransactions,
    handleDeleteCashCard,
    savingCard,
    t,
  ]);

  const openCardMenu = useCallback(() => {
    setCardMenuVisible(true);
  }, []);

  useFinanceCardHeaderMenu({
    title: isHubView ? userName : balanceLabel,
    visible: !isHubView && cardMenuItems.length > 0,
    onOpenMenu: openCardMenu,
  });

  const cashLastTransactionAt = useMemo(() => {
    if (cashTransactions.length === 0) {
      return null;
    }
    return cashTransactions.reduce(
      (latest, tx) => (tx.createdAt.localeCompare(latest) > 0 ? tx.createdAt : latest),
      cashTransactions[0].createdAt,
    );
  }, [cashTransactions]);

  const hubMainAccount = useMemo<FinanceAccountListItem | null>(() => {
    if (!targetUser) {
      return null;
    }
    return {
      account: targetUser,
      balance,
      transactionCount: cashTransactions.length,
      lastTransactionAt: cashLastTransactionAt,
      viewOnly: !canManage,
    };
  }, [balance, canManage, cashLastTransactionAt, cashTransactions.length, targetUser]);

  if (!targetUser) {
    return (
      <ScreenContainer>
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('loading')}</Text>
      </ScreenContainer>
    );
  }

  if (!canAccess) {
    return (
      <ScreenContainer>
        <Text style={[textStyle, {color: theme.status.error}]}>{t('accessDenied')}</Text>
      </ScreenContainer>
    );
  }

  const handleCreateTransaction = async (type: 'received' | 'paid', values: TransactionFormValues) => {
    if (!canManage || !currentUser) {
      return;
    }
    const pendingId = `pending-${Date.now()}`;
    const signedAmount = normalizeTransactionAmount(type, values.amount);
    appendPending({
      id: pendingId,
      userId,
      type,
      amount: signedAmount,
      note: values.note ?? '',
      createdAt: new Date().toISOString(),
      createdByUserId: currentUser.id,
      createdByRole: currentUser.role,
    });
    try {
      await createTransaction(userId, type, values.amount, values.note ?? '', {
        createdByUserId: currentUser.id,
        createdByRole: currentUser.role,
        balanceSyncViewer: currentUser,
      });
    } catch (error) {
      removePending(pendingId);
      throw error;
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportEmployeeAccountReport(targetUser, cashTransactions, t, {
        isRtl: isRTL,
        appName: t('appName'),
      });
    } catch (error) {
      console.error('[EmployeeAccountScreen] export failed', error);
      Alert.alert(t('error'), t('exportFinanceFailed'));
    } finally {
      setExporting(false);
    }
  };

  if (isHubView) {
    return (
      <ScreenContainer>
        <FinanceSectionHeader title={t('employeeMainFinanceCard')} style={{marginTop: 0}} />
        {hubMainAccount ? (
          <FinanceAccountsList
            accounts={[hubMainAccount]}
            currencyLabel={t('currencyLabel')}
            onSelect={() => {
              navigation.push('EmployeeAccount', {userId, userName, card: 'cash'});
            }}
          />
        ) : null}
        <FinanceCustomLedgersSection
          userId={userId}
          allLedgersMode
          showAddButton={false}
          onOpenCustomLedger={(ledgerId, ledgerName, ledgerColor) => {
            navigation.navigate('EmployeeCustomLedger', {
              userId,
              userName,
              ledgerId,
              ledgerName,
              ledgerColor,
            });
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <>
      <FinanceCardScreen
        accountTitle={userName}
        balanceLabel={balanceLabel}
        balance={balance}
        transactions={cashTransactions}
        canManage={canManage}
        targetUser={targetUser}
        currentUser={currentUser}
        onCreateTransaction={handleCreateTransaction}
        onExport={handleExport}
        exporting={exporting}
        loadingOverlay={clearing || savingCard}
        focusTransactionId={focusTransactionId}
        focusToken={focusToken}
      />
      <AddFinanceLedgerSheet
        visible={renameVisible}
        mode="rename"
        initialName={balanceLabel}
        saving={savingCard}
        onClose={() => setRenameVisible(false)}
        onSave={handleRenameCard}
      />
      <FinanceCardOptionsSheet
        visible={cardMenuVisible}
        items={cardMenuItems}
        onClose={() => setCardMenuVisible(false)}
      />
      <LoadingOverlay visible={exporting || clearing || savingCard} />
    </>
  );
};

export default EmployeeAccountScreen;
