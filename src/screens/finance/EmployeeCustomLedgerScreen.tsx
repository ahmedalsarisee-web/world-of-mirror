import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Text} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import AddFinanceLedgerSheet from '@app/components/finance/AddFinanceLedgerSheet';
import FinanceCardScreen from '@app/components/finance/FinanceCardScreen';
import {
  FinanceCardOptionsSheet,
  type FinanceCardMenuItem,
} from '@app/components/finance/FinanceCardOverflowMenu';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useFinanceCardHeaderMenu} from '@app/hooks/useFinanceCardHeaderMenu';
import {useTheme} from '@app/context/ThemeContext';
import {
  createTransaction,
  deleteLedgerTransactionsForUser,
  subscribeToUserTransactions,
} from '@app/services/transactions.service';
import {
  deleteFinanceLedger,
  renameFinanceLedger,
  subscribeToUser,
} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, Transaction} from '@app/types/models';
import type {FinanceStackParamList} from '@app/types/navigation';
import {
  filterCustomLedgerTransactions,
  resolveAccountBalance,
} from '@app/utils/financeTotals';
import {
  canClearFinanceLedgerTransactions,
  canManageFinanceLedgerTransactions,
  canManageFinanceLedgers,
  canViewFinanceLedger,
  isExplicitlySharedFinanceLedger,
} from '@app/utils/financePermissions';
import {exportEmployeeAccountReport} from '@app/utils/exportFinanceReport';
import type {TransactionFormValues} from '@app/utils/validation';

type Route = RouteProp<FinanceStackParamList, 'EmployeeCustomLedger'>;
type Nav = NativeStackNavigationProp<FinanceStackParamList, 'EmployeeCustomLedger'>;

const EmployeeCustomLedgerScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, isRTL} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId, userName, ledgerId, ledgerName} = route.params;
  const authUser = useAuthStore((s) => s.user);
  const [liveViewer, setLiveViewer] = useState<AppUser | null>(null);
  const currentUser = liveViewer ?? authUser;
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [renameVisible, setRenameVisible] = useState(false);
  const [savingLedger, setSavingLedger] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cardMenuVisible, setCardMenuVisible] = useState(false);

  const displayLedgerName =
    targetUser?.financeLedgers?.find((ledger) => ledger.id === ledgerId)?.name ?? ledgerName;
  const ledgerDef = targetUser?.financeLedgers?.find((ledger) => ledger.id === ledgerId);
  const canAccess =
    targetUser && ledgerDef ? canViewFinanceLedger(currentUser, targetUser, ledgerDef) : false;
  const canManage =
    targetUser && ledgerDef
      ? canManageFinanceLedgerTransactions(currentUser, targetUser, ledgerDef)
      : false;
  const canManageLedger = targetUser ? canManageFinanceLedgers(currentUser, targetUser) : false;
  const canClearAll =
    targetUser && ledgerDef
      ? canClearFinanceLedgerTransactions(currentUser, targetUser, ledgerDef)
      : false;

  useEffect(() => {
    if (!authUser?.id) {
      setLiveViewer(null);
      return;
    }
    return subscribeToUser(authUser.id, setLiveViewer);
  }, [authUser?.id]);

  useEffect(() => {
    const unsubUser = subscribeToUser(userId, setTargetUser);
    return unsubUser;
  }, [userId]);

  useEffect(() => {
    if (!canAccess) {
      return;
    }
    const unsubTx = subscribeToUserTransactions(userId, setTransactions);
    return unsubTx;
  }, [userId, canAccess]);

  const ledgerTransactions = useMemo(
    () => filterCustomLedgerTransactions(transactions, ledgerId),
    [ledgerId, transactions],
  );

  const balance = useMemo(
    () => resolveAccountBalance(0, ledgerTransactions),
    [ledgerTransactions],
  );

  const handleClearAllLedgerTransactions = useCallback(() => {
    if (!targetUser || !canClearAll || ledgerTransactions.length === 0) {
      return;
    }

    Alert.alert(t('clearLedgerTransactions'), t('clearLedgerTransactionsConfirm', {name: displayLedgerName}), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          try {
            await deleteLedgerTransactionsForUser(userId, ledgerId, transactions);
          } catch {
            Alert.alert(t('error'), t('saveFailed'));
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  }, [canClearAll, displayLedgerName, ledgerId, ledgerTransactions.length, t, targetUser, transactions, userId]);

  const handleDeleteLedger = useCallback(() => {
    Alert.alert(t('deleteFinanceLedger'), t('deleteFinanceLedgerConfirm', {name: displayLedgerName}), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setSavingLedger(true);
          try {
            if (ledgerTransactions.length > 0) {
              await deleteLedgerTransactionsForUser(userId, ledgerId, transactions);
            }
            await deleteFinanceLedger(userId, ledgerId);
            navigation.goBack();
          } catch {
            Alert.alert(t('error'), t('saveFailed'));
          } finally {
            setSavingLedger(false);
          }
        },
      },
    ]);
  }, [displayLedgerName, ledgerId, ledgerTransactions.length, navigation, t, transactions, userId]);

  const cardMenuItems = useMemo<FinanceCardMenuItem[]>(() => {
    const items: FinanceCardMenuItem[] = [];

    if (canClearAll && ledgerTransactions.length > 0) {
      items.push({
        key: 'clear',
        label: t('clearLedgerTransactions'),
        disabled: clearing,
        onPress: handleClearAllLedgerTransactions,
      });
    }

    if (canManageLedger) {
      items.push({
        key: 'rename',
        label: t('renameFinanceLedger'),
        disabled: savingLedger,
        onPress: () => setRenameVisible(true),
      });
      items.push({
        key: 'delete',
        label: t('deleteFinanceLedger'),
        destructive: true,
        disabled: savingLedger,
        onPress: handleDeleteLedger,
      });
    }

    return items;
  }, [
    canClearAll,
    canManageLedger,
    clearing,
    handleClearAllLedgerTransactions,
    handleDeleteLedger,
    ledgerTransactions.length,
    savingLedger,
    t,
  ]);

  useFinanceCardHeaderMenu({
    title: displayLedgerName,
    visible: cardMenuItems.length > 0,
    onOpenMenu: () => setCardMenuVisible(true),
  });

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
    if (!canManage || !currentUser || !ledgerDef) {
      return;
    }
    const isDelegatedSharedLedger = isExplicitlySharedFinanceLedger(currentUser, targetUser, ledgerDef);
    await createTransaction(userId, type, values.amount, values.note ?? '', {
      createdByUserId: currentUser.id,
      createdByRole: currentUser.role,
      ledgerId,
      pinOnCreate: isDelegatedSharedLedger ? false : undefined,
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportEmployeeAccountReport(targetUser, ledgerTransactions, t, {
        isRtl: isRTL,
        appName: t('appName'),
        accountTitle: displayLedgerName,
      });
    } catch (error) {
      console.error('[EmployeeCustomLedgerScreen] export failed', error);
      Alert.alert(t('error'), t('exportFinanceFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleRenameLedger = async (name: string) => {
    setSavingLedger(true);
    try {
      await renameFinanceLedger(userId, ledgerId, name);
      setRenameVisible(false);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingLedger(false);
    }
  };

  return (
    <>
      <FinanceCardScreen
        accountTitle={userName}
        balanceLabel={displayLedgerName}
        balance={balance}
        transactions={ledgerTransactions}
        canManage={canManage}
        targetUser={targetUser}
        currentUser={currentUser}
        ledger={ledgerDef}
        onCreateTransaction={handleCreateTransaction}
        onExport={handleExport}
        exporting={exporting}
        loadingOverlay={clearing || savingLedger}
      />
      <AddFinanceLedgerSheet
        visible={renameVisible}
        mode="rename"
        initialName={displayLedgerName}
        saving={savingLedger}
        onClose={() => setRenameVisible(false)}
        onSave={handleRenameLedger}
      />
      <FinanceCardOptionsSheet
        visible={cardMenuVisible}
        items={cardMenuItems}
        onClose={() => setCardMenuVisible(false)}
      />
      <LoadingOverlay visible={savingLedger && !renameVisible} />
    </>
  );
};

export default EmployeeCustomLedgerScreen;
