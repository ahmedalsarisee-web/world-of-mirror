import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useForm, Controller} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {useTranslation} from 'react-i18next';
import AmountText from '@app/components/common/AmountText';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import BottomSheet from '@app/components/common/BottomSheet';
import EmptyState from '@app/components/common/EmptyState';
import AccountStatementExportButton from '@app/components/finance/AccountStatementExportButton';
import AddFinanceLedgerSheet from '@app/components/finance/AddFinanceLedgerSheet';
import {
  FinanceCardOptionsSheet,
  type FinanceCardMenuItem,
} from '@app/components/finance/FinanceCardOverflowMenu';
import EditFinanceTransactionSheet from '@app/components/finance/EditFinanceTransactionSheet';
import FinanceSearchBar from '@app/components/finance/FinanceSearchBar';
import FinanceTransactionRow from '@app/components/finance/FinanceTransactionRow';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useFinanceCardHeaderMenu} from '@app/hooks/useFinanceCardHeaderMenu';
import {useFinanceTransactionNow} from '@app/hooks/useFinanceTransactionNow';
import {useTheme} from '@app/context/ThemeContext';
import {
  createTransaction,
  deleteLedgerTransactionsForUser,
  deleteTransaction,
  subscribeToUserTransactions,
  updateTransaction,
} from '@app/services/transactions.service';
import {
  deleteFinanceLedger,
  renameFinanceLedger,
  setUserBalance,
  subscribeToUser,
} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, Transaction} from '@app/types/models';
import type {FinanceStackParamList} from '@app/types/navigation';
import {resolveCustomLedgerColor} from '@app/utils/financeLedgers';
import {
  computeCustomLedgerBalance,
  filterCustomLedgerTransactions,
  resolveAccountBalance,
} from '@app/utils/financeTotals';
import {
  canClearLedgerTransactions,
  canDeleteFinanceTransaction,
  canEditFinanceTransaction,
  canManageFinanceAccount,
  canManageFinanceLedgers,
  canViewFinanceAccount,
} from '@app/utils/financePermissions';
import {searchTransactions} from '@app/utils/financeSearch';
import {transactionSchema, type TransactionFormValues} from '@app/utils/validation';
import {getListCardStyle} from '@shared/theme/themeHelpers';
import {exportEmployeeAccountReport} from '@app/utils/exportFinanceReport';

type Route = RouteProp<FinanceStackParamList, 'EmployeeCustomLedger'>;
type Nav = NativeStackNavigationProp<FinanceStackParamList, 'EmployeeCustomLedger'>;
type TxModal = 'received' | 'paid' | null;

const EmployeeCustomLedgerScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, alignEnd, layoutStyle, isRTL} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId, userName, ledgerId, ledgerName, ledgerColor} = route.params;
  const currentUser = useAuthStore((s) => s.user);
  const transactionNow = useFinanceTransactionNow();
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState<TxModal>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [renameVisible, setRenameVisible] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingLedger, setSavingLedger] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cardMenuVisible, setCardMenuVisible] = useState(false);

  const displayLedgerName =
    targetUser?.financeLedgers?.find((ledger) => ledger.id === ledgerId)?.name ?? ledgerName;
  const accentColor = ledgerColor ?? resolveCustomLedgerColor(0);
  const canAccess = targetUser ? canViewFinanceAccount(currentUser, targetUser) : false;
  const canManage = targetUser ? canManageFinanceAccount(currentUser, targetUser) : false;
  const canManageLedger = targetUser ? canManageFinanceLedgers(currentUser, targetUser) : false;
  const canClearAll = targetUser ? canClearLedgerTransactions(currentUser, targetUser) : false;
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        balanceSection: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          marginHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        balanceTopRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        balanceIconWrap: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceSecondary,
          flexShrink: 0,
        },
        balanceInfo: {flex: 1, minWidth: 0},
        accountName: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
          marginBottom: 1,
        },
        balanceLabel: {
          fontSize: theme.typographyScale.size.xs,
        },
        balanceAmountCol: {
          alignItems: alignEnd,
          flexShrink: 0,
        },
        actions: {flexDirection: row, gap: theme.spacing.xs},
        actionBtn: {flex: 1, minHeight: 38, paddingVertical: 8},
        readOnlyHint: {
          paddingHorizontal: theme.spacing.xs,
          textAlign: 'center',
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 16,
        },
        txTitle: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
          paddingHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.xs,
        },
        txList: {paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xxl},
        cancel: {alignItems: 'center', marginTop: theme.spacing.sm, padding: theme.spacing.sm},
      }),
    [alignEnd, row, theme],
  );

  const {control, handleSubmit, reset, formState: {errors}} = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {amount: 0, note: ''},
  });

  useEffect(() => {
    const unsubUser = subscribeToUser(userId, setTargetUser);
    return unsubUser;
  }, [userId]);

  useEffect(() => {
    if (!canAccess) return;
    const unsubTx = subscribeToUserTransactions(userId, setTransactions);
    return unsubTx;
  }, [userId, canAccess]);

  const openTxModal = (next: TxModal) => {
    reset({amount: 0, note: ''});
    setModal(next);
  };

  const balance = useMemo(
    () => computeCustomLedgerBalance(transactions, ledgerId),
    [ledgerId, transactions],
  );

  const accountBalance = useMemo(
    () => resolveAccountBalance(targetUser?.balance ?? 0, transactions),
    [targetUser?.balance, transactions],
  );

  useEffect(() => {
    if (!targetUser || transactions.length === 0) {
      return;
    }

    const storedBalance = targetUser.balance ?? 0;
    if (Math.abs(accountBalance - storedBalance) < 0.005) {
      return;
    }

    void setUserBalance(userId, accountBalance);
  }, [accountBalance, targetUser, transactions.length, userId]);

  const ledgerTransactions = useMemo(
    () => filterCustomLedgerTransactions(transactions, ledgerId),
    [ledgerId, transactions],
  );

  const filteredTransactions = useMemo(
    () => searchTransactions(ledgerTransactions, searchQuery),
    [ledgerTransactions, searchQuery],
  );

  const hasSearchQuery = searchQuery.trim().length > 0;

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

  const openCardMenu = useCallback(() => {
    setCardMenuVisible(true);
  }, []);

  useFinanceCardHeaderMenu({
    title: displayLedgerName,
    visible: cardMenuItems.length > 0,
    onOpenMenu: openCardMenu,
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

  const onSubmitTx = async (values: TransactionFormValues) => {
    if (!modal || !canManage || !currentUser) return;
    const parsed = transactionSchema.parse(values);
    const txType = modal === 'received' ? 'ledger_debit' : 'ledger_credit';

    try {
      await createTransaction(userId, txType, parsed.amount, parsed.note ?? '', {
        createdByUserId: currentUser.id,
        createdByRole: currentUser.role,
        ledgerId,
      });
      reset();
      setModal(null);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    }
  };

  const onSubmitEdit = async (values: TransactionFormValues) => {
    if (!editingTransaction || !currentUser || !targetUser) return;
    if (!canEditFinanceTransaction(currentUser, targetUser, editingTransaction, Date.now())) {
      Alert.alert(t('error'), t('transactionEditWindowExpired'));
      setEditingTransaction(null);
      return;
    }
    const parsed = transactionSchema.parse(values);
    setSavingEdit(true);
    try {
      await updateTransaction(
        editingTransaction,
        {amount: parsed.amount, note: parsed.note ?? ''},
        currentUser.id,
      );
      setEditingTransaction(null);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  const onDeleteEdit = async () => {
    if (!editingTransaction || !currentUser || !targetUser) return;
    if (!canDeleteFinanceTransaction(currentUser, targetUser, editingTransaction, Date.now())) {
      Alert.alert(t('error'), t('transactionEditWindowExpired'));
      return;
    }

    setSavingEdit(true);
    try {
      await deleteTransaction(editingTransaction);
      setEditingTransaction(null);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  const canDeleteEditingTransaction =
    editingTransaction && targetUser
      ? canDeleteFinanceTransaction(currentUser, targetUser, editingTransaction, transactionNow)
      : false;

  const handleExport = async () => {
    if (!targetUser) return;
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
      <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
        <View style={[styles.balanceSection, listCard]}>
          <View style={[styles.balanceTopRow, layoutStyle]}>
            <AccountStatementExportButton
              onPress={handleExport}
              loading={exporting}
              size={18}
              style={{width: 32, height: 32, borderRadius: 16}}
            />
            <View style={[styles.balanceIconWrap, {backgroundColor: `${accentColor}18`}]}>
              <MaterialCommunityIcons name="book-account-outline" size={16} color={accentColor} />
            </View>
            <View style={styles.balanceInfo}>
              <Text style={[styles.accountName, textStyle, {color: theme.typography.primary}]} numberOfLines={1}>
                {userName}
              </Text>
              <Text style={[styles.balanceLabel, textStyle, {color: theme.typography.secondary}]} numberOfLines={2}>
                {displayLedgerName}
              </Text>
            </View>
            <View style={styles.balanceAmountCol}>
              <AmountText amount={balance} size="sm" currencyLabel={t('currencyLabel')} />
            </View>
          </View>
          {canManage ? (
            <View style={styles.actions}>
              <AppButton
                label={t('advanceWithdraw')}
                variant="success"
                onPress={() => openTxModal('paid')}
                style={styles.actionBtn}
              />
              <AppButton
                label={t('advanceDeposit')}
                variant="danger"
                onPress={() => openTxModal('received')}
                style={styles.actionBtn}
              />
            </View>
          ) : (
            <Text style={[styles.readOnlyHint, textStyle, {color: theme.typography.secondary}]}>
              {t('readOnlyAccountHint')}
            </Text>
          )}
        </View>

        <Text style={[styles.txTitle, textStyle, {color: theme.typography.primary}]}>{t('transactions')}</Text>
        <FinanceSearchBar value={searchQuery} onChangeText={setSearchQuery} />
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.txList}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon="cash-multiple"
              message={hasSearchQuery ? t('noTransactionsMatch') : t('noTransactions')}
            />
          }
          renderItem={({item}) => {
            const canEdit = targetUser
              ? canEditFinanceTransaction(currentUser, targetUser, item, transactionNow)
              : false;

            return (
              <FinanceTransactionRow
                transaction={item}
                canEdit={canEdit}
                now={transactionNow}
                accentColor={accentColor}
                onPress={canEdit ? () => setEditingTransaction(item) : undefined}
              />
            );
          }}
        />
      </ScreenContainer>

      <BottomSheet
        visible={canManage && modal !== null}
        title={modal === 'received' ? t('advanceDeposit') : t('advanceWithdraw')}
        onClose={() => setModal(null)}
        formFields={['amount', 'note']}
      >
        <Controller
          control={control}
          name="amount"
          render={({field: {onChange, onBlur, value}}) => (
            <AppInput
              fieldKey="amount"
              label={t('amount')}
              numeric
              value={value}
              onNumberChange={onChange}
              onBlur={onBlur}
              error={errors.amount?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="note"
          render={({field: {onChange, onBlur, value}}) => (
            <AppInput
              fieldKey="note"
              label={t('noteOptional')}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        <AppButton
          label={t('confirm')}
          variant={modal === 'received' ? 'success' : 'danger'}
          onPress={handleSubmit(onSubmitTx)}
        />
        <Pressable onPress={() => setModal(null)} style={styles.cancel}>
          <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('cancel')}</Text>
        </Pressable>
      </BottomSheet>
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
      <EditFinanceTransactionSheet
        transaction={editingTransaction}
        visible={editingTransaction !== null}
        saving={savingEdit}
        canDelete={canDeleteEditingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={onSubmitEdit}
        onDelete={onDeleteEdit}
      />
      <LoadingOverlay visible={exporting || savingEdit || clearing || savingLedger} />
    </>
  );
};

export default EmployeeCustomLedgerScreen;
