import React, {useMemo, useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import EmployeeFinanceHubPanel from '@app/components/finance/EmployeeFinanceHubPanel';
import FinanceCustomLedgersSection from '@app/components/finance/FinanceCustomLedgersSection';
import FinanceSummaryCards from '@app/components/finance/FinanceSummaryCards';
import FinanceAccountsList, {type FinanceAccountListItem} from '@app/components/finance/FinanceAccountsList';
import IconLabelButton from '@app/components/common/IconLabelButton';
import ListLoadingState from '@app/components/common/ListLoadingState';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {useTheme} from '@app/context/ThemeContext';
import {subscribeToUsers, getFinanceAccounts} from '@app/services/users.service';
import {getAllTransactions, subscribeToAllTransactions} from '@app/services/transactions.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser} from '@app/types/models';
import type {FinanceStackParamList} from '@app/types/navigation';
import {exportFinanceReport} from '@app/utils/exportFinanceReport';
import {canManageFinanceAccount} from '@app/utils/financePermissions';
import {
  computeAdvanceAccountBalance,
  computeFinanceTotals,
  filterTransactionsForUsers,
  resolveAccountBalance,
  resolveEmployeeFinanceTotalBalance,
} from '@app/utils/financeTotals';

type Nav = NativeStackNavigationProp<FinanceStackParamList, 'FinanceHome'>;

const FinanceHomeScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, isRTL} = useDirection();
  const navigation = useNavigation<Nav>();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const {data: users, isLoading} = useFirestoreSubscription<AppUser[]>([], subscribeToUsers);
  const {data: transactions, isLoading: transactionsLoading} = useFirestoreSubscription(
    [],
    subscribeToAllTransactions,
  );
  const [exporting, setExporting] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: {fontSize: theme.typographyScale.size.xl, fontWeight: '700', marginBottom: theme.spacing.lg},
        titleRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.xl,
        },
        titleText: {flex: 1, fontSize: theme.typographyScale.size.xl, fontWeight: '700'},
        summarySectionTitle: {
          fontSize: theme.typographyScale.size.lg,
          fontWeight: '600',
          marginBottom: theme.spacing.md,
        },
        sectionTitle: {
          fontSize: theme.typographyScale.size.lg,
          fontWeight: '600',
          flex: 1,
          marginBottom: theme.spacing.md,
        },
      }),
    [row, theme],
  );

  const financeUsers = useMemo(() => getFinanceAccounts(users), [users]);

  const activeTransactions = useMemo(
    () => filterTransactionsForUsers(transactions, financeUsers),
    [financeUsers, transactions],
  );

  const globalBalance = useMemo(
    () =>
      financeUsers.reduce((sum, user) => {
        const userTransactions = activeTransactions.filter((transaction) => transaction.userId === user.id);
        return sum + resolveAccountBalance(user.balance, userTransactions);
      }, 0),
    [activeTransactions, financeUsers],
  );

  const {cashIn, cashOut} = useMemo(() => computeFinanceTotals(activeTransactions), [activeTransactions]);

  const accounts = useMemo(() => {
    const list = financeUsers;
    if (!currentUser?.id) {
      return list;
    }

    const balanceFor = (user: AppUser) => {
      const userTransactions = activeTransactions.filter((transaction) => transaction.userId === user.id);
      if (user.role === 'employee') {
        return resolveEmployeeFinanceTotalBalance(user.balance, userTransactions);
      }
      return resolveAccountBalance(user.balance, userTransactions);
    };

    const currentAccount = list.find((user) => user.id === currentUser.id);
    const otherAccounts = list
      .filter((user) => user.id !== currentUser.id)
      .sort((a, b) => balanceFor(b) - balanceFor(a));

    return currentAccount ? [currentAccount, ...otherAccounts] : otherAccounts;
  }, [activeTransactions, currentUser?.id, financeUsers]);

  const accountListItems = useMemo<FinanceAccountListItem[]>(
    () =>
      accounts.map((account) => {
        const accountTransactions = activeTransactions.filter((tx) => tx.userId === account.id);
        const lastTransactionAt =
          accountTransactions.length > 0
            ? accountTransactions.reduce((latest, tx) =>
                tx.createdAt.localeCompare(latest) > 0 ? tx.createdAt : latest,
              accountTransactions[0].createdAt)
            : null;

        const advanceAccountBalance = computeAdvanceAccountBalance(accountTransactions);

        return {
          account,
          balance:
            account.role === 'employee'
              ? resolveEmployeeFinanceTotalBalance(account.balance, accountTransactions)
              : resolveAccountBalance(account.balance, accountTransactions),
          transactionCount: accountTransactions.length,
          lastTransactionAt,
          advanceBalance:
            account.role === 'employee' ? Math.max(0, -advanceAccountBalance) : 0,
          viewOnly: !canManageFinanceAccount(currentUser, account) && account.role === 'admin',
        };
      }),
    [accounts, activeTransactions, currentUser],
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportUsers = getFinanceAccounts(users);
      const exportTransactions = await getAllTransactions(exportUsers);
      const scopedTransactions = filterTransactionsForUsers(exportTransactions, exportUsers);
      if (scopedTransactions.length === 0) {
        Alert.alert(t('error'), t('exportFinanceEmpty'));
        return;
      }
      await exportFinanceReport(exportUsers, scopedTransactions, t, {
        isRtl: isRTL,
        appName: t('appName'),
      });
    } catch (error) {
      console.error('[FinanceHomeScreen] export failed', error);
      Alert.alert(t('error'), t('exportFinanceFailed'));
    } finally {
      setExporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <ScreenContainer>
        <EmployeeFinanceHubPanel
          userId={currentUser?.id ?? ''}
          userName={currentUser?.name ?? ''}
          wrapInScreenContainer={false}
          onOpenCashAccount={() =>
            navigation.navigate('EmployeeAccount', {
              userId: currentUser?.id ?? '',
              userName: currentUser?.name ?? '',
            })
          }
          onOpenSalaryAdvance={() =>
            navigation.navigate('EmployeeAdvance', {
              userId: currentUser?.id ?? '',
              userName: currentUser?.name ?? '',
            })
          }
          onOpenCustomLedger={(ledgerId, ledgerName, ledgerColor) =>
            navigation.navigate('EmployeeCustomLedger', {
              userId: currentUser?.id ?? '',
              userName: currentUser?.name ?? '',
              ledgerId,
              ledgerName,
              ledgerColor,
            })
          }
        />
      </ScreenContainer>
    );
  }

  return (
    <>
      <ScreenContainer>
        <View style={[styles.titleRow, layoutStyle]}>
          <Text style={[styles.titleText, textStyle, {color: theme.typography.primary}]}>{t('finance')}</Text>
          <IconLabelButton label={t('exportFinance')} icon="download" onPress={handleExport} />
        </View>

        <Text style={[styles.summarySectionTitle, textStyle, {color: theme.typography.primary}]}>
          {t('globalCashBalance')}
        </Text>
        <FinanceSummaryCards
          cashIn={cashIn}
          cashOut={cashOut}
          totalBalance={globalBalance}
          loading={isLoading || transactionsLoading}
        />

        <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary, marginBottom: 12}]}>
          {t('allAccounts')}
        </Text>
        {isLoading ? (
          <ListLoadingState />
        ) : (
          <FinanceAccountsList
            accounts={accountListItems}
            currencyLabel={t('currencyLabel')}
            onSelect={(account) => {
              if (account.role === 'employee' || account.id === currentUser?.id) {
                navigation.navigate('EmployeeFinanceHub', {
                  userId: account.id,
                  userName: account.name,
                });
                return;
              }
              navigation.navigate('EmployeeAccount', {userId: account.id, userName: account.name});
            }}
          />
        )}

        {currentUser?.id ? (
          <FinanceCustomLedgersSection
            userId={currentUser.id}
            onOpenCustomLedger={(ledgerId, ledgerName, ledgerColor) =>
              navigation.navigate('EmployeeCustomLedger', {
                userId: currentUser.id,
                userName: currentUser.name,
                ledgerId,
                ledgerName,
                ledgerColor,
              })
            }
          />
        ) : null}
      </ScreenContainer>
      <LoadingOverlay visible={exporting} />
    </>
  );
};

export default FinanceHomeScreen;
