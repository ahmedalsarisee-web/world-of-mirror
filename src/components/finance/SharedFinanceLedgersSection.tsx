import React, {useCallback, useMemo, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
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
import {useTheme} from '@app/context/ThemeContext';
import {deleteLedgerTransactionsForUser} from '@app/services/transactions.service';
import FinanceLedgerVisibilitySheet from '@app/components/finance/FinanceLedgerVisibilitySheet';
import {
  deleteFinanceLedger,
  getFinanceAccounts,
  renameFinanceLedger,
  updateFinanceLedgerMemoOnly,
  updateFinanceLedgerVisibility,
} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, Transaction} from '@app/types/models';
import {isPrimaryAdmin} from '@app/utils/adminPermissions';
import {canAccessFinanceTab} from '@app/utils/employeePermissions';
import {
  canClearFinanceLedgerTransactions,
  canManageFinanceLedgerEntry,
  canManageFinanceLedgerTransactions,
  canToggleFinanceLedgerMemoMode,
  shouldListSharedFinanceLedgerForViewer,
} from '@app/utils/financePermissions';
import {
  buildDelegatedFinanceLedgerAccessKey,
  getDelegatedFinanceLedgerOwnerIds,
  isMemoFinanceLedger,
  parseDelegatedFinanceLedgerAccessKey,
  resolveCustomLedgerColor,
  sortFinanceLedgersByCreatedAt,
} from '@app/utils/financeLedgers';
import {computeCustomLedgerBalance, getCustomLedgerStats} from '@app/utils/financeTotals';

export interface SharedFinanceLedgerItem {
  owner: AppUser;
  ledgerId: string;
  ledgerName: string;
  ledgerColor: string;
  visibleToUserIds: string[];
  memoOnly?: boolean;
  balance: number;
  transactionCount: number;
  lastTransactionAt: string | null;
}

interface Props {
  users: AppUser[];
  transactions: Transaction[];
  currentUser: AppUser | null | undefined;
  adminOwnedOnly?: boolean;
  onOpenCustomLedger: (
    ownerUserId: string,
    ownerUserName: string,
    ledgerId: string,
    ledgerName: string,
    ledgerColor: string,
  ) => void;
}

export function buildSharedFinanceLedgerItems(
  users: AppUser[],
  transactions: Transaction[],
  currentUser: AppUser | null | undefined,
  options?: {adminOwnedOnly?: boolean},
): SharedFinanceLedgerItem[] {
  if (!currentUser?.id) {
    return [];
  }

  const items: SharedFinanceLedgerItem[] = [];
  const includedKeys = new Set<string>();

  const pushLedgerItem = (
    owner: AppUser,
    ledger: import('@app/types/models').EmployeeFinanceLedger,
    colorIndex: number,
    ownerTransactions: Transaction[],
  ) => {
    const itemKey = buildDelegatedFinanceLedgerAccessKey(owner.id, ledger.id);
    if (includedKeys.has(itemKey)) {
      return;
    }

    includedKeys.add(itemKey);
    const stats = getCustomLedgerStats(ownerTransactions, ledger.id);

    items.push({
      owner,
      ledgerId: ledger.id,
      ledgerName: ledger.name,
      ledgerColor: resolveCustomLedgerColor(colorIndex),
      visibleToUserIds: ledger.visibleToUserIds ?? [],
      memoOnly: ledger.memoOnly,
      balance: computeCustomLedgerBalance(ownerTransactions, ledger.id),
      transactionCount: stats.transactionCount,
      lastTransactionAt: stats.lastTransactionAt,
    });
  };

  for (const owner of users) {
    if (owner.id === currentUser.id) {
      continue;
    }

    if (owner.role === 'employee') {
      continue;
    }

    if (options?.adminOwnedOnly && owner.role !== 'admin') {
      continue;
    }

    const ledgers = sortFinanceLedgersByCreatedAt(owner.financeLedgers ?? []);
    const ownerTransactions = transactions.filter((tx) => tx.userId === owner.id);

    ledgers.forEach((ledger, index) => {
      if (!shouldListSharedFinanceLedgerForViewer(currentUser, owner, ledger, options)) {
        return;
      }

      pushLedgerItem(owner, ledger, index, ownerTransactions);
    });
  }

  const usersById = new Map(users.map((user) => [user.id, user]));

  for (const accessKey of currentUser.delegatedFinanceLedgerAccess ?? []) {
    const parsed = parseDelegatedFinanceLedgerAccessKey(accessKey);
    if (!parsed) {
      continue;
    }

    const owner = usersById.get(parsed.ownerUserId);
    if (!owner || owner.id === currentUser.id || owner.role === 'employee') {
      continue;
    }

    if (options?.adminOwnedOnly && owner.role !== 'admin') {
      continue;
    }

    const ledger = owner.financeLedgers?.find((entry) => entry.id === parsed.ledgerId);
    if (!ledger) {
      continue;
    }

    const ownerTransactions = transactions.filter((tx) => tx.userId === owner.id);
    const ledgerIndex = sortFinanceLedgersByCreatedAt(owner.financeLedgers ?? []).findIndex(
      (entry) => entry.id === ledger.id,
    );

    pushLedgerItem(owner, ledger, ledgerIndex >= 0 ? ledgerIndex : 0, ownerTransactions);
  }

  return items;
}

const SharedFinanceLedgersSection: React.FC<Props> = ({
  users,
  transactions,
  currentUser,
  adminOwnedOnly = false,
  onOpenCustomLedger,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const authEmail = useAuthStore((s) => s.authEmail);
  const isPrimaryAdminViewer = isPrimaryAdmin(currentUser, authEmail);
  const [menuItemKey, setMenuItemKey] = useState<string | null>(null);
  const [cardMenuVisible, setCardMenuVisible] = useState(false);
  const [renameItemKey, setRenameItemKey] = useState<string | null>(null);
  const [renameInitialName, setRenameInitialName] = useState('');
  const [visibilityItemKey, setVisibilityItemKey] = useState<string | null>(null);
  const [savingLedger, setSavingLedger] = useState(false);
  const [clearingItemKey, setClearingItemKey] = useState<string | null>(null);

  const items = useMemo(
    () => buildSharedFinanceLedgerItems(users, transactions, currentUser, {adminOwnedOnly}),
    [adminOwnedOnly, currentUser, transactions, users],
  );

  const visibilityOwnerId = useMemo(() => {
    if (!visibilityItemKey) {
      return undefined;
    }
    return (
      items.find((entry) => `${entry.owner.id}-${entry.ledgerId}` === visibilityItemKey)?.owner.id
    );
  }, [items, visibilityItemKey]);

  const visibilityUsers = useMemo(
    () =>
      getFinanceAccounts(users).filter(
        (user) => user.id !== visibilityOwnerId && canAccessFinanceTab(user),
      ),
    [users, visibilityOwnerId],
  );

  const menuItem = useMemo(
    () => items.find((entry) => `${entry.owner.id}-${entry.ledgerId}` === menuItemKey) ?? null,
    [items, menuItemKey],
  );

  const menuLedgerDef = useMemo(() => {
    if (!menuItem) {
      return null;
    }
    return menuItem.owner.financeLedgers?.find((ledger) => ledger.id === menuItem.ledgerId) ?? null;
  }, [menuItem]);

  const menuOwnerTransactions = useMemo(() => {
    if (!menuItem) {
      return [];
    }
    return transactions.filter(
      (tx) => tx.userId === menuItem.owner.id && tx.ledgerId === menuItem.ledgerId,
    );
  }, [menuItem, transactions]);

  const openCardMenu = useCallback((itemKey: string) => {
    setMenuItemKey(itemKey);
    setCardMenuVisible(true);
  }, []);

  const handleToggleMemoMode = useCallback(() => {
    if (!menuItem || !menuLedgerDef) {
      return;
    }
    if (!canToggleFinanceLedgerMemoMode(currentUser, menuItem.owner)) {
      return;
    }

    const nextMemoOnly = !isMemoFinanceLedger(menuLedgerDef);
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
                await updateFinanceLedgerMemoOnly(menuItem.owner.id, menuItem.ledgerId, nextMemoOnly);
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
  }, [currentUser, menuItem, menuLedgerDef, t]);

  const handleClearLedgerTransactions = useCallback(() => {
    if (!menuItem || !menuLedgerDef) {
      return;
    }
    if (!canClearFinanceLedgerTransactions(currentUser, menuItem.owner, menuLedgerDef)) {
      return;
    }
    if (menuOwnerTransactions.length === 0) {
      return;
    }

    Alert.alert(
      t('clearLedgerTransactions'),
      t('clearLedgerTransactionsConfirm', {name: menuItem.ledgerName}),
      [
        {text: t('cancel'), style: 'cancel'},
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setClearingItemKey(menuItemKey);
              try {
                await deleteLedgerTransactionsForUser(
                  menuItem.owner.id,
                  menuItem.ledgerId,
                  transactions.filter((tx) => tx.userId === menuItem.owner.id),
                );
              } catch {
                Alert.alert(t('error'), t('saveFailed'));
              } finally {
                setClearingItemKey(null);
              }
            })();
          },
        },
      ],
    );
  }, [currentUser, menuItem, menuItemKey, menuLedgerDef, menuOwnerTransactions.length, t, transactions]);

  const handleDeleteLedger = useCallback(() => {
    if (!menuItem) {
      return;
    }

    const confirmMessage = isPrimaryAdminViewer
      ? t('deleteFinanceLedgerKeepTotalsConfirm', {name: menuItem.ledgerName})
      : t('deleteFinanceLedgerConfirm', {name: menuItem.ledgerName});

    Alert.alert(t('deleteFinanceLedger'), confirmMessage, [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSavingLedger(true);
            try {
              if (!isPrimaryAdminViewer && menuOwnerTransactions.length > 0) {
                await deleteLedgerTransactionsForUser(
                  menuItem.owner.id,
                  menuItem.ledgerId,
                  transactions.filter((tx) => tx.userId === menuItem.owner.id),
                );
              }
              await deleteFinanceLedger(menuItem.owner.id, menuItem.ledgerId);
            } catch {
              Alert.alert(t('error'), t('saveFailed'));
            } finally {
              setSavingLedger(false);
            }
          })();
        },
      },
    ]);
  }, [isPrimaryAdminViewer, menuItem, menuOwnerTransactions.length, t, transactions]);

  const cardMenuItems = useMemo<FinanceCardMenuItem[]>(() => {
    if (!menuItem || !menuLedgerDef) {
      return [];
    }

    const canManageLedger = canManageFinanceLedgerEntry(currentUser, menuItem.owner, menuLedgerDef);

    if (isPrimaryAdminViewer && canManageLedger) {
      return [
        {
          key: 'delete',
          label: t('deleteFinanceLedger'),
          destructive: true,
          disabled: savingLedger,
          onPress: handleDeleteLedger,
        },
        {
          key: 'visibility',
          label: t('financeLedgerVisibility'),
          disabled: savingLedger,
          onPress: () => setVisibilityItemKey(menuItemKey),
        },
        {
          key: 'rename',
          label: t('renameFinanceLedger'),
          disabled: savingLedger,
          onPress: () => {
            setRenameInitialName(menuItem.ledgerName);
            setRenameItemKey(menuItemKey);
          },
        },
      ];
    }

    const itemsList: FinanceCardMenuItem[] = [];
    const canToggleMemoMode = canToggleFinanceLedgerMemoMode(currentUser, menuItem.owner);
    const canClearAll = canClearFinanceLedgerTransactions(currentUser, menuItem.owner, menuLedgerDef);
    const isMemoLedger = isMemoFinanceLedger(menuLedgerDef);

    if (canToggleMemoMode) {
      itemsList.push({
        key: isMemoLedger ? 'convertToFinance' : 'convertToMemo',
        label: isMemoLedger ? t('convertToFinanceCard') : t('convertToMemoFinanceCard'),
        disabled: savingLedger,
        onPress: handleToggleMemoMode,
      });
    }

    if (canClearAll && menuOwnerTransactions.length > 0) {
      itemsList.push({
        key: 'clear',
        label: t('clearLedgerTransactions'),
        disabled: clearingItemKey === menuItemKey,
        onPress: handleClearLedgerTransactions,
      });
    }

    if (canManageLedger) {
      itemsList.push({
        key: 'visibility',
        label: t('financeLedgerVisibility'),
        disabled: savingLedger,
        onPress: () => setVisibilityItemKey(menuItemKey),
      });
      itemsList.push({
        key: 'rename',
        label: t('renameFinanceLedger'),
        disabled: savingLedger,
        onPress: () => {
          setRenameInitialName(menuItem.ledgerName);
          setRenameItemKey(menuItemKey);
        },
      });
      itemsList.push({
        key: 'delete',
        label: t('deleteFinanceLedger'),
        destructive: true,
        disabled: savingLedger,
        onPress: handleDeleteLedger,
      });
    }

    return itemsList;
  }, [
    clearingItemKey,
    currentUser,
    handleClearLedgerTransactions,
    handleDeleteLedger,
    handleToggleMemoMode,
    isPrimaryAdminViewer,
    menuItem,
    menuItemKey,
    menuLedgerDef,
    menuOwnerTransactions.length,
    savingLedger,
    t,
  ]);

  const ledgerListItems = useMemo<FinanceCustomLedgerListItem[]>(
    () =>
      items.map((item) => {
        const ledger = {
          visibleToUserIds: item.visibleToUserIds,
          memoOnly: item.memoOnly,
        };
        const ledgerDef =
          item.owner.financeLedgers?.find((entry) => entry.id === item.ledgerId) ?? ledger;
        const itemKey = `${item.owner.id}-${item.ledgerId}`;
        const canManageLedger = canManageFinanceLedgerEntry(currentUser, item.owner, ledgerDef);
        const canClearAll = canClearFinanceLedgerTransactions(currentUser, item.owner, ledgerDef);
        const canToggleMemoMode = canToggleFinanceLedgerMemoMode(currentUser, item.owner);
        const hasMenu =
          (isPrimaryAdminViewer && canManageLedger) ||
          canToggleMemoMode ||
          canManageLedger ||
          (canClearAll && item.transactionCount > 0);

        return {
          id: itemKey,
          name: item.ledgerName,
          balance: item.balance,
          transactionCount: item.transactionCount,
          lastTransactionAt: item.lastTransactionAt,
          accentColor: item.ledgerColor,
          ownerName: item.owner.name,
          ownerRole: item.owner.role,
          badgeLabel: item.memoOnly ? t('memoFinanceCardBadge') : undefined,
          viewOnly: !canManageFinanceLedgerTransactions(currentUser, item.owner, ledger),
          onOpenMenu: hasMenu ? () => openCardMenu(itemKey) : undefined,
        };
      }),
    [currentUser, isPrimaryAdminViewer, items, openCardMenu, t],
  );

  const renameItem = useMemo(
    () => items.find((entry) => `${entry.owner.id}-${entry.ledgerId}` === renameItemKey) ?? null,
    [items, renameItemKey],
  );

  const visibilityItem = useMemo(
    () => items.find((entry) => `${entry.owner.id}-${entry.ledgerId}` === visibilityItemKey) ?? null,
    [items, visibilityItemKey],
  );

  const handleRenameLedger = async (name: string) => {
    if (!renameItem) {
      return;
    }
    setSavingLedger(true);
    try {
      await renameFinanceLedger(renameItem.owner.id, renameItem.ledgerId, name);
      setRenameItemKey(null);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingLedger(false);
    }
  };

  const handleUpdateVisibility = async (visibleToUserIds: string[]) => {
    if (!visibilityItem) {
      return;
    }
    setSavingLedger(true);
    try {
      await updateFinanceLedgerVisibility(
        visibilityItem.owner.id,
        visibilityItem.ledgerId,
        visibleToUserIds,
      );
      setVisibilityItemKey(null);
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSavingLedger(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginTop: 0,
        },
      }),
    [theme],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <FinanceSectionHeader title={t('sharedFinanceCards')} />
      <FinanceCustomLedgersList
        items={ledgerListItems}
        currencyLabel={t('currencyLabel')}
        onSelect={(selected) => {
          const item = items.find(
            (entry) => `${entry.owner.id}-${entry.ledgerId}` === selected.id,
          );
          if (!item) {
            return;
          }
          onOpenCustomLedger(
            item.owner.id,
            item.owner.name,
            item.ledgerId,
            item.ledgerName,
            item.ledgerColor,
          );
        }}
      />
      <FinanceCardOptionsSheet
        visible={cardMenuVisible}
        items={cardMenuItems}
        onClose={() => {
          setCardMenuVisible(false);
          setMenuItemKey(null);
        }}
      />
      <AddFinanceLedgerSheet
        visible={renameItemKey !== null}
        mode="rename"
        initialName={renameInitialName}
        saving={savingLedger}
        onClose={() => setRenameItemKey(null)}
        onSave={handleRenameLedger}
      />
      <FinanceLedgerVisibilitySheet
        visible={visibilityItemKey !== null}
        ledgerName={visibilityItem?.ledgerName}
        users={visibilityUsers}
        initialSelectedIds={visibilityItem?.visibleToUserIds ?? []}
        saving={savingLedger}
        onClose={() => setVisibilityItemKey(null)}
        onSave={handleUpdateVisibility}
      />
      <LoadingOverlay visible={savingLedger || clearingItemKey !== null} />
    </View>
  );
};

export default SharedFinanceLedgersSection;
