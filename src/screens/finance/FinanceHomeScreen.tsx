import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, InteractionManager, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import FinanceAccountsList, {type FinanceAccountListItem} from '@app/components/finance/FinanceAccountsList';
import AddFinanceLedgerSheet from '@app/components/finance/AddFinanceLedgerSheet';
import {
  FinanceCardOptionsSheet,
  type FinanceCardMenuItem,
} from '@app/components/finance/FinanceCardOverflowMenu';
import FinanceCustomLedgersSection from '@app/components/finance/FinanceCustomLedgersSection';
import FinanceSectionHeader from '@app/components/finance/FinanceSectionHeader';
import FinanceSummaryCards from '@app/components/finance/FinanceSummaryCards';
import SharedFinanceLedgersSection, {
  buildSharedFinanceLedgerItems,
} from '@app/components/finance/SharedFinanceLedgersSection';
import EmptyState from '@app/components/common/EmptyState';
import FinanceExportSheet from '@app/components/finance/FinanceExportSheet';
import IconLabelButton from '@app/components/common/IconLabelButton';
import ListLoadingState from '@app/components/common/ListLoadingState';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenContainer from '@app/components/common/ScreenContainer';
import ScreenHeader from '@app/components/common/ScreenHeader';
import {useDirection} from '@app/hooks/useDirection';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {useFinanceLedgerOwnerProfiles, mergeFinanceDirectoryUsers, resolveFinanceOwnerIdsForSharedCards} from '@app/hooks/useFinanceLedgerOwnerProfiles';
import {useFinanceAccountTransactions} from '@app/hooks/useFinanceAccountTransactions';
import {useUsersDirectory} from '@app/hooks/useUsersDirectory';
import {useTheme} from '@app/context/ThemeContext';
import {getFinanceAccounts, rebuildAllDelegatedFinanceLedgerAccess, deleteUser, updateFinanceCardLabel} from '@app/services/users.service';
import {getAllTransactions, subscribeToSharedLedgerTransactions} from '@app/services/transactions.service';
import {getDeleteUserErrorKey} from '@app/services/auth.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, Transaction} from '@app/types/models';
import type {FinanceStackParamList} from '@app/types/navigation';
import {exportFinanceReport} from '@app/utils/exportFinanceReport';
import {filterRecordsByDateRange} from '@app/utils/reportDateRange';
import {
  canManageFinanceAccount,
  canViewFinanceLedger,
  shouldListSharedFinanceLedgerForViewer,
} from '@app/utils/financePermissions';
import {canAccessFinanceTab} from '@app/utils/employeePermissions';
import {canViewAllFinanceCards, canDeleteUser, isPrimaryAdmin} from '@app/utils/adminPermissions';
import {parseDelegatedFinanceLedgerAccessKey, getDelegatedFinanceLedgerOwnerIds, hasDelegatedFinanceLedgerScope} from '@app/utils/financeLedgers';
import {
  computeAdvanceAccountBalance,
  computeFinanceHomeCashFlowTotals,
  computeFinanceHomePageTotalBalance,
  filterFinanceUsersForViewer,
  filterTransactionsForUsers,
  resolveFinanceAccountDisplayBalance,
} from '@app/utils/financeTotals';
import {getLatestTransactionAt, indexTransactionsByUserId} from '@app/utils/transactionsIndex';

type Nav = NativeStackNavigationProp<FinanceStackParamList, 'FinanceHome'>;

const FinanceHomeScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {isRTL} = useDirection();
  const navigation = useNavigation<Nav>();
  const authUser = useAuthStore((s) => s.user);
  const authEmail = useAuthStore((s) => s.authEmail);
  const currentUser = authUser;
  const isPrimaryAdminViewer = isPrimaryAdmin(currentUser, authEmail);
  const isAdmin = currentUser?.role === 'admin';
  const hasSharedFinanceOnlyView = !isAdmin;
  const needsFinanceOwnerDirectory = !isAdmin && canAccessFinanceTab(currentUser);

  const loadAllUsersDirectory = isAdmin;
  const {users: allUsers, isLoading: allUsersLoading} = useUsersDirectory('all', loadAllUsersDirectory);
  const delegatedFinanceOwnerIds = useMemo(
    () => getDelegatedFinanceLedgerOwnerIds(currentUser),
    [currentUser?.delegatedFinanceLedgerAccess],
  );
  const {owners: liveFinanceOwners, isLoading: liveFinanceOwnersLoading} = useFinanceLedgerOwnerProfiles(
    currentUser,
    delegatedFinanceOwnerIds,
    needsFinanceOwnerDirectory && !loadAllUsersDirectory,
  );
  const users = useMemo(() => {
    if (isAdmin) {
      return allUsers;
    }

    const byId = new Map<string, AppUser>();
    if (currentUser?.id) {
      byId.set(currentUser.id, currentUser);
    }
    for (const owner of liveFinanceOwners) {
      byId.set(owner.id, owner);
    }
    return [...byId.values()];
  }, [allUsers, currentUser, isAdmin, liveFinanceOwners]);
  const isLoading = isAdmin ? allUsersLoading : liveFinanceOwnersLoading;

  const financeUsers = useMemo(() => getFinanceAccounts(users), [users]);
  const financeOwnerIds = useMemo(() => {
    if (isAdmin) {
      return resolveFinanceOwnerIdsForSharedCards(currentUser, financeUsers);
    }
    return delegatedFinanceOwnerIds;
  }, [currentUser, delegatedFinanceOwnerIds, financeUsers, isAdmin]);
  const {owners: liveFinanceOwnersForManagers, isLoading: liveFinanceOwnersForManagersLoading} =
    useFinanceLedgerOwnerProfiles(
      currentUser,
      financeOwnerIds,
      isAdmin,
    );
  const resolvedLiveFinanceOwners = isAdmin ? liveFinanceOwnersForManagers : liveFinanceOwners;
  const resolvedLiveFinanceOwnersLoading = isAdmin
    ? liveFinanceOwnersForManagersLoading
    : liveFinanceOwnersLoading;
  const financeDirectoryUsers = useMemo(
    () => mergeFinanceDirectoryUsers(financeUsers, resolvedLiveFinanceOwners),
    [financeUsers, resolvedLiveFinanceOwners],
  );

  const sharedLedgerScopes = useMemo(() => {
    if (!currentUser?.id || !needsFinanceOwnerDirectory) {
      return [];
    }

    const scopes: Array<{userId: string; ledgerId: string}> = [];
    const included = new Set<string>();

    const addScope = (userId: string, ledgerId: string) => {
      const key = `${userId}:${ledgerId}`;
      if (included.has(key)) {
        return;
      }
      included.add(key);
      scopes.push({userId, ledgerId});
    };

    for (const accessKey of currentUser.delegatedFinanceLedgerAccess ?? []) {
      const parsed = parseDelegatedFinanceLedgerAccessKey(accessKey);
      if (!parsed) {
        continue;
      }
      addScope(parsed.ownerUserId, parsed.ledgerId);
    }

    for (const owner of financeDirectoryUsers) {
      if (owner.role !== 'admin') {
        continue;
      }

      for (const ledger of owner.financeLedgers ?? []) {
        if (
          !shouldListSharedFinanceLedgerForViewer(currentUser, owner, ledger, {
            adminOwnedOnly: hasSharedFinanceOnlyView,
          })
        ) {
          continue;
        }
        addScope(owner.id, ledger.id);
      }
    }

    return scopes;
  }, [currentUser, financeDirectoryUsers, hasSharedFinanceOnlyView, needsFinanceOwnerDirectory]);

  const sharedLedgerTransactionScopes = useMemo(
    () =>
      sharedLedgerScopes.filter((scope) =>
        hasDelegatedFinanceLedgerScope(currentUser, scope.userId, scope.ledgerId),
      ),
    [currentUser, sharedLedgerScopes],
  );

  const financeUserIdsForTransactions = useMemo(() => {
    if (!isAdmin) {
      return [];
    }
    return filterFinanceUsersForViewer(currentUser, financeUsers).map((user) => user.id);
  }, [currentUser, financeUsers, isAdmin]);

  const sharedLedgerScopesKey = sharedLedgerTransactionScopes
    .map((scope) => `${scope.userId}:${scope.ledgerId}`)
    .join('|');
  const needsSharedLedgerTransactions = sharedLedgerTransactionScopes.length > 0;
  const needsAccountTransactions =
    !hasSharedFinanceOnlyView && financeUserIdsForTransactions.length > 0;

  const {data: sharedTransactions, isLoading: sharedTransactionsLoading} = useFirestoreSubscription(
    [],
    (callback) => subscribeToSharedLedgerTransactions(sharedLedgerTransactionScopes, callback),
    [sharedLedgerScopesKey],
    {enabled: needsSharedLedgerTransactions},
  );

  const {transactions: accountTransactions, isLoading: accountTransactionsLoading} =
    useFinanceAccountTransactions(
      financeUserIdsForTransactions,
      needsAccountTransactions,
    );

  const transactions = useMemo(() => {
    if (hasSharedFinanceOnlyView) {
      return sharedTransactions;
    }
    if (!needsSharedLedgerTransactions) {
      return accountTransactions;
    }
    const merged = new Map<string, Transaction>();
    for (const transaction of [...sharedTransactions, ...accountTransactions]) {
      merged.set(transaction.id, transaction);
    }
    return [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [
    accountTransactions,
    hasSharedFinanceOnlyView,
    needsSharedLedgerTransactions,
    sharedTransactions,
  ]);

  const transactionsLoading = hasSharedFinanceOnlyView
    ? sharedTransactionsLoading
    : needsSharedLedgerTransactions && needsAccountTransactions
      ? sharedTransactionsLoading || accountTransactionsLoading
      : needsSharedLedgerTransactions
        ? sharedTransactionsLoading
        : accountTransactionsLoading;
  const [exporting, setExporting] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [menuAccountId, setMenuAccountId] = useState<string | null>(null);
  const [cardMenuVisible, setCardMenuVisible] = useState(false);
  const [renameAccountId, setRenameAccountId] = useState<string | null>(null);
  const [renameInitialName, setRenameInitialName] = useState('');
  const [savingAccountCard, setSavingAccountCard] = useState(false);

  const delegatedAccessSyncedRef = useRef(false);
  useEffect(() => {
    if (!isAdmin || isLoading || delegatedAccessSyncedRef.current) {
      return;
    }
    delegatedAccessSyncedRef.current = true;
    const task = InteractionManager.runAfterInteractions(() => {
      void rebuildAllDelegatedFinanceLedgerAccess().catch((error) => {
        console.error('[FinanceHomeScreen] rebuild delegated ledger access failed', error);
      });
    });
    return () => {
      task.cancel();
    };
  }, [isAdmin, isLoading]);

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

    for (const owner of financeDirectoryUsers) {
      if (owner.id === currentUser.id || byId.has(owner.id)) {
        continue;
      }

      if (owner.role === 'employee') {
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
  }, [currentUser, financeDirectoryUsers, visibleFinanceUsers]);

  const activeTransactions = useMemo(
    () => filterTransactionsForUsers(transactions, visibleFinanceUsers),
    [visibleFinanceUsers, transactions],
  );

  const transactionsByUserId = useMemo(
    () => indexTransactionsByUserId(activeTransactions),
    [activeTransactions],
  );

  const ownAccountTransactions = useMemo(() => {
    if (!currentUser?.id) {
      return [];
    }
    return activeTransactions.filter((transaction) => transaction.userId === currentUser.id);
  }, [activeTransactions, currentUser?.id]);

  const financePageSummary = useMemo(() => {
    if (!currentUser?.id) {
      return null;
    }

    const summaryOwners = isAdmin ? visibleFinanceUsers : financeLedgerOwners;
    const summaryTransactions = filterTransactionsForUsers(transactions, summaryOwners);

    return {
      totalBalance: computeFinanceHomePageTotalBalance(
        currentUser,
        financeUsers,
        summaryTransactions,
      ),
      ...computeFinanceHomeCashFlowTotals(summaryTransactions, summaryOwners),
    };
  }, [currentUser, financeLedgerOwners, financeUsers, isAdmin, transactions, visibleFinanceUsers]);

  const accounts = useMemo(() => {
    if (!isAdmin) {
      return [];
    }

    const list = visibleFinanceUsers;
    if (!currentUser?.id) {
      return list;
    }

    const balanceFor = (user: AppUser) => {
      const userTransactions = transactionsByUserId.get(user.id) ?? [];
      return resolveFinanceAccountDisplayBalance(user, userTransactions);
    };

    const currentAccount = list.find((user) => user.id === currentUser.id);
    const otherAccounts = list
      .filter((user) => user.id !== currentUser.id)
      .sort((a, b) => balanceFor(b) - balanceFor(a));

    return currentAccount ? [currentAccount, ...otherAccounts] : otherAccounts;
  }, [
    currentUser,
    isAdmin,
    transactionsByUserId,
    visibleFinanceUsers,
  ]);

  const sharedFinanceLedgerItems = useMemo(
    () =>
      buildSharedFinanceLedgerItems(financeDirectoryUsers, transactions, currentUser, {
        adminOwnedOnly: hasSharedFinanceOnlyView,
      }),
    [currentUser, financeDirectoryUsers, hasSharedFinanceOnlyView, transactions],
  );

  const accountListItems = useMemo<FinanceAccountListItem[]>(
    () =>
      accounts.map((account) => {
        const accountTransactions = transactionsByUserId.get(account.id) ?? [];
        const lastTransactionAt = getLatestTransactionAt(accountTransactions);
        const advanceAccountBalance = computeAdvanceAccountBalance(accountTransactions);
        const customCardLabel = account.financeCardLabels?.cash?.trim();
        const displayTitle = customCardLabel || account.name;
        const canManageAccount = canManageFinanceAccount(currentUser, account);
        const showAccountMenu = isPrimaryAdminViewer && isAdmin && canManageAccount;

        return {
          account,
          title: displayTitle,
          balance: resolveFinanceAccountDisplayBalance(account, accountTransactions),
          transactionCount: accountTransactions.length,
          lastTransactionAt,
          advanceBalance:
            account.role === 'employee' ? Math.max(0, -advanceAccountBalance) : 0,
          viewOnly: !canManageAccount,
          onOpenMenu: showAccountMenu ? () => {
            setMenuAccountId(account.id);
            setCardMenuVisible(true);
          } : undefined,
        };
      }),
    [accounts, currentUser, isAdmin, isPrimaryAdminViewer, transactionsByUserId],
  );

  const menuAccount = useMemo(
    () => accounts.find((account) => account.id === menuAccountId) ?? null,
    [accounts, menuAccountId],
  );

  const openRenameAccount = useCallback((account: AppUser) => {
    const customCardLabel = account.financeCardLabels?.cash?.trim();
    setRenameInitialName(customCardLabel || account.name);
    setRenameAccountId(account.id);
  }, []);

  const handleDeleteAccountCard = useCallback(() => {
    if (!menuAccount || !currentUser) {
      return;
    }

    const confirmTitle =
      menuAccount.role === 'employee' ? t('deleteEmployee') : t('deleteAdmin');
    const confirmMessage =
      menuAccount.role === 'employee'
        ? t('deleteEmployeeConfirm', {name: menuAccount.name})
        : t('deleteAdminConfirm', {name: menuAccount.name});

    Alert.alert(confirmTitle, confirmMessage, [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSavingAccountCard(true);
            try {
              await deleteUser(menuAccount.id);
            } catch (error) {
              Alert.alert(t('error'), t(getDeleteUserErrorKey(error)));
            } finally {
              setSavingAccountCard(false);
            }
          })();
        },
      },
    ]);
  }, [currentUser, menuAccount, t]);

  const accountCardMenuItems = useMemo<FinanceCardMenuItem[]>(() => {
    if (!menuAccount || !currentUser) {
      return [];
    }

    const canDelete =
      menuAccount.id !== currentUser.id &&
      canDeleteUser(currentUser, menuAccount, authEmail);

    const items: FinanceCardMenuItem[] = [
      {
        key: 'delete',
        label: t('deleteFinanceLedger'),
        destructive: true,
        disabled: savingAccountCard || !canDelete,
        onPress: handleDeleteAccountCard,
      },
      {
        key: 'rename',
        label: t('renameFinanceLedger'),
        disabled: savingAccountCard,
        onPress: () => openRenameAccount(menuAccount),
      },
    ];

    return canDelete ? items : items.filter((item) => item.key !== 'delete');
  }, [
    authEmail,
    currentUser,
    handleDeleteAccountCard,
    menuAccount,
    openRenameAccount,
    savingAccountCard,
    t,
  ]);

  const handleRenameAccountCard = async (name: string) => {
    if (!renameAccountId) {
      return;
    }
    setSavingAccountCard(true);
    try {
      await updateFinanceCardLabel(renameAccountId, 'cash', name);
      setRenameAccountId(null);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingAccountCard(false);
    }
  };

  const handleExport = async (startDate: string, endDate: string) => {
    if (!isAdmin) {
      return;
    }

    setExporting(true);
    try {
      const exportUsers = filterFinanceUsersForViewer(currentUser, getFinanceAccounts(users));
      const exportTransactions = await getAllTransactions(exportUsers);
      const userScopedTransactions = filterTransactionsForUsers(exportTransactions, exportUsers);
      const filteredTransactions = filterRecordsByDateRange(
        userScopedTransactions,
        startDate,
        endDate,
      );
      if (filteredTransactions.length === 0) {
        Alert.alert(t('error'), t('financeExportPeriodEmpty'));
        return;
      }
      await exportFinanceReport(exportUsers, filteredTransactions, t, {
        isRtl: isRTL,
        appName: t('appName'),
        startDate,
        endDate,
      });
      setExportSheetOpen(false);
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

  const accountsLoading = isAdmin
    ? isLoading
    : resolvedLiveFinanceOwnersLoading ||
      (sharedLedgerTransactionScopes.length > 0 && transactionsLoading);

  if (!isAdmin) {
    if (accountsLoading) {
      return (
        <>
          <ScreenHeader title={t('finance')} />
          <ScreenContainer>
            <ListLoadingState />
          </ScreenContainer>
        </>
      );
    }

    if (sharedFinanceLedgerItems.length === 0 && sharedLedgerScopes.length === 0) {
      return (
        <>
          <ScreenHeader title={t('finance')} />
          <ScreenContainer>
            <EmptyState icon="wallet-outline" message={t('financeNoSharedCards')} />
          </ScreenContainer>
        </>
      );
    }

    if (sharedFinanceLedgerItems.length === 0 && sharedLedgerScopes.length > 0) {
      return (
        <>
          <ScreenHeader title={t('finance')} />
          <ScreenContainer>
            <ListLoadingState />
          </ScreenContainer>
        </>
      );
    }

    return (
      <>
        <ScreenHeader title={t('finance')} />
        <ScreenContainer>
          <SharedFinanceLedgersSection
            users={financeDirectoryUsers}
            transactions={transactions}
            currentUser={currentUser}
            adminOwnedOnly
            onOpenCustomLedger={openCustomLedger}
          />
        </ScreenContainer>
      </>
    );
  }

  return (
    <>
      <ScreenHeader
        title={t('finance')}
        endAction={
          <IconLabelButton
            label={t('exportFinance')}
            icon="download"
            onPress={() => setExportSheetOpen(true)}
          />
        }
      />
      <ScreenContainer>
        <FinanceSummaryCards
          cashIn={financePageSummary?.cashIn ?? 0}
          cashOut={financePageSummary?.cashOut ?? 0}
          totalBalance={financePageSummary?.totalBalance ?? 0}
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
          <>
            <FinanceCustomLedgersSection
              userId={currentUser.id}
              directoryUsers={users}
              transactions={ownAccountTransactions}
              onOpenCustomLedger={(ledgerId, ledgerName, ledgerColor) =>
                openCustomLedger(currentUser.id, currentUser.name, ledgerId, ledgerName, ledgerColor)
              }
            />
            <FinanceCustomLedgersSection
              userId={currentUser.id}
              memoOnlyMode
              directoryUsers={users}
              transactions={ownAccountTransactions}
              onOpenCustomLedger={(ledgerId, ledgerName, ledgerColor) =>
                openCustomLedger(currentUser.id, currentUser.name, ledgerId, ledgerName, ledgerColor)
              }
            />
          </>
        ) : null}

        <SharedFinanceLedgersSection
          users={financeLedgerOwners}
          transactions={activeTransactions}
          currentUser={currentUser}
          onOpenCustomLedger={openCustomLedger}
        />
      </ScreenContainer>
      <FinanceExportSheet
        visible={exportSheetOpen}
        saving={exporting}
        onClose={() => setExportSheetOpen(false)}
        onExport={handleExport}
      />
      <FinanceCardOptionsSheet
        visible={cardMenuVisible}
        items={accountCardMenuItems}
        onClose={() => {
          setCardMenuVisible(false);
          setMenuAccountId(null);
        }}
      />
      <AddFinanceLedgerSheet
        visible={renameAccountId !== null}
        mode="rename"
        initialName={renameInitialName}
        saving={savingAccountCard}
        onClose={() => setRenameAccountId(null)}
        onSave={handleRenameAccountCard}
      />
      <LoadingOverlay visible={exporting || savingAccountCard} />
    </>
  );
};

export default FinanceHomeScreen;
