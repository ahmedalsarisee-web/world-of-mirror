import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import FinanceAccountsList, {type FinanceAccountListItem} from '@app/components/finance/FinanceAccountsList';
import FinanceCustomLedgersSection from '@app/components/finance/FinanceCustomLedgersSection';
import FinanceSectionHeader from '@app/components/finance/FinanceSectionHeader';
import FinanceSummaryCards from '@app/components/finance/FinanceSummaryCards';
import SharedFinanceLedgersSection from '@app/components/finance/SharedFinanceLedgersSection';
import IconLabelButton from '@app/components/common/IconLabelButton';
import ListLoadingState from '@app/components/common/ListLoadingState';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {useTheme} from '@app/context/ThemeContext';
import {subscribeToUsers, getFinanceAccounts, subscribeToUser, rebuildAllDelegatedFinanceLedgerAccess} from '@app/services/users.service';
import {getAllTransactions, subscribeToAllTransactions} from '@app/services/transactions.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser} from '@app/types/models';
import type {FinanceStackParamList} from '@app/types/navigation';
import {exportFinanceReport} from '@app/utils/exportFinanceReport';
import {canManageFinanceAccount, canViewFinanceLedger} from '@app/utils/financePermissions';
import {canViewAllFinanceCards} from '@app/utils/adminPermissions';
import {
  computeAdvanceAccountBalance,
  computeFinanceHomePageTotalBalance,
  computeFinanceTotals,
  filterFinanceUsersForViewer,
  filterTransactionsForUsers,
  resolveFinanceAccountDisplayBalance,
} from '@app/utils/financeTotals';

type Nav = NativeStackNavigationProp<FinanceStackParamList, 'FinanceHome'>;

const FinanceHomeScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, isRTL} = useDirection();
  const navigation = useNavigation<Nav>();
  const authUser = useAuthStore((s) => s.user);
  const [liveViewer, setLiveViewer] = useState<AppUser | null>(null);
  const currentUser = liveViewer ?? authUser;
  const isAdmin = currentUser?.role === 'admin';
  const {data: users, isLoading} = useFirestoreSubscription<AppUser[]>([], subscribeToUsers);
  const {data: transactions, isLoading: transactionsLoading} = useFirestoreSubscription(
    [],
    subscribeToAllTransactions,
  );
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!authUser?.id) {
      setLiveViewer(null);
      return;
    }
    return subscribeToUser(authUser.id, setLiveViewer);
  }, [authUser?.id]);

  const delegatedAccessSyncedRef = useRef(false);
  useEffect(() => {
    if (!isAdmin || isLoading || delegatedAccessSyncedRef.current) {
      return;
    }
    delegatedAccessSyncedRef.current = true;
    void rebuildAllDelegatedFinanceLedgerAccess().catch((error) => {
      console.error('[FinanceHomeScreen] rebuild delegated ledger access failed', error);
    });
  }, [isAdmin, isLoading]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        titleRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        },
        titleText: {flex: 1, fontSize: theme.typographyScale.size.lg, fontWeight: '700'},
        employeeTitle: {
          fontSize: theme.typographyScale.size.lg,
          fontWeight: '700',
          marginBottom: theme.spacing.md,
        },
      }),
    [row, theme],
  );

  const financeUsers = useMemo(() => getFinanceAccounts(users), [users]);

  const visibleFinanceUsers = useMemo(
    () => filterFinanceUsersForViewer(currentUser, financeUsers),
    [currentUser, financeUsers],
  );

  /** Include owners whose custom cards this viewer can open (e.g. admin-managed employee cards). */
  const financeLedgerOwners = useMemo(() => {
    if (!currentUser?.id) {
      return visibleFinanceUsers;
    }

    const byId = new Map(visibleFinanceUsers.map((user) => [user.id, user]));

    for (const owner of financeUsers) {
      if (owner.id === currentUser.id || byId.has(owner.id)) {
        continue;
      }

      const hasVisibleLedger = (owner.financeLedgers ?? []).some((ledger) =>
        canViewFinanceLedger(currentUser, owner, ledger),
      );

      if (hasVisibleLedger) {
        byId.set(owner.id, owner);
      }
    }

    return [...byId.values()];
  }, [currentUser, financeUsers, visibleFinanceUsers]);

  const activeTransactions = useMemo(
    () => filterTransactionsForUsers(transactions, visibleFinanceUsers),
    [visibleFinanceUsers, transactions],
  );

  const employeeAccount = useMemo(() => {
    if (!currentUser?.id || isAdmin) {
      return null;
    }
    return financeUsers.find((user) => user.id === currentUser.id) ?? currentUser;
  }, [currentUser, financeUsers, isAdmin]);

  const adminSummary = useMemo(() => {
    if (!isAdmin) {
      return null;
    }

    return {
      totalBalance: computeFinanceHomePageTotalBalance(currentUser, visibleFinanceUsers, activeTransactions),
      ...computeFinanceTotals(activeTransactions),
    };
  }, [activeTransactions, currentUser, isAdmin, visibleFinanceUsers]);

  const accounts = useMemo(() => {
    if (!isAdmin) {
      return employeeAccount ? [employeeAccount] : [];
    }

    const list = visibleFinanceUsers;
    if (!currentUser?.id) {
      return list;
    }

    const balanceFor = (user: AppUser) => {
      const userTransactions = activeTransactions.filter((transaction) => transaction.userId === user.id);
      return resolveFinanceAccountDisplayBalance(user, userTransactions);
    };

    const currentAccount = list.find((user) => user.id === currentUser.id);
    const otherAccounts = list
      .filter((user) => user.id !== currentUser.id)
      .sort((a, b) => balanceFor(b) - balanceFor(a));

    return currentAccount ? [currentAccount, ...otherAccounts] : otherAccounts;
  }, [activeTransactions, currentUser, employeeAccount, isAdmin, visibleFinanceUsers]);

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
          balance: resolveFinanceAccountDisplayBalance(account, accountTransactions),
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
    if (!isAdmin) {
      return;
    }

    setExporting(true);
    try {
      const exportUsers = filterFinanceUsersForViewer(currentUser, getFinanceAccounts(users));
      const exportTransactions = await getAllTransactions(exportUsers);
      const filteredTransactions = filterTransactionsForUsers(exportTransactions, exportUsers);
      if (filteredTransactions.length === 0) {
        Alert.alert(t('error'), t('exportFinanceEmpty'));
        return;
      }
      await exportFinanceReport(exportUsers, filteredTransactions, t, {
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

  const openCustomLedger = (
    ownerUserId: string,
    ownerUserName: string,
    ledgerId: string,
    ledgerName: string,
    ledgerColor: string,
  ) => {
    navigation.navigate('EmployeeCustomLedger', {
      userId: ownerUserId,
      userName: ownerUserName,
      ledgerId,
      ledgerName,
      ledgerColor,
    });
  };

  const accountsLoading = isAdmin ? isLoading : transactionsLoading;

  if (!isAdmin) {
    return (
      <ScreenContainer>
        <Text style={[styles.employeeTitle, textStyle, {color: theme.typography.primary}]}>{t('finance')}</Text>

        <FinanceSectionHeader title={t('myAccount')} style={{marginTop: 0}} />
        {accountsLoading ? (
          <ListLoadingState />
        ) : accountListItems.length > 0 ? (
          <FinanceAccountsList
            accounts={accountListItems}
            currencyLabel={t('currencyLabel')}
            onSelect={(account) => {
              navigation.navigate('EmployeeAccount', {userId: account.id, userName: account.name});
            }}
          />
        ) : null}

        <SharedFinanceLedgersSection
          users={financeUsers}
          transactions={activeTransactions}
          currentUser={currentUser}
          adminOwnedOnly
          onOpenCustomLedger={openCustomLedger}
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

        <FinanceSummaryCards
          cashIn={adminSummary?.cashIn ?? 0}
          cashOut={adminSummary?.cashOut ?? 0}
          totalBalance={adminSummary?.totalBalance ?? 0}
          loading={isLoading || transactionsLoading}
        />

        <FinanceSectionHeader
          title={canViewAllFinanceCards(currentUser) ? t('allAccounts') : t('myAccount')}
          style={{marginTop: theme.spacing.sm}}
        />
        {accountsLoading ? (
          <ListLoadingState />
        ) : accountListItems.length > 0 ? (
          <FinanceAccountsList
            accounts={accountListItems}
            currencyLabel={t('currencyLabel')}
            onSelect={(account) => {
              navigation.navigate('EmployeeAccount', {userId: account.id, userName: account.name});
            }}
          />
        ) : null}

        {currentUser?.id ? (
          <FinanceCustomLedgersSection
            userId={currentUser.id}
            onOpenCustomLedger={(ledgerId, ledgerName, ledgerColor) =>
              openCustomLedger(currentUser.id, currentUser.name, ledgerId, ledgerName, ledgerColor)
            }
          />
        ) : null}

        <SharedFinanceLedgersSection
          users={financeLedgerOwners}
          transactions={activeTransactions}
          currentUser={currentUser}
          onOpenCustomLedger={openCustomLedger}
        />
      </ScreenContainer>
      <LoadingOverlay visible={exporting} />
    </>
  );
};

export default FinanceHomeScreen;
