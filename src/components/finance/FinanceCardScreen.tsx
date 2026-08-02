import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useForm, Controller} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {useTranslation} from 'react-i18next';
import AmountText from '@app/components/common/AmountText';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import BottomSheet from '@app/components/common/BottomSheet';
import EmptyState from '@app/components/common/EmptyState';
import AccountStatementExportButton from '@app/components/finance/AccountStatementExportButton';
import FinanceCardCashFlowRow from '@app/components/finance/FinanceCardCashFlowRow';
import {FinanceCardOverflowButton} from '@app/components/finance/FinanceCardOverflowMenu';
import EditFinanceTransactionSheet from '@app/components/finance/EditFinanceTransactionSheet';
import FinanceSearchBar from '@app/components/finance/FinanceSearchBar';
import FinanceTransactionRow from '@app/components/finance/FinanceTransactionRow';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useFinanceTransactionNow} from '@app/hooks/useFinanceTransactionNow';
import {useTheme} from '@app/context/ThemeContext';
import {deleteTransaction, updateTransaction} from '@app/services/transactions.service';
import type {AppUser, EmployeeFinanceLedger, Transaction} from '@app/types/models';
import {canDeleteFinanceTransaction, canEditFinanceTransaction} from '@app/utils/financePermissions';
import {computeFinanceTotals} from '@app/utils/financeTotals';
import {searchTransactions} from '@app/utils/financeSearch';
import {transactionSchema, type TransactionFormValues} from '@app/utils/validation';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type TxModal = 'received' | 'paid' | null;

interface Props {
  accountTitle: string;
  balanceLabel: string;
  balance: number;
  transactions: Transaction[];
  canManage: boolean;
  targetUser: AppUser;
  currentUser: AppUser | null | undefined;
  ledger?: Pick<EmployeeFinanceLedger, 'id' | 'visibleToUserIds'>;
  onCreateTransaction: (type: 'received' | 'paid', values: TransactionFormValues) => Promise<void>;
  onExport: () => Promise<void>;
  exporting?: boolean;
  loadingOverlay?: boolean;
  topContent?: React.ReactNode;
  onOpenCardMenu?: () => void;
  focusTransactionId?: string;
  focusToken?: number;
}

const FinanceCardScreen: React.FC<Props> = ({
  accountTitle,
  balanceLabel,
  balance,
  transactions,
  canManage,
  targetUser,
  currentUser,
  ledger,
  onCreateTransaction,
  onExport,
  exporting = false,
  loadingOverlay = false,
  topContent,
  onOpenCardMenu,
  focusTransactionId,
  focusToken,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, alignEnd, layoutStyle} = useDirection();
  const transactionNow = useFinanceTransactionNow();
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState<TxModal>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const listRef = useRef<FlatList<Transaction>>(null);
  const focusAppliedRef = useRef(false);
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

  const filteredTransactions = useMemo(
    () => searchTransactions(transactions, searchQuery),
    [searchQuery, transactions],
  );

  const {cashIn, cashOut} = useMemo(() => computeFinanceTotals(transactions), [transactions]);

  const hasSearchQuery = searchQuery.trim().length > 0;

  useEffect(() => {
    focusAppliedRef.current = false;
  }, [focusTransactionId, focusToken]);

  useEffect(() => {
    if (!focusTransactionId || focusAppliedRef.current) {
      return;
    }

    const index = filteredTransactions.findIndex((transaction) => transaction.id === focusTransactionId);
    if (index < 0) {
      return;
    }

    focusAppliedRef.current = true;
    const timeout = setTimeout(() => {
      listRef.current?.scrollToIndex({index, animated: true, viewPosition: 0.25});
    }, 180);

    return () => clearTimeout(timeout);
  }, [filteredTransactions, focusToken, focusTransactionId]);

  const openTxModal = (next: TxModal) => {
    reset({amount: 0, note: ''});
    setModal(next);
  };

  const onSubmitTx = async (values: TransactionFormValues) => {
    if (!modal || !canManage) {
      return;
    }
    const parsed = transactionSchema.parse(values);
    const txType = modal;
    reset();
    setModal(null);
    try {
      await onCreateTransaction(txType, parsed);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    }
  };

  const onSubmitEdit = async (values: TransactionFormValues) => {
    if (!editingTransaction || !currentUser) {
      return;
    }
    if (!canEditFinanceTransaction(currentUser, targetUser, editingTransaction, Date.now(), ledger)) {
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
        {balanceSyncViewer: currentUser},
      );
      setEditingTransaction(null);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  const onDeleteEdit = async () => {
    if (!editingTransaction || !currentUser) {
      return;
    }
    if (!canDeleteFinanceTransaction(currentUser, targetUser, editingTransaction, Date.now(), ledger)) {
      Alert.alert(t('error'), t('transactionEditWindowExpired'));
      return;
    }

    setSavingEdit(true);
    try {
      await deleteTransaction(editingTransaction, {balanceSyncViewer: currentUser});
      setEditingTransaction(null);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  const canDeleteEditingTransaction =
    editingTransaction && currentUser
      ? canDeleteFinanceTransaction(currentUser, targetUser, editingTransaction, transactionNow, ledger)
      : false;

  return (
    <>
      <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
        {topContent}
        <View style={[styles.balanceSection, listCard]}>
          <View style={[styles.balanceTopRow, layoutStyle]}>
            <AccountStatementExportButton
              onPress={() => {
                void onExport();
              }}
              loading={exporting}
              size={18}
              style={{width: 32, height: 32, borderRadius: 16}}
            />
            <View style={styles.balanceIconWrap}>
              <MaterialCommunityIcons name="wallet-outline" size={16} color={theme.colors.primary} />
            </View>
            <View style={styles.balanceInfo}>
              <Text style={[styles.accountName, textStyle, {color: theme.typography.primary}]} numberOfLines={1}>
                {accountTitle}
              </Text>
              <Text style={[styles.balanceLabel, textStyle, {color: theme.typography.secondary}]}>
                {balanceLabel}
              </Text>
            </View>
            <View style={styles.balanceAmountCol}>
              <AmountText amount={balance} size="sm" currencyLabel={t('currencyLabel')} />
            </View>
            {onOpenCardMenu ? <FinanceCardOverflowButton onPress={onOpenCardMenu} /> : null}
          </View>
          <FinanceCardCashFlowRow cashIn={cashIn} cashOut={cashOut} />
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
          ref={listRef}
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.txList}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, info.averageItemLength * info.index),
              animated: true,
            });
          }}
          ListEmptyComponent={
            <EmptyState
              icon="cash-multiple"
              message={hasSearchQuery ? t('noTransactionsMatch') : t('noTransactions')}
            />
          }
          renderItem={({item}) => {
            const canEdit = canEditFinanceTransaction(currentUser, targetUser, item, transactionNow, ledger);

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
              error={errors.amount?.message ? t(errors.amount.message) : undefined}
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
              error={errors.note?.message ? t(errors.note.message) : undefined}
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
      <LoadingOverlay visible={exporting || savingEdit || loadingOverlay} />
    </>
  );
};

export default FinanceCardScreen;
