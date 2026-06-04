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
import {createTransaction, deleteAdvanceScopeTransactionsForUser, deleteTransaction, subscribeToUserTransactions, updateTransaction} from '@app/services/transactions.service';
import {setUserBalance, subscribeToUser, updateFinanceCardLabel, clearFinanceCardLabel} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, Transaction} from '@app/types/models';
import type {FinanceStackParamList} from '@app/types/navigation';
import {
  computeAdvanceAccountBalance,
  filterAdvanceScopeTransactions,
  resolveAccountBalance,
} from '@app/utils/financeTotals';
import {canClearLedgerTransactions, canDeleteFinanceTransaction, canEditFinanceTransaction, canManageFinanceAccount, canManageFinanceLedgers, canViewFinanceAccount} from '@app/utils/financePermissions';
import {searchTransactions} from '@app/utils/financeSearch';
import {transactionSchema, type TransactionFormValues} from '@app/utils/validation';
import {getListCardStyle} from '@shared/theme/themeHelpers';
import {exportEmployeeAccountReport} from '@app/utils/exportFinanceReport';
import {resolveSalaryAdvanceScreenTitle} from '@app/utils/financeLedgers';

type Route = RouteProp<FinanceStackParamList, 'EmployeeAdvance'>;
type Nav = NativeStackNavigationProp<FinanceStackParamList, 'EmployeeAdvance'>;
type TxModal = 'received' | 'paid' | null;

const ADVANCE_BLUE = '#2563EB';

const EmployeeAdvanceScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, alignEnd, layoutStyle, isRTL} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId, userName} = route.params;
  const currentUser = useAuthStore((s) => s.user);
  const transactionNow = useFinanceTransactionNow();
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState<TxModal>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [cardMenuVisible, setCardMenuVisible] = useState(false);

  const canAccess = targetUser ? canViewFinanceAccount(currentUser, targetUser) : false;
  const canManage = targetUser ? canManageFinanceAccount(currentUser, targetUser) : false;
  const canClearAll = targetUser ? canClearLedgerTransactions(currentUser, targetUser) : false;
  const canManageCard = targetUser ? canManageFinanceLedgers(currentUser, targetUser) : false;
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const balanceLabel = resolveSalaryAdvanceScreenTitle(targetUser?.financeCardLabels, t);

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
          backgroundColor: `${ADVANCE_BLUE}18`,
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
    () => computeAdvanceAccountBalance(transactions),
    [transactions],
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

  const advanceTransactions = useMemo(
    () => filterAdvanceScopeTransactions(transactions),
    [transactions],
  );

  const filteredTransactions = useMemo(
    () => searchTransactions(advanceTransactions, searchQuery),
    [advanceTransactions, searchQuery],
  );

  const hasSearchQuery = searchQuery.trim().length > 0;

  const handleClearAllAdvanceTransactions = useCallback(() => {
    if (!targetUser || !canClearAll || advanceTransactions.length === 0) {
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
            await deleteAdvanceScopeTransactionsForUser(userId, transactions);
          } catch {
            Alert.alert(t('error'), t('saveFailed'));
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  }, [advanceTransactions.length, balanceLabel, canClearAll, t, targetUser, transactions, userId]);

  const handleDeleteAdvanceCard = useCallback(() => {
    Alert.alert(t('deleteFinanceLedger'), t('deleteFinanceLedgerConfirm', {name: balanceLabel}), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setSavingCard(true);
          try {
            if (advanceTransactions.length > 0) {
              await deleteAdvanceScopeTransactionsForUser(userId, transactions);
            }
            if (targetUser?.financeCardLabels?.salaryAdvance?.trim()) {
              await clearFinanceCardLabel(userId, 'salaryAdvance');
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
  }, [advanceTransactions.length, balanceLabel, navigation, t, targetUser, transactions, userId]);

  const handleRenameCard = async (name: string) => {
    setSavingCard(true);
    try {
      await updateFinanceCardLabel(userId, 'salaryAdvance', name);
      setRenameVisible(false);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingCard(false);
    }
  };

  const cardMenuItems = useMemo<FinanceCardMenuItem[]>(() => {
    const items: FinanceCardMenuItem[] = [];

    if (canClearAll && advanceTransactions.length > 0) {
      items.push({
        key: 'clear',
        label: t('clearLedgerTransactions'),
        disabled: clearing,
        onPress: handleClearAllAdvanceTransactions,
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
        onPress: handleDeleteAdvanceCard,
      });
    }

    return items;
  }, [
    advanceTransactions.length,
    canClearAll,
    canManageCard,
    clearing,
    handleClearAllAdvanceTransactions,
    handleDeleteAdvanceCard,
    savingCard,
    t,
  ]);

  const openCardMenu = useCallback(() => {
    setCardMenuVisible(true);
  }, []);

  useFinanceCardHeaderMenu({
    title: balanceLabel,
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
    const txType = modal === 'received' ? 'advance' : 'advance_repayment';

    try {
      await createTransaction(userId, txType, parsed.amount, parsed.note ?? '', {
        createdByUserId: currentUser.id,
        createdByRole: currentUser.role,
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
      await exportEmployeeAccountReport(targetUser, advanceTransactions, t, {
        isRtl: isRTL,
        appName: t('appName'),
      });
    } catch (error) {
      console.error('[EmployeeAdvanceScreen] export failed', error);
      Alert.alert(t('error'), t('exportFinanceFailed'));
    } finally {
      setExporting(false);
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
            <View style={styles.balanceIconWrap}>
              <MaterialCommunityIcons name="hand-coin-outline" size={16} color={ADVANCE_BLUE} />
            </View>
            <View style={styles.balanceInfo}>
              <Text style={[styles.accountName, textStyle, {color: theme.typography.primary}]} numberOfLines={1}>
                {userName}
              </Text>
              <Text style={[styles.balanceLabel, textStyle, {color: theme.typography.secondary}]}>
                {balanceLabel}
              </Text>
            </View>
            <View style={styles.balanceAmountCol}>
              <AmountText amount={balance} size="sm" tone="negative" currencyLabel={t('currencyLabel')} />
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
      <EditFinanceTransactionSheet
        transaction={editingTransaction}
        visible={editingTransaction !== null}
        saving={savingEdit}
        canDelete={canDeleteEditingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={onSubmitEdit}
        onDelete={onDeleteEdit}
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
      <LoadingOverlay visible={exporting || savingEdit || clearing || savingCard} />
    </>
  );
};

export default EmployeeAdvanceScreen;
