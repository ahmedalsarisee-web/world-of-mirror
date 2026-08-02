import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Pressable} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenHeader from '@app/components/common/ScreenHeader';
import EditOrdersHomeCardSheet from '@app/components/pricing/EditOrdersHomeCardSheet';
import OrdersHomeCardVisibilitySheet from '@app/components/pricing/OrdersHomeCardVisibilitySheet';
import OrdersHomeCardsReorderSheet from '@app/components/pricing/OrdersHomeCardsReorderSheet';
import {
  FinanceCardOptionsSheet,
  FinanceCardOverflowHeaderButton,
  type FinanceCardMenuItem,
} from '@app/components/finance/FinanceCardOverflowMenu';
import {useDirection} from '@app/hooks/useDirection';
import {useOrdersHomeCards} from '@app/hooks/useOrdersHomeCards';
import {useUsersDirectory} from '@app/hooks/useUsersDirectory';
import {useTheme} from '@app/context/ThemeContext';
import {saveOrdersHomeCards} from '@app/services/ordersHomeCards.service';
import {useAuthStore} from '@app/stores/authStore';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import type {AppUser} from '@app/types/models';
import type {PricingStackParamList} from '@app/types/navigation';
import {
  isBuiltinOrdersHomeCard,
  isCustomOrdersHomeCard,
  getOrdersHomeScreenGridCards,
  moveOrdersHomeScreenCard,
  resolveOrdersHomeCards,
  resolveOrdersHomeScreenCards,
  type OrdersHomeCardConfig,
} from '@app/types/ordersHomeCard';
import {isPrimaryAdmin} from '@app/utils/adminPermissions';
import {
  canViewOrdersHomeCard,
  filterOrdersHomeCardVisibilitySelection,
  filterVisibleOrdersHomeCards,
  getOrdersHomeCardVisibilityCandidates,
  normalizeOrdersHomeCardVisibility,
} from '@app/utils/ordersHomeCardVisibility';

interface SectionOptions {
  ordersHomeCardId?: string;
  fallbackTitle: string;
}

export function useOrdersHomeCardAdmin(sectionOptions?: SectionOptions) {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {chevronBack} = useDirection();
  const navigation = useNavigation<NativeStackNavigationProp<PricingStackParamList>>();
  const user = useAuthStore((state) => state.user);
  const authEmail = useAuthStore((state) => state.authEmail);
  const canManage = isPrimaryAdmin(user, authEmail);
  const allOrders = useMirrorPricingConfirmedOrdersStore((state) => state.orders);
  const {cards: storedCards} = useOrdersHomeCards();
  const {users: allUsers} = useUsersDirectory('all', canManage);
  const resolvedCards = useMemo(() => resolveOrdersHomeCards(storedCards, t), [storedCards, t]);
  const screenCards = useMemo(() => resolveOrdersHomeScreenCards(storedCards, t), [storedCards, t]);
  const visibleScreenCards = useMemo(
    () => filterVisibleOrdersHomeCards(user, authEmail, screenCards),
    [authEmail, screenCards, user],
  );
  const visibilityUsers = useMemo(
    () => getOrdersHomeCardVisibilityCandidates(allUsers ?? []),
    [allUsers],
  );
  const sectionCard = useMemo(
    () =>
      sectionOptions?.ordersHomeCardId
        ? screenCards.find((entry) => entry.id === sectionOptions.ordersHomeCardId) ?? null
        : null,
    [screenCards, sectionOptions?.ordersHomeCardId],
  );

  const [menuCardId, setMenuCardId] = useState<string | null>(null);
  const [cardMenuVisible, setCardMenuVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [visibilityVisible, setVisibilityVisible] = useState(false);
  const [reorderVisible, setReorderVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const reorderableGridCards = useMemo(
    () => getOrdersHomeScreenGridCards(screenCards),
    [screenCards],
  );

  const menuCard = useMemo(
    () => (menuCardId ? resolvedCards.find((entry) => entry.id === menuCardId) ?? null : null),
    [menuCardId, resolvedCards],
  );

  const persistCards = useCallback(
    async (nextCards: OrdersHomeCardConfig[]) => {
      if (!user?.id) {
        return;
      }
      setSaving(true);
      try {
        await saveOrdersHomeCards(nextCards, user.id);
      } catch {
        Alert.alert(t('error'), t('saveFailed'));
      } finally {
        setSaving(false);
      }
    },
    [t, user?.id],
  );

  const handleRename = useCallback(
    async (values: {name: string}) => {
      if (!menuCard) {
        return;
      }
      const nextCards = resolvedCards.map((entry) =>
        entry.id === menuCard.id ? {...entry, name: values.name.trim()} : entry,
      );
      await persistCards(nextCards);
      setRenameVisible(false);
    },
    [menuCard, persistCards, resolvedCards],
  );

  const handleSaveVisibility = useCallback(
    async (visibleToUserIds: string[]) => {
      if (!menuCard) {
        return;
      }
      const normalized = normalizeOrdersHomeCardVisibility(
        filterOrdersHomeCardVisibilitySelection(visibleToUserIds, visibilityUsers),
      );
      const nextCards = resolvedCards.map((entry) => {
        if (entry.id !== menuCard.id) {
          return entry;
        }
        if (normalized) {
          return {...entry, visibleToUserIds: normalized};
        }
        const {visibleToUserIds: _removed, ...rest} = entry;
        return rest;
      });
      await persistCards(nextCards);
      setVisibilityVisible(false);
    },
    [menuCard, persistCards, resolvedCards, visibilityUsers],
  );

  const handleMoveCard = useCallback(
    async (cardId: string, direction: 'up' | 'down') => {
      const nextCards = moveOrdersHomeScreenCard(resolvedCards, screenCards, cardId, direction);
      if (nextCards === resolvedCards) {
        return;
      }
      await persistCards(nextCards);
    },
    [persistCards, resolvedCards, screenCards],
  );

  const handleDelete = useCallback(() => {
    if (!menuCard) {
      return;
    }

    if (isBuiltinOrdersHomeCard(menuCard)) {
      Alert.alert(t('error'), t('ordersHomeBuiltinCardDeleteBlocked'));
      return;
    }

    if (isCustomOrdersHomeCard(menuCard)) {
      const ordersInCard = allOrders.filter((order) => order.homeCardId === menuCard.id);
      if (ordersInCard.length > 0) {
        Alert.alert(t('error'), t('ordersHomeCardDeleteBlocked'));
        return;
      }
    }

    Alert.alert(t('deleteOrdersHomeCard'), t('deleteOrdersHomeCardConfirm', {name: menuCard.name}), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const nextCards = resolvedCards.filter((entry) => entry.id !== menuCard.id);
            await persistCards(nextCards);
            if (sectionOptions?.ordersHomeCardId) {
              navigation.goBack();
            }
          })();
        },
      },
    ]);
  }, [allOrders, menuCard, navigation, persistCards, resolvedCards, sectionOptions?.ordersHomeCardId, t]);

  const buildCardMenuItems = useCallback(
    (card: OrdersHomeCardConfig): FinanceCardMenuItem[] => {
      if (!canManage) {
        return [];
      }

      const gridCards = getOrdersHomeScreenGridCards(screenCards);
      const gridIndex = gridCards.findIndex((entry) => entry.id === card.id);
      const canMoveUp = gridIndex > 0;
      const canMoveDown = gridIndex >= 0 && gridIndex < gridCards.length - 1;

      const items: FinanceCardMenuItem[] = [];

      if (gridIndex >= 0) {
        items.push(
          {
            key: 'moveUp',
            label: t('ordersHomeCardMoveUp'),
            disabled: saving || !canMoveUp,
            onPress: () => {
              setCardMenuVisible(false);
              void handleMoveCard(card.id, 'up');
            },
          },
          {
            key: 'moveDown',
            label: t('ordersHomeCardMoveDown'),
            disabled: saving || !canMoveDown,
            onPress: () => {
              setCardMenuVisible(false);
              void handleMoveCard(card.id, 'down');
            },
          },
        );
      }

      items.push(
        {
          key: 'visibility',
          label: t('ordersHomeCardVisibilityMenu'),
          disabled: saving,
          onPress: () => {
            setCardMenuVisible(false);
            setVisibilityVisible(true);
          },
        },
        {
          key: 'rename',
          label: t('renameOrdersHomeCard'),
          disabled: saving,
          onPress: () => {
            setCardMenuVisible(false);
            setRenameVisible(true);
          },
        },
      );

      if (isCustomOrdersHomeCard(card)) {
        items.push({
          key: 'delete',
          label: t('deleteOrdersHomeCard'),
          destructive: true,
          disabled: saving,
          onPress: () => {
            setCardMenuVisible(false);
            handleDelete();
          },
        });
      }

      return items;
    },
    [canManage, handleDelete, handleMoveCard, saving, screenCards, t],
  );

  const openCardMenu = useCallback((cardId: string) => {
    setMenuCardId(cardId);
    setCardMenuVisible(true);
  }, []);

  const closeCardMenu = useCallback(() => {
    setCardMenuVisible(false);
  }, []);

  const cardMenuItems = useMemo(
    () => (menuCard ? buildCardMenuItems(menuCard) : []),
    [buildCardMenuItems, menuCard],
  );

  useEffect(() => {
    if (!sectionOptions?.ordersHomeCardId || !sectionCard) {
      return;
    }
    if (!canViewOrdersHomeCard(user, authEmail, sectionCard)) {
      navigation.goBack();
    }
  }, [authEmail, navigation, sectionCard, sectionOptions?.ordersHomeCardId, user]);

  const screenTitle = sectionCard?.name ?? sectionOptions?.fallbackTitle ?? '';
  const showSectionMenu = Boolean(canManage && sectionCard);

  const adminMenus = (
    <>
      <FinanceCardOptionsSheet
        visible={cardMenuVisible}
        items={cardMenuItems}
        onClose={closeCardMenu}
      />
      <EditOrdersHomeCardSheet
        visible={renameVisible}
        mode="rename"
        initialName={menuCard?.name}
        saving={saving}
        onClose={() => setRenameVisible(false)}
        onSave={handleRename}
      />
      <OrdersHomeCardVisibilitySheet
        visible={visibilityVisible}
        cardName={menuCard?.name}
        users={visibilityUsers}
        initialSelectedIds={filterOrdersHomeCardVisibilitySelection(
          menuCard?.visibleToUserIds ?? [],
          visibilityUsers,
        )}
        saving={saving}
        onClose={() => setVisibilityVisible(false)}
        onSave={handleSaveVisibility}
      />
      <OrdersHomeCardsReorderSheet
        visible={reorderVisible}
        cards={reorderableGridCards}
        saving={saving}
        onClose={() => setReorderVisible(false)}
        onMove={handleMoveCard}
      />
      <LoadingOverlay visible={saving} />
    </>
  );

  const sectionHeader = sectionOptions ? (
    <ScreenHeader
      title={screenTitle}
      startAction={
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          style={({pressed}) => [{opacity: pressed ? 0.65 : 1}]}
        >
          <MaterialCommunityIcons name={chevronBack} size={24} color={theme.typography.primary} />
        </Pressable>
      }
      action={
        showSectionMenu && sectionCard ? (
          <FinanceCardOverflowHeaderButton onPress={() => openCardMenu(sectionCard.id)} />
        ) : undefined
      }
    />
  ) : null;

  return {
    adminMenus,
    buildCardMenuItems,
    canManage,
    closeCardMenu,
    handleMoveCard,
    openCardMenu,
    openReorderSheet: () => setReorderVisible(true),
    persistCards,
    reorderableGridCards,
    resolvedCards,
    saving,
    screenCards,
    sectionHeader,
    storedCards,
    visibleScreenCards,
  };
}

export function useOrdersHomeCardSectionAdmin(options: SectionOptions) {
  const admin = useOrdersHomeCardAdmin(options);
  const screenTitle =
    admin.screenCards.find((entry) => entry.id === options.ordersHomeCardId)?.name ??
    options.fallbackTitle;

  return {
    header: admin.sectionHeader,
    menus: admin.adminMenus,
    saving: admin.saving,
    screenTitle,
  };
}
