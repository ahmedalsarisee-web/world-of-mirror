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
import {useOptimisticFinanceTransactions} from '@app/hooks/useOptimisticFinanceTransactions';
import {useTheme} from '@app/context/ThemeContext';
import {
  createTransaction,
  deleteLedgerTransactionsForUser,
  subscribeToLedgerTransactions,
  subscribeToUserTransactions,
} from '@app/services/transactions.service';
import {
  deleteFinanceLedger,
  renameFinanceLedger,
  subscribeToUser,
  updateFinanceLedgerMemoOnly,
} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, Transaction} from '@app/types/models';
import type {FinanceStackParamList} from '@app/types/navigation';
import {
  filterCustomLedgerTransactions,
  normalizeTransactionAmount,
  resolveAccountBalance,
} from '@app/utils/financeTotals';
import {isPrimaryAdmin} from '@app/utils/adminPermissions';
import {
  canClearFinanceLedgerTransactions,
  canManageFinanceLedgerEntry,
  canManageFinanceLedgerTransactions,
  canToggleFinanceLedgerMemoMode,
  canViewFinanceLedger,
  isExplicitlySharedFinanceLedger,
} from '@app/utils/financePermissions';
import {isMemoFinanceLedger} from '@app/utils/financeLedgers';
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
  const {userId, userName, ledgerId, ledgerName, focusTransactionId, focusToken} = route.params;
  const authUser = useAuthStore((s) => s.user);
  const authEmail = useAuthStore((s) => s.authEmail);
  const [liveViewer, setLiveViewer] = useState<AppUser | null>(null);
  const currentUser = liveViewer ?? authUser;
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const [remoteTransactions, setRemoteTransactions] = useState<Transaction[]>([]);
  const {transactions, appendPending, removePending} = useOptimisticFinanceTransactions(remoteTransactions);
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
  const canManageLedger =
    targetUser && ledgerDef ? canManageFinanceLedgerEntry(currentUser, targetUser, ledgerDef) : false;
  const canClearAll =
    targetUser && ledgerDef
      ? canClearFinanceLedgerTransactions(currentUser, targetUser, ledgerDef)
      : false;
  const canToggleMemoMode = targetUser ? canToggleFinanceLedgerMemoMode(currentUser, targetUser) : false;
  const isPrimaryAdminViewer = isPrimaryAdmin(currentUser, authEmail);
  const isMemoLedger = isMemoFinanceLedger(ledgerDef);
  const useLedgerScopedTransactions =
    Boolean(ledgerId && currentUser?.role === 'employee' && currentUser.id !== userId) &&
    (targetUser == null || targetUser.role === 'admin');

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

    if (useLedgerScopedTransactions && ledgerId) {
      const unsubTx = subscribeToLedgerTransactions(userId, ledgerId, setRemoteTransactions);
      return unsubTx;
    }

    const unsubTx = subscribeToUserTransactions(userId, setRemoteTransactions);
    return unsubTx;
  }, [canAccess, ledgerId, useLedgerScopedTransactions, userId]);

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

  const handleDeleteLedgerKeepTotals = useCallback(() => {
    Alert.alert(
      t('deleteFinanceLedger'),
      t('deleteFinanceLedgerKeepTotalsConfirm', {name: displayLedgerName}),
      [
        {text: t('cancel'), style: 'cancel'},
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            setSavingLedger(true);
            try {
              await deleteFinanceLedger(userId, ledgerId);
              navigation.goBack();
            } catch {
              Alert.alert(t('error'), t('saveFailed'));
            } finally {
              setSavingLedger(false);
            }
          },
        },
      ],
    );
  }, [displayLedgerName, ledgerId, navigation, t, userId]);

  const handleConvertToMemo = useCallback(() => {
    if (!targetUser || !ledgerDef || isMemoLedger) {
      return;
    }

    Alert.alert(t('convertToMemoFinanceCard'), t('convertToMemoFinanceCardConfirm'), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('confirm'),
        onPress: () => {
          void (async () => {
            setSavingLedger(true);
            try {
              await updateFinanceLedgerMemoOnly(userId, ledgerId, true);
              Alert.alert(t('done'), t('convertFinanceCardTypeDone'));
            } catch {
              Alert.alert(t('error'), t('saveFailed'));
            } finally {
              setSavingLedger(false);
            }
          })();
        },
      },
    ]);
  }, [isMemoLedger, ledgerDef, ledgerId, t, targetUser, userId]);

  const handleConvertToFinance = useCallback(() => {
    if (!targetUser || !ledgerDef || !isMemoLedger) {
      return;
    }

    Alert.alert(t('convertToFinanceCard'), t('convertToFinanceCardConfirm'), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('confirm'),
        onPress: () => {
          void (async () => {
            setSavingLedger(true);
            try {
              await updateFinanceLedgerMemoOnly(userId, ledgerId, false);
              Alert.alert(t('done'), t('convertFinanceCardTypeDone'));
            } catch {
              Alert.alert(t('error'), t('saveFailed'));
            } finally {
              setSavingLedger(false);
            }
          })();
        },
      },
    ]);
  }, [isMemoLedger, ledgerDef, ledgerId, t, targetUser, userId]);

  const handleToggleMemoMode = useCallback(() => {
    if (!targetUser || !ledgerDef || !canToggleMemoMode) {
      return;
    }

    const nextMemoOnly = !isMemoFinanceLedger(ledgerDef);
    Alert.alert(
      nextMemoOnly ? t('convertToMemoFinanceCard') : t('convertToFinanceCard'),
      nextMemoOnly ? t('convertToMemoFinanceCardConfirm') : t('convertToFinanceCardConfirm'),
      [
        {text: t('cancel'), style: 'cancel'},
        {
          text: t('confirm'),
          onPress: () => {
            void (async () => {
              setSavingLedger(true);
              try {
                await updateFinanceLedgerMemoOnly(userId, ledgerId, nextMemoOnly);
                Alert.alert(t('done'), t('convertFinanceCardTypeDone'));
              } catch {
                Alert.alert(t('error'), t('saveFailed'));
              } finally {
                setSavingLedger(false);
              }
            })();
          },
        },
      ],
    );
  }, [canToggleMemoMode, ledgerDef, ledgerId, t, targetUser, userId]);

  const cardMenuItems = useMemo<FinanceCardMenuItem[]>(() => {
    if (isPrimaryAdminViewer && ledgerDef) {
      return [
        {
          key: 'rename',
          label: t('renameFinanceLedger'),
          disabled: savingLedger,
          onPress: () => setRenameVisible(true),
        },
        {
          key: 'delete',
          label: t('deleteFinanceLedger'),
          destructive: true,
          disabled: savingLedger,
          onPress: handleDeleteLedgerKeepTotals,
        },
        {
          key: isMemoLedger ? 'convertToFinance' : 'convertToMemo',
          label: isMemoLedger ? t('convertToFinanceCard') : t('convertToMemoFinanceCard'),
          disabled: savingLedger,
          onPress: isMemoLedger ? handleConvertToFinance : handleConvertToMemo,
        },
      ];
    }

    const items: FinanceCardMenuItem[] = [];

    if (canToggleMemoMode && ledgerDef) {
      items.push({
        key: isMemoLedger ? 'convertToFinance' : 'convertToMemo',
        label: isMemoLedger ? t('convertToFinanceCard') : t('convertToMemoFinanceCard'),
        disabled: savingLedger,
        onPress: handleToggleMemoMode,
      });
    }

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
    canToggleMemoMode,
    clearing,
    handleClearAllLedgerTransactions,
    handleConvertToFinance,
    handleConvertToMemo,
    handleDeleteLedger,
    handleDeleteLedgerKeepTotals,
    handleToggleMemoMode,
    isMemoLedger,
    isPrimaryAdminViewer,
    ledgerDef,
    ledgerTransactions.length,
    savingLedger,
    t,
  ]);

  useFinanceCardHeaderMenu({
    title: displayLedgerName,
    visible: Boolean(isPrimaryAdminViewer && ledgerDef) || cardMenuItems.length > 0,
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
      ledgerId,
    });

    try {
      await createTransaction(userId, type, values.amount, values.note ?? '', {
        createdByUserId: currentUser.id,
        createdByRole: currentUser.role,
        ledgerId,
        pinOnCreate: isDelegatedSharedLedger ? false : undefined,
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
        onOpenCardMenu={
          isPrimaryAdminViewer || cardMenuItems.length > 0 ? () => setCardMenuVisible(true) : undefined
        }
        focusTransactionId={focusTransactionId}
        focusToken={focusToken}
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
