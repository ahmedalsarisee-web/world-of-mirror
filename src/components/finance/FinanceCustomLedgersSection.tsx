import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import AddFinanceLedgerSheet from '@app/components/finance/AddFinanceLedgerSheet';
import {
  FinanceCardOptionsSheet,
  type FinanceCardMenuItem,
} from '@app/components/finance/FinanceCardOverflowMenu';
import FinanceCustomLedgersList, {
  type FinanceCustomLedgerListItem,
} from '@app/components/finance/FinanceCustomLedgersList';
import FinanceSectionHeader from '@app/components/finance/FinanceSectionHeader';
import {useDirection} from '@app/hooks/useDirection';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {useUsersDirectory} from '@app/hooks/useUsersDirectory';
import {useTheme} from '@app/context/ThemeContext';
import {
  deleteLedgerTransactionsForUser,
  subscribeToSharedLedgerTransactions,
  subscribeToUserTransactions,
} from '@app/services/transactions.service';
import FinanceLedgerVisibilitySheet from '@app/components/finance/FinanceLedgerVisibilitySheet';
import {
  addFinanceLedger,
  deleteFinanceLedger,
  getFinanceAccounts,
  renameFinanceLedger,
  subscribeToUser,
  updateFinanceLedgerMemoOnly,
  updateFinanceLedgerVisibility,
} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, EmployeeFinanceLedger, Transaction} from '@app/types/models';
import {isPrimaryAdmin} from '@app/utils/adminPermissions';
import {canAccessFinanceTab} from '@app/utils/employeePermissions';
import {
  canAddFinanceLedger,
  canClearFinanceLedgerTransactions,
  canManageFinanceLedgerEntry,
  canToggleFinanceLedgerMemoMode,
  filterVisibleFinanceLedgers,
} from '@app/utils/financePermissions';
import {isMemoFinanceLedger, resolveCustomLedgerColor, sortFinanceLedgersByCreatedAt} from '@app/utils/financeLedgers';
import {computeCustomLedgerBalance, getCustomLedgerStats} from '@app/utils/financeTotals';

interface Props {
  userId: string;
  memoOnlyMode?: boolean;
  allLedgersMode?: boolean;
  showAddButton?: boolean;
  sectionTitle?: string;
  directoryUsers?: AppUser[];
  transactions?: Transaction[];
  onOpenCustomLedger: (ledgerId: string, ledgerName: string, ledgerColor: string) => void;
}

const FinanceCustomLedgersSection: React.FC<Props> = ({
  userId,
  memoOnlyMode = false,
  allLedgersMode = false,
  showAddButton = true,
  sectionTitle,
  directoryUsers: directoryUsersProp,
  transactions: transactionsProp,
  onOpenCustomLedger,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const currentUser = useAuthStore((s) => s.user);
  const authEmail = useAuthStore((s) => s.authEmail);
  const isPrimaryAdminViewer = isPrimaryAdmin(currentUser, authEmail);
  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const [addLedgerVisible, setAddLedgerVisible] = useState(false);
  const [renameLedgerId, setRenameLedgerId] = useState<string | null>(null);
  const [renameInitialName, setRenameInitialName] = useState('');
  const [savingLedger, setSavingLedger] = useState(false);
  const [clearingLedgerId, setClearingLedgerId] = useState<string | null>(null);
  const [menuLedgerId, setMenuLedgerId] = useState<string | null>(null);
  const [cardMenuVisible, setCardMenuVisible] = useState(false);
  const [visibilityLedgerId, setVisibilityLedgerId] = useState<string | null>(null);
  const isAdmin = currentUser?.role === 'admin';
  const needsUserDirectory = directoryUsersProp === undefined && isAdmin;
  const {users: allUsers} = useUsersDirectory('all', needsUserDirectory);
  const directoryUsers = directoryUsersProp ?? (isAdmin ? allUsers : currentUser ? [currentUser] : []);
  const canToggleMemoMode = targetUser ? canToggleFinanceLedgerMemoMode(currentUser, targetUser) : false;

  const canAddLedgers =
    showAddButton && targetUser ? canAddFinanceLedger(currentUser, targetUser) : false;
  const customLedgers = useMemo(() => {
    if (!targetUser) {
      return [];
    }
    const visible = sortFinanceLedgersByCreatedAt(
      filterVisibleFinanceLedgers(currentUser, targetUser, targetUser.financeLedgers ?? []),
    );
    if (allLedgersMode) {
      return visible;
    }
    return memoOnlyMode
      ? visible.filter((ledger) => isMemoFinanceLedger(ledger))
      : visible.filter((ledger) => !isMemoFinanceLedger(ledger));
  }, [allLedgersMode, currentUser, memoOnlyMode, targetUser]);

  const visibilityUsers = useMemo(
    () =>
      getFinanceAccounts(directoryUsers).filter(
        (user) => user.id !== userId && canAccessFinanceTab(user),
      ),
    [directoryUsers, userId],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginTop: 0,
        },
        hint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
          marginBottom: theme.spacing.xs,
        },
        addBtn: {
          marginTop: theme.spacing.xs,
        },
      }),
    [theme],
  );

  const isEmployeeViewingAdminLedgers = Boolean(
    currentUser?.role === 'employee' &&
      currentUser.id !== userId &&
      (targetUser == null || targetUser.role === 'admin'),
  );
  const sharedLedgerScopes = useMemo(
    () => customLedgers.map((ledger) => ({userId, ledgerId: ledger.id})),
    [customLedgers, userId],
  );
  const sharedLedgerScopesKey = sharedLedgerScopes
    .map((scope) => `${scope.userId}:${scope.ledgerId}`)
    .join('|');

  const {data: subscribedTransactions} = useFirestoreSubscription<Transaction[]>(
    [],
    (callback) => {
      if (isEmployeeViewingAdminLedgers) {
        return subscribeToSharedLedgerTransactions(sharedLedgerScopes, callback);
      }
      return subscribeToUserTransactions(userId, callback);
    },
    [isEmployeeViewingAdminLedgers, sharedLedgerScopesKey, userId],
    {
      enabled:
        transactionsProp === undefined &&
        Boolean(userId) &&
        (!isEmployeeViewingAdminLedgers || sharedLedgerScopes.length > 0),
    },
  );
  const transactions = transactionsProp ?? subscribedTransactions;

  useEffect(() => {
    if (!userId) return;
    return subscribeToUser(userId, setTargetUser);
  }, [userId]);

  const openRename = useCallback((ledgerId: string, initialName: string) => {
    setRenameInitialName(initialName);
    setRenameLedgerId(ledgerId);
  }, []);

  const openCardMenu = useCallback((ledgerId: string) => {
    setMenuLedgerId(ledgerId);
    setCardMenuVisible(true);
  }, []);

  const menuLedger = useMemo(
    () => customLedgers.find((ledger) => ledger.id === menuLedgerId) ?? null,
    [customLedgers, menuLedgerId],
  );

  const visibilityLedger = useMemo(
    () => customLedgers.find((ledger) => ledger.id === visibilityLedgerId) ?? null,
    [customLedgers, visibilityLedgerId],
  );

  const menuLedgerTransactions = useMemo(() => {
    if (!menuLedger) {
      return [];
    }
    return transactions.filter((tx) => tx.ledgerId === menuLedger.id);
  }, [menuLedger, transactions]);

  const handleToggleMemoMode = useCallback(
    (ledger: EmployeeFinanceLedger) => {
      if (!targetUser || !canToggleMemoMode) {
        return;
      }

      const nextMemoOnly = !isMemoFinanceLedger(ledger);
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
                  await updateFinanceLedgerMemoOnly(userId, ledger.id, nextMemoOnly);
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
    },
    [canToggleMemoMode, t, targetUser, userId],
  );

  const handleClearLedgerTransactions = useCallback(
    (ledger: EmployeeFinanceLedger) => {
      if (!targetUser) {
        return;
      }
      if (!canClearFinanceLedgerTransactions(currentUser, targetUser, ledger)) {
        return;
      }
      const ledgerTxCount = getCustomLedgerStats(transactions, ledger.id).transactionCount;
      if (ledgerTxCount === 0) {
        return;
      }

      Alert.alert(t('clearLedgerTransactions'), t('clearLedgerTransactionsConfirm', {name: ledger.name}), [
        {text: t('cancel'), style: 'cancel'},
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setClearingLedgerId(ledger.id);
              try {
                await deleteLedgerTransactionsForUser(userId, ledger.id, transactions);
              } catch {
                Alert.alert(t('error'), t('saveFailed'));
              } finally {
                setClearingLedgerId(null);
              }
            })();
          },
        },
      ]);
    },
    [currentUser, t, targetUser, transactions, userId],
  );

  const handleDeleteLedger = useCallback(
    (ledger: EmployeeFinanceLedger) => {
      if (!targetUser) {
        return;
      }

      const confirmMessage = isPrimaryAdminViewer
        ? t('deleteFinanceLedgerKeepTotalsConfirm', {name: ledger.name})
        : t('deleteFinanceLedgerConfirm', {name: ledger.name});

      Alert.alert(t('deleteFinanceLedger'), confirmMessage, [
        {text: t('cancel'), style: 'cancel'},
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSavingLedger(true);
              try {
                if (!isPrimaryAdminViewer) {
                  const ledgerTxCount = getCustomLedgerStats(transactions, ledger.id).transactionCount;
                  if (ledgerTxCount > 0) {
                    await deleteLedgerTransactionsForUser(userId, ledger.id, transactions);
                  }
                }
                await deleteFinanceLedger(userId, ledger.id);
              } catch {
                Alert.alert(t('error'), t('saveFailed'));
              } finally {
                setSavingLedger(false);
              }
            })();
          },
        },
      ]);
    },
    [isPrimaryAdminViewer, t, targetUser, transactions, userId],
  );

  const cardMenuItems = useMemo<FinanceCardMenuItem[]>(() => {
    if (!menuLedger || !targetUser) {
      return [];
    }

    const canManageLedger = canManageFinanceLedgerEntry(currentUser, targetUser, menuLedger);

    if (isPrimaryAdminViewer && canManageLedger) {
      return [
        {
          key: 'delete',
          label: t('deleteFinanceLedger'),
          destructive: true,
          disabled: savingLedger,
          onPress: () => handleDeleteLedger(menuLedger),
        },
        {
          key: 'visibility',
          label: t('financeLedgerVisibility'),
          disabled: savingLedger,
          onPress: () => setVisibilityLedgerId(menuLedger.id),
        },
        {
          key: 'rename',
          label: t('renameFinanceLedger'),
          disabled: savingLedger,
          onPress: () => openRename(menuLedger.id, menuLedger.name),
        },
      ];
    }

    const items: FinanceCardMenuItem[] = [];
    const canClearAll = canClearFinanceLedgerTransactions(currentUser, targetUser, menuLedger);
    const isMemoLedger = isMemoFinanceLedger(menuLedger);

    if (canToggleMemoMode) {
      items.push({
        key: isMemoLedger ? 'convertToFinance' : 'convertToMemo',
        label: isMemoLedger ? t('convertToFinanceCard') : t('convertToMemoFinanceCard'),
        disabled: savingLedger,
        onPress: () => handleToggleMemoMode(menuLedger),
      });
    }

    if (canClearAll && menuLedgerTransactions.length > 0) {
      items.push({
        key: 'clear',
        label: t('clearLedgerTransactions'),
        disabled: clearingLedgerId === menuLedger.id,
        onPress: () => handleClearLedgerTransactions(menuLedger),
      });
    }

    if (canManageLedger) {
      items.push({
        key: 'visibility',
        label: t('financeLedgerVisibility'),
        disabled: savingLedger,
        onPress: () => {
          setVisibilityLedgerId(menuLedger.id);
        },
      });
      items.push({
        key: 'rename',
        label: t('renameFinanceLedger'),
        disabled: savingLedger,
        onPress: () => openRename(menuLedger.id, menuLedger.name),
      });
      items.push({
        key: 'delete',
        label: t('deleteFinanceLedger'),
        destructive: true,
        disabled: savingLedger,
        onPress: () => handleDeleteLedger(menuLedger),
      });
    }

    return items;
  }, [
    canToggleMemoMode,
    clearingLedgerId,
    currentUser,
    handleClearLedgerTransactions,
    handleDeleteLedger,
    handleToggleMemoMode,
    isPrimaryAdminViewer,
    menuLedger,
    menuLedgerTransactions.length,
    openRename,
    savingLedger,
    t,
    targetUser,
  ]);

  const ledgerListItems = useMemo<FinanceCustomLedgerListItem[]>(
    () =>
      customLedgers.map((ledger, index) => {
        const color = resolveCustomLedgerColor(index);
        const stats = getCustomLedgerStats(transactions, ledger.id);
        const canManageLedger = targetUser
          ? canManageFinanceLedgerEntry(currentUser, targetUser, ledger)
          : false;
        const canClearAll = targetUser
          ? canClearFinanceLedgerTransactions(currentUser, targetUser, ledger)
          : false;
        const hasMenu =
          (isPrimaryAdminViewer && canManageLedger) ||
          canToggleMemoMode ||
          canManageLedger ||
          (canClearAll && stats.transactionCount > 0);
        const showMemoBadge =
          memoOnlyMode || allLedgersMode ? isMemoFinanceLedger(ledger) : false;
        return {
          id: ledger.id,
          name: ledger.name,
          balance: computeCustomLedgerBalance(transactions, ledger.id),
          transactionCount: stats.transactionCount,
          lastTransactionAt: stats.lastTransactionAt,
          accentColor: color,
          badgeLabel: showMemoBadge ? t('memoFinanceCardBadge') : undefined,
          onOpenMenu: hasMenu ? () => openCardMenu(ledger.id) : undefined,
        };
      }),
    [
      allLedgersMode,
      canToggleMemoMode,
      currentUser,
      customLedgers,
      isPrimaryAdminViewer,
      memoOnlyMode,
      openCardMenu,
      t,
      targetUser,
      transactions,
    ],
  );

  const handleAddLedger = async (name: string, visibleToUserIds?: string[]) => {
    if (!currentUser) return;
    setSavingLedger(true);
    try {
      await addFinanceLedger(userId, name, currentUser.id, visibleToUserIds ?? [], {
        memoOnly: memoOnlyMode,
      });
      setAddLedgerVisible(false);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingLedger(false);
    }
  };

  const handleRenameLedger = async (name: string) => {
    if (!renameLedgerId) return;
    setSavingLedger(true);
    try {
      await renameFinanceLedger(userId, renameLedgerId, name);
      setRenameLedgerId(null);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingLedger(false);
    }
  };

  const handleUpdateVisibility = async (visibleToUserIds: string[]) => {
    if (!visibilityLedgerId) {
      return;
    }
    setSavingLedger(true);
    try {
      await updateFinanceLedgerVisibility(userId, visibilityLedgerId, visibleToUserIds);
      setVisibilityLedgerId(null);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingLedger(false);
    }
  };

  if (!canAddLedgers && customLedgers.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <FinanceSectionHeader
        title={
          sectionTitle ??
          (allLedgersMode
            ? t('employeeAddedFinanceCards')
            : memoOnlyMode
              ? t('memoFinanceCards')
              : t('customFinanceCards'))
        }
      />
      {canAddLedgers && customLedgers.length === 0 ? (
        <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
          {memoOnlyMode ? t('addMemoFinanceLedgerHint') : t('addFinanceLedgerHint')}
        </Text>
      ) : null}
      <FinanceCustomLedgersList
        items={ledgerListItems}
        currencyLabel={t('currencyLabel')}
        onSelect={(item) => {
          const index = customLedgers.findIndex((ledger) => ledger.id === item.id);
          const color = resolveCustomLedgerColor(index >= 0 ? index : 0);
          onOpenCustomLedger(item.id, item.name, color);
        }}
      />
      {canAddLedgers ? (
        <AppButton
          label={memoOnlyMode ? t('addMemoFinanceLedger') : t('addFinanceLedger')}
          variant="outline"
          onPress={() => setAddLedgerVisible(true)}
          style={styles.addBtn}
        />
      ) : null}
      <AddFinanceLedgerSheet
        visible={addLedgerVisible}
        mode="add"
        saving={savingLedger}
        visibilityUsers={visibilityUsers}
        onClose={() => setAddLedgerVisible(false)}
        onSave={handleAddLedger}
      />
      <AddFinanceLedgerSheet
        visible={renameLedgerId !== null}
        mode="rename"
        initialName={renameInitialName}
        saving={savingLedger}
        onClose={() => setRenameLedgerId(null)}
        onSave={handleRenameLedger}
      />
      <FinanceLedgerVisibilitySheet
        visible={visibilityLedgerId !== null}
        ledgerName={visibilityLedger?.name}
        users={visibilityUsers}
        initialSelectedIds={visibilityLedger?.visibleToUserIds ?? []}
        saving={savingLedger}
        onClose={() => setVisibilityLedgerId(null)}
        onSave={handleUpdateVisibility}
      />
      <FinanceCardOptionsSheet
        visible={cardMenuVisible}
        items={cardMenuItems}
        onClose={() => {
          setCardMenuVisible(false);
          setMenuLedgerId(null);
        }}
      />
      <LoadingOverlay visible={savingLedger || clearingLedgerId !== null} />
    </View>
  );
};

export default FinanceCustomLedgersSection;
