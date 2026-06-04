import React, {useEffect, useMemo, useState} from 'react';
import {Alert, FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {useForm, Controller} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {useTranslation} from 'react-i18next';
import AmountText from '@app/components/common/AmountText';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import BottomSheet from '@app/components/common/BottomSheet';
import EmptyState from '@app/components/common/EmptyState';
import AccountStatementExportButton from '@app/components/finance/AccountStatementExportButton';
import EditFinanceTransactionSheet from '@app/components/finance/EditFinanceTransactionSheet';
import FinanceSearchBar from '@app/components/finance/FinanceSearchBar';
import FinanceTransactionRow from '@app/components/finance/FinanceTransactionRow';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useFinanceCardHeaderMenu} from '@app/hooks/useFinanceCardHeaderMenu';
import {useFinanceTransactionNow} from '@app/hooks/useFinanceTransactionNow';
import {useTheme} from '@app/context/ThemeContext';
import {createTransaction, deleteTransaction, subscribeToUserTransactions, updateTransaction} from '@app/services/transactions.service';
import {setUserBalance, subscribeToUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, Transaction} from '@app/types/models';
import type {FinanceStackParamList} from '@app/types/navigation';
import {filterCashScopeTransactions, resolveAccountBalance} from '@app/utils/financeTotals';
import {canDeleteFinanceTransaction, canEditFinanceTransaction, canManageFinanceAccount, canViewFinanceAccount} from '@app/utils/financePermissions';
import {searchTransactions} from '@app/utils/financeSearch';
import {transactionSchema, type TransactionFormValues} from '@app/utils/validation';
import {getListCardStyle} from '@shared/theme/themeHelpers';
import {exportEmployeeAccountReport} from '@app/utils/exportFinanceReport';
import {resolveCashCardLabel} from '@app/utils/financeLedgers';

type Route = RouteProp<FinanceStackParamList, 'EmployeeAccount'>;
type TxModal = 'received' | 'paid' | null;

const EmployeeAccountScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, alignEnd, layoutStyle, isRTL} = useDirection();
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

  const canAccess = targetUser ? canViewFinanceAccount(currentUser, targetUser) : false;
  const canManage = targetUser ? canManageFinanceAccount(currentUser, targetUser) : false;
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const balanceLabel = resolveCashCardLabel(targetUser?.financeCardLabels, t);

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
    () => resolveAccountBalance(targetUser?.balance ?? 0, transactions),
    [targetUser?.balance, transactions],
  );

  useEffect(() => {
    if (!targetUser || transactions.length === 0) {
      return;
    }

    const storedBalance = targetUser.balance ?? 0;
    if (Math.abs(balance - storedBalance) < 0.005) {
      return;
    }

    void setUserBalance(userId, balance);
  }, [balance, targetUser, transactions.length, userId]);

  const cashTransactions = useMemo(
    () => filterCashScopeTransactions(transactions),
    [transactions],
  );

  const filteredTransactions = useMemo(
    () => searchTransactions(cashTransactions, searchQuery),
    [cashTransactions, searchQuery],
  );

  const hasSearchQuery = searchQuery.trim().length > 0;

  useFinanceCardHeaderMenu({
    title: balanceLabel,
    visible: false,
    onOpenMenu: () => {},
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
    try {
      await createTransaction(userId, modal, parsed.amount, parsed.note ?? '', {
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
      await exportEmployeeAccountReport(targetUser, transactions, t, {
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
              <MaterialCommunityIcons name="wallet-outline" size={16} color={theme.colors.primary} />
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
              <AmountText amount={balance} size="sm" currencyLabel={t('currencyLabel')} />
            </View>
          </View>
          {canManage ? (
            <View style={styles.actions}>
              <AppButton
                label={t('received')}
                variant="success"
                onPress={() => openTxModal('received')}
                style={styles.actionBtn}
              />
              <AppButton
                label={t('paid')}
                variant="danger"
                onPress={() => openTxModal('paid')}
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
        title={modal === 'received' ? t('received') : t('paid')}
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
      <LoadingOverlay visible={exporting || savingEdit} />
    </>
  );
};

export default EmployeeAccountScreen;
