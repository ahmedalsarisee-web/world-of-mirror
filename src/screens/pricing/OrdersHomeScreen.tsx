import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, BackHandler, InteractionManager, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import EmptyState from '@app/components/common/EmptyState';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenContainer from '@app/components/common/ScreenContainer';
import ScreenHeader from '@app/components/common/ScreenHeader';
import {
  FinanceCardOptionsSheet,
  FinanceCardOverflowButton,
  FinanceCardOverflowHeaderButton,
  type FinanceCardMenuItem,
} from '@app/components/finance/FinanceCardOverflowMenu';
import {useOrdersHomeCardAdmin} from '@app/hooks/useOrdersHomeCardAdmin';
import OrdersFinancialReportSheet from '@app/components/pricing/OrdersFinancialReportSheet';
import EditOrdersHomeCardSheet from '@app/components/pricing/EditOrdersHomeCardSheet';
import OrdersSearchBar from '@app/components/pricing/OrdersSearchBar';
import OrdersSearchResultCard from '@app/components/pricing/OrdersSearchResultCard';
import MirrorPricingConfirmedOrdersPanel from '@app/components/pricing/MirrorPricingConfirmedOrdersPanel';
import {useDirection} from '@app/hooks/useDirection';
import {useUsersDirectory} from '@app/hooks/useUsersDirectory';
import {useTheme} from '@app/context/ThemeContext';
import {getFinanceAccounts} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import {useOrdersHomeUiStore} from '@app/stores/ordersHomeUiStore';
import type {AppUser} from '@app/types/models';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import type {PricingStackParamList} from '@app/types/navigation';
import type {OrdersHomeBuiltinTarget, OrdersHomeCardConfig} from '@app/types/ordersHomeCard';
import {
  createCustomOrdersHomeCard,
  getOrdersHomeCardIcon,
  getOrdersHomeScreenGridCards,
  insertCustomOrdersHomeCard,
  isAddOrderHomeCard,
  isBuiltinOrdersHomeCard,
  needsOrdersHomeScreenCardsSync,
} from '@app/types/ordersHomeCard';
import {exportOrdersFinancialReport} from '@app/utils/exportOrdersFinancialReport';
import {
  buildOrdersFinancialReport,
} from '@app/utils/ordersFinancialReport';
import {useOrdersHomeCardStats} from '@app/hooks/useOrdersHomeCardStats';
import {
  getOrdersHomeCardPaletteKey,
  navigateFromOrdersHomeCard,
} from '@app/utils/ordersHomeCardNavigation';
import {searchMirrorOrders, mergeOrdersSearchWithRemoteOrders, resolveRemoteInvoiceSearchDigits, shouldUseExactInvoiceRemoteSearch, shouldUseRemoteOrdersSearch, shouldSkipRemoteOrdersSearch} from '@app/utils/mirrorOrdersSearch';
import {resolveOrdersHomeCardListParams} from '@app/utils/ordersHomeCardListParams';
import {enableOrdersBackgroundSync} from '@app/utils/ordersSyncGate';
import {
  fetchConfirmedOrdersByInvoiceDigits,
  fetchConfirmedOrdersForSearchQuery,
  getAllConfirmedOrders,
  prefetchConfirmedOrdersListPages,
} from '@app/services/confirmedOrders.service';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type Nav = NativeStackNavigationProp<PricingStackParamList, 'OrdersHome'>;

type OrderHomeCardPalette = {
  background: string;
  border: string;
  accent: string;
  iconBackground: string;
};

function getOrdersHomeCardPalettes(
  isLight: boolean,
): Record<OrdersHomeBuiltinTarget | 'custom_0' | 'custom_1' | 'custom_2', OrderHomeCardPalette> {
  const builtin = isLight
    ? {
      preparation: {
        background: '#ECFDF5',
        border: '#BBF7D0',
        accent: '#059669',
        iconBackground: '#D1FAE5',
      },
      ready_delivery: {
        background: '#EFF6FF',
        border: '#BFDBFE',
        accent: '#2563EB',
        iconBackground: '#DBEAFE',
      },
      ready_installation: {
        background: '#FFFBEB',
        border: '#FDE68A',
        accent: '#D97706',
        iconBackground: '#FEF3C7',
      },
      completed: {
        background: '#F0FDF4',
        border: '#BBF7D0',
        accent: '#16A34A',
        iconBackground: '#DCFCE7',
      },
      completed_outstanding: {
        background: '#FFF7ED',
        border: '#FED7AA',
        accent: '#EA580C',
        iconBackground: '#FFEDD5',
      },
      add_order: {
        background: '#F4F1FF',
        border: '#DDD6FE',
        accent: '#6C4DFF',
        iconBackground: '#ECE7FF',
      },
    }
    : {
      preparation: {
        background: '#0F2219',
        border: '#1F4D35',
        accent: '#34D399',
        iconBackground: '#163B2A',
      },
      ready_delivery: {
        background: '#0F1A2E',
        border: '#1E3A5F',
        accent: '#60A5FA',
        iconBackground: '#172554',
      },
      ready_installation: {
        background: '#2A2210',
        border: '#5C4A1F',
        accent: '#FBBF24',
        iconBackground: '#3D3012',
      },
      completed: {
        background: '#0F2218',
        border: '#1F4D35',
        accent: '#4ADE80',
        iconBackground: '#163B2A',
      },
      completed_outstanding: {
        background: '#2A1A10',
        border: '#5C3A1F',
        accent: '#FB923C',
        iconBackground: '#3D2612',
      },
      add_order: {
        background: '#1E1633',
        border: '#3D2E66',
        accent: '#A78BFA',
        iconBackground: '#2A1F45',
      },
    };

  const custom = isLight
    ? {
      custom_0: {
        background: '#F8FAFC',
        border: '#CBD5E1',
        accent: '#475569',
        iconBackground: '#E2E8F0',
      },
      custom_1: {
        background: '#FDF4FF',
        border: '#F5D0FE',
        accent: '#A21CAF',
        iconBackground: '#FAE8FF',
      },
      custom_2: {
        background: '#F0F9FF',
        border: '#BAE6FD',
        accent: '#0284C7',
        iconBackground: '#E0F2FE',
      },
    }
    : {
      custom_0: {
        background: '#1A1F2B',
        border: '#334155',
        accent: '#94A3B8',
        iconBackground: '#243044',
      },
      custom_1: {
        background: '#2A1530',
        border: '#5B2C6F',
        accent: '#E879F9',
        iconBackground: '#3A1F45',
      },
      custom_2: {
        background: '#102033',
        border: '#1E3A5F',
        accent: '#38BDF8',
        iconBackground: '#172E4A',
      },
    };

  return {...builtin, ...custom};
}

const OrdersHomeScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, chevronForward, ltrTextStyle, isRTL, centeredTextStyle, chevronBack} =
    useDirection();
  const navigation = useNavigation<Nav>();
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'admin';
  const {
    adminMenus,
    canManage: canManageHomeCards,
    openCardMenu,
    openReorderSheet,
    persistCards,
    resolvedCards,
    screenCards: homeCards,
    storedCards: storedHomeCards,
    visibleScreenCards,
    saving: savingHomeCard,
  } = useOrdersHomeCardAdmin();
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [homeMenuVisible, setHomeMenuVisible] = useState(false);
  const [addCardVisible, setAddCardVisible] = useState(false);

  useEffect(() => {
    if (!canManageHomeCards || !currentUser?.id || !storedHomeCards?.length) {
      return;
    }
    if (!needsOrdersHomeScreenCardsSync(storedHomeCards, homeCards)) {
      return;
    }

    void persistCards(homeCards).catch(() => undefined);
  }, [canManageHomeCards, currentUser?.id, homeCards, persistCards, storedHomeCards]);
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const isLightTheme = theme.colors.background === '#F8FAFC';
  const cardPalettes = useMemo(() => getOrdersHomeCardPalettes(isLightTheme), [isLightTheme]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const {users: financeUsers} = useUsersDirectory('all', isAdmin && debouncedSearchQuery.trim().length > 0);
  const [remoteSearchOrders, setRemoteSearchOrders] = useState<MirrorPricingConfirmedOrder[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpenedOrder, setSearchOpenedOrder] = useState<MirrorPricingConfirmedOrder | null>(null);
  const upsertOrders = useMirrorPricingConfirmedOrdersStore((state) => state.upsertOrders);
  const allOrders = useMirrorPricingConfirmedOrdersStore((state) => state.orders);
  const searchResetVersion = useOrdersHomeUiStore((state) => state.resetVersion);
  const cardsLayout = useOrdersHomeUiStore((state) => state.cardsLayout);
  const setCardsLayout = useOrdersHomeUiStore((state) => state.setCardsLayout);
  const skipInitialSearchReset = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchInput), 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (skipInitialSearchReset.current) {
      skipInitialSearchReset.current = false;
      return;
    }
    setSearchInput('');
    setDebouncedSearchQuery('');
  }, [searchResetVersion]);

  useEffect(() => {
    const query = debouncedSearchQuery.trim();
    if (!shouldUseRemoteOrdersSearch(query)) {
      setRemoteSearchOrders((current) => (current.length === 0 ? current : []));
      setSearchLoading((current) => (current ? false : current));
      return;
    }

    const localOrders = useMirrorPricingConfirmedOrdersStore.getState().orders;
    if (shouldSkipRemoteOrdersSearch(query, localOrders)) {
      setRemoteSearchOrders((current) => (current.length === 0 ? current : []));
      setSearchLoading((current) => (current ? false : current));
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    const invoiceDigits = resolveRemoteInvoiceSearchDigits(query);
    const exactInvoiceQuery = shouldUseExactInvoiceRemoteSearch(query);

    // Exact "#123" invoice: cheap targeted query.
    // Everything else (employee, phone, customer, amounts, plain digits, notes…):
    // full cached corpus so old orders match every search field.
    const request =
      invoiceDigits && exactInvoiceQuery
        ? fetchConfirmedOrdersByInvoiceDigits(invoiceDigits, {exactOnly: true})
        : fetchConfirmedOrdersForSearchQuery(query);

    void request
      .then((orders) => {
        if (cancelled) {
          return;
        }
        setRemoteSearchOrders(orders);
        // Keep matched remote orders in the local store for opening details,
        // but avoid dumping the entire corpus into memory on every keystroke.
        const matched = searchMirrorOrders(orders, query, t).map((entry) => entry.order);
        if (matched.length > 0) {
          upsertOrders(matched);
        }
        setSearchLoading(false);
      })
      .catch((error) => {
        console.warn('[OrdersHomeScreen] remote search failed', error);
        if (!cancelled) {
          setRemoteSearchOrders([]);
          setSearchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery, t, upsertOrders]);

  const localSearchResults = useMemo(
    () => searchMirrorOrders(allOrders, searchInput, t),
    [allOrders, searchInput, t],
  );

  const searchResults = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return localSearchResults;
    }
    return mergeOrdersSearchWithRemoteOrders(
      localSearchResults,
      remoteSearchOrders,
      debouncedSearchQuery,
      t,
    );
  }, [debouncedSearchQuery, localSearchResults, remoteSearchOrders, searchInput, t]);

  const hasSearchQuery = searchInput.trim().length > 0;

  const usersById = useMemo(
    () => new Map((financeUsers ?? []).map((user) => [user.id, user])),
    [financeUsers],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screenBody: {flex: 1},
        content: {
          flex: 1,
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        addOrderHeaderBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        searchBlock: {flexShrink: 0},
        sectionBlock: {gap: theme.spacing.xs},
        sectionLabel: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          opacity: 0.7,
        },
        cardsGrid: {gap: theme.spacing.sm},
        cardsGridLayout: {
          flexDirection: row,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          rowGap: theme.spacing.sm,
          columnGap: theme.spacing.sm,
        },
        cardGridItem: {
          width: '48%',
        },
        results: {gap: theme.spacing.sm, paddingBottom: theme.spacing.xxl},
        searchOrderPanel: {
          flex: 1,
          padding: theme.spacing.md,
          paddingBottom: theme.spacing.xxl,
        },
        card: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          minHeight: 56,
        },
        cardGrid: {
          height: 100,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.xs,
          position: 'relative',
        },
        cardGridIconArea: {
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        },
        cardGridIconWrap: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
        },
        cardGridBadgeCorner: {
          position: 'absolute',
          top: -2,
          minWidth: 22,
          height: 22,
          borderRadius: 11,
          paddingHorizontal: 5,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: 'transparent',
        },
        cardGridTitleWrap: {
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 2,
          minHeight: 32,
        },
        cardGridTitle: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
          lineHeight: 17,
          textAlign: 'center',
        },
        cardGridMenu: {
          position: 'absolute',
          top: 4,
          zIndex: 2,
        },
        cardGridMenuRtl: {
          left: 4,
        },
        cardGridMenuLtr: {
          right: 4,
        },
        cardGridAlertCorner: {
          position: 'absolute',
          top: 4,
          zIndex: 2,
        },
        cardGridAlertCornerRtl: {
          right: 4,
        },
        cardGridAlertCornerLtr: {
          left: 4,
        },
        cardGridAlertBadge: {
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
        },
        listPaymentAlert: {
          flexShrink: 0,
        },
        iconWrap: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        cardBody: {flex: 1, minWidth: 0, justifyContent: 'center'},
        cardTitle: {fontSize: theme.typographyScale.size.sm, fontWeight: '700', lineHeight: 18},
        badge: {
          minWidth: 20,
          height: 20,
          borderRadius: 10,
          paddingHorizontal: 5,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        badgeText: {fontSize: 10, fontWeight: '700'},
        badgeTextGrid: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '800',
          lineHeight: 14,
        },
      }),
    [row, theme],
  );

  const gridBadgeCornerStyle = useMemo(
    () => (isRTL ? {left: -4} : {right: -4}),
    [isRTL],
  );

  const addOrderCard = useMemo(
    () => visibleScreenCards.find(isAddOrderHomeCard),
    [visibleScreenCards],
  );

  const addOrderHeaderButton = useMemo(() => {
    if (!addOrderCard) {
      return null;
    }

    return (
      <Pressable
        style={({pressed}) => [
          styles.addOrderHeaderBtn,
          {
            backgroundColor: cardPalettes.add_order.accent,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
        onPress={() => navigateFromOrdersHomeCard(navigation, addOrderCard)}
        accessibilityRole="button"
        accessibilityLabel={t('addOrder')}
      >
        <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
      </Pressable>
    );
  }, [addOrderCard, cardPalettes.add_order.accent, navigation, styles.addOrderHeaderBtn, t]);

  const openOrderFromSearch = (order: MirrorPricingConfirmedOrder) => {
    upsertOrders([order]);
    setSearchOpenedOrder(order);
  };

  const closeSearchOpenedOrder = useCallback(() => {
    setSearchOpenedOrder(null);
  }, []);

  useEffect(() => {
    if (!searchOpenedOrder) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSearchOpenedOrder();
      return true;
    });

    return () => subscription.remove();
  }, [closeSearchOpenedOrder, searchOpenedOrder]);

  const handleAddHomeCard = useCallback(
    async (values: {name: string}) => {
      if (!currentUser?.id) {
        return;
      }
      const nextCards = insertCustomOrdersHomeCard(
        resolvedCards,
        createCustomOrdersHomeCard(values.name),
        t,
      );
      await persistCards(nextCards);
      setAddCardVisible(false);
    },
    [currentUser?.id, persistCards, resolvedCards, t],
  );

  const homeMenuItems = useMemo<FinanceCardMenuItem[]>(() => {
    const items: FinanceCardMenuItem[] = [
      {
        key: 'activeOrders',
        label: t('ordersActiveTitle'),
        onPress: () => navigation.navigate('ConfirmedOrders'),
      },
      {
        key: 'pricing',
        label: t('ordersPricingButtonLabel'),
        onPress: () => navigation.navigate('MirrorPricingPriceList'),
      },
      {
        key: 'warehouse',
        label: t('mirrorWarehouseMenu'),
        onPress: () => navigation.navigate('MirrorWarehouse'),
      },
    ];

    if (isAdmin) {
      items.push({
        key: 'financialReport',
        label: t('ordersFinancialReportButtonLabel'),
        disabled: exportingReport,
        onPress: () => setReportSheetOpen(true),
      });
    }

    items.push(
      {
        key: 'layoutList',
        label: t('ordersHomeLayoutList'),
        disabled: cardsLayout === 'list',
        onPress: () => setCardsLayout('list'),
      },
      {
        key: 'layoutGrid',
        label: t('ordersHomeLayoutGrid'),
        disabled: cardsLayout === 'grid',
        onPress: () => setCardsLayout('grid'),
      },
    );

    if (canManageHomeCards) {
      items.push(
        {
          key: 'reorder',
          label: t('ordersHomeCardsReorderMenu'),
          disabled: savingHomeCard,
          onPress: () => {
            setHomeMenuVisible(false);
            openReorderSheet();
          },
        },
        {
          key: 'add',
          label: t('addOrdersHomeCard'),
          disabled: savingHomeCard,
          onPress: () => setAddCardVisible(true),
        },
      );
    }

    return items;
  }, [canManageHomeCards, cardsLayout, exportingReport, isAdmin, navigation, openReorderSheet, savingHomeCard, setCardsLayout, t]);

  const {statsByCardId: cardDisplayStats, refresh: refreshCardStats} =
    useOrdersHomeCardStats(visibleScreenCards);

  const handleOrdersHomeCardPress = useCallback(
    (card: OrdersHomeCardConfig) => {
      enableOrdersBackgroundSync();
      const listParams = resolveOrdersHomeCardListParams(card);
      if (listParams) {
        void prefetchConfirmedOrdersListPages([listParams]);
      }
      navigateFromOrdersHomeCard(navigation, card);
    },
    [navigation],
  );

  useFocusEffect(
    useCallback(() => {
      enableOrdersBackgroundSync();
    }, []),
  );

  const lastCardStatsRefreshRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastCardStatsRefreshRef.current < 300) {
        return;
      }
      lastCardStatsRefreshRef.current = now;
      const task = InteractionManager.runAfterInteractions(() => {
        void refreshCardStats();
      });
      return () => {
        task.cancel();
      };
    }, [refreshCardStats]),
  );

  const cards = useMemo(() => {
    let customIndex = 0;
    const orderedCards = visibleScreenCards.filter((card) => !isAddOrderHomeCard(card));

    return orderedCards.map((card) => {
        const paletteKey = getOrdersHomeCardPaletteKey(
          card,
          isBuiltinOrdersHomeCard(card) ? 0 : customIndex++,
        );
        const stats = cardDisplayStats.get(card.id);
        return {
          card,
          icon: getOrdersHomeCardIcon(card),
          palette: cardPalettes[paletteKey],
          badge: stats?.badge,
          paymentAlert: stats?.paymentAlert ?? false,
          paymentAlertCount: stats?.paymentAlertCount ?? 0,
        };
      });
  }, [cardDisplayStats, cardPalettes, visibleScreenCards]);

  const gridAlertCornerStyle = useMemo(
    () => (isRTL ? styles.cardGridAlertCornerRtl : styles.cardGridAlertCornerLtr),
    [isRTL, styles.cardGridAlertCornerLtr, styles.cardGridAlertCornerRtl],
  );

  const gridMenuCornerStyle = useMemo(
    () => (isRTL ? styles.cardGridMenuRtl : styles.cardGridMenuLtr),
    [isRTL, styles.cardGridMenuLtr, styles.cardGridMenuRtl],
  );

  const handleExportFinancialReport = async () => {
    setExportingReport(true);
    try {
      const allOrdersForReport = await getAllConfirmedOrders();
      const reportData = buildOrdersFinancialReport(allOrdersForReport, [], getFinanceAccounts(financeUsers), {
        homeCards: resolvedCards,
        reportCards: getOrdersHomeScreenGridCards(visibleScreenCards),
        t,
      });

      if (!reportData.byCard.some((section) => section.orderCount > 0)) {
        Alert.alert(t('error'), t('ordersFinancialReportEmpty'));
        return;
      }

      await exportOrdersFinancialReport(reportData, t, {
        isRtl: isRTL,
        appName: t('appName'),
      });
      setReportSheetOpen(false);
    } catch (error) {
      console.error('[OrdersHomeScreen] financial report export failed', error);
      Alert.alert(t('error'), t('ordersFinancialReportFailed'));
    } finally {
      setExportingReport(false);
    }
  };

  return (
    <ScreenContainer scroll style={{padding: 0}} contentStyle={{padding: 0, flexGrow: 1}}>
      <View style={styles.screenBody}>
        <ScreenHeader
          title={t('orders')}
          leadingAction={addOrderHeaderButton}
          endAction={<FinanceCardOverflowHeaderButton onPress={() => setHomeMenuVisible(true)} />}
        />

        <View style={[styles.content, layoutStyle]}>
          <View style={styles.searchBlock}>
            <OrdersSearchBar
              value={searchInput}
              onChangeText={setSearchInput}
              resultCount={hasSearchQuery ? searchResults.length : undefined}
              loading={searchLoading}
            />
          </View>

          {hasSearchQuery ? (
            <View style={styles.results}>
              {searchResults.length === 0 && !searchLoading ? (
                <EmptyState icon="text-search" message={t('ordersSearchNoResults')} />
              ) : (
                searchResults.map((result) => (
                  <OrdersSearchResultCard
                    key={result.order.id}
                    result={result}
                    homeCards={resolvedCards}
                    usersById={usersById}
                    onPress={() => openOrderFromSearch(result.order)}
                  />
                ))
              )}
            </View>
          ) : (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, textStyle, {color: theme.typography.secondary}]}>
                {t('ordersHomeSections')}
              </Text>
              <View style={cardsLayout === 'grid' ? styles.cardsGridLayout : styles.cardsGrid}>
                {cards.map(({card, icon, palette, badge, paymentAlert, paymentAlertCount}) => {
                  const onPress = () => handleOrdersHomeCardPress(card);

                  if (cardsLayout === 'grid') {
                    return (
                      <View key={card.id} style={styles.cardGridItem}>
                        <View
                          style={[
                            styles.cardGrid,
                            listCard,
                            {
                              backgroundColor: palette.background,
                              borderColor: palette.border,
                            },
                          ]}
                        >
                          {paymentAlert ? (
                            <View style={[styles.cardGridAlertCorner, gridAlertCornerStyle]}>
                              <View
                                style={[
                                  styles.cardGridAlertBadge,
                                  {
                                    backgroundColor: theme.status.warning,
                                    borderColor: palette.background,
                                  },
                                ]}
                                accessibilityLabel={t('ordersHomeCardPaymentAlertA11y', {
                                  count: paymentAlertCount,
                                })}
                              >
                                <MaterialCommunityIcons name="alert-circle" size={14} color="#FFFFFF" />
                              </View>
                            </View>
                          ) : null}
                          {canManageHomeCards ? (
                            <View style={[styles.cardGridMenu, gridMenuCornerStyle]}>
                              <FinanceCardOverflowButton onPress={() => openCardMenu(card.id)} />
                            </View>
                          ) : null}
                          <Pressable
                            style={({pressed}) => [
                              {flex: 1, opacity: pressed ? 0.88 : 1},
                            ]}
                            onPress={onPress}
                            accessibilityRole="button"
                          >
                            <View style={styles.cardGridIconArea}>
                              <View style={[styles.cardGridIconWrap, {backgroundColor: palette.iconBackground}]}>
                                <MaterialCommunityIcons name={icon} size={20} color={palette.accent} />
                              </View>
                              {badge ? (
                                <View
                                  style={[
                                    styles.cardGridBadgeCorner,
                                    gridBadgeCornerStyle,
                                    {
                                      backgroundColor: palette.accent,
                                      borderColor: palette.background,
                                    },
                                  ]}
                                >
                                  <Text style={[styles.badgeTextGrid, ltrTextStyle, {color: '#FFFFFF'}]}>{badge}</Text>
                                </View>
                              ) : null}
                            </View>
                            <View style={styles.cardGridTitleWrap}>
                              <Text
                                style={[styles.cardGridTitle, centeredTextStyle, {color: theme.typography.primary}]}
                                numberOfLines={2}
                              >
                                {card.name}
                              </Text>
                            </View>
                          </Pressable>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View
                      key={card.id}
                      style={[
                        styles.card,
                        listCard,
                        {
                          backgroundColor: palette.background,
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <Pressable
                        style={({pressed}) => [
                          {
                            flex: 1,
                            flexDirection: row,
                            alignItems: 'center',
                            gap: theme.spacing.sm,
                            opacity: pressed ? 0.88 : 1,
                          },
                        ]}
                        onPress={onPress}
                        accessibilityRole="button"
                      >
                        <View style={[styles.iconWrap, {backgroundColor: palette.iconBackground}]}>
                          <MaterialCommunityIcons name={icon} size={18} color={palette.accent} />
                        </View>
                        <View style={styles.cardBody}>
                          <Text
                            style={[styles.cardTitle, textStyle, {color: theme.typography.primary}]}
                            numberOfLines={2}
                          >
                            {card.name}
                          </Text>
                        </View>
                        {paymentAlert ? (
                          <View
                            style={styles.listPaymentAlert}
                            accessibilityLabel={t('ordersHomeCardPaymentAlertA11y', {
                              count: paymentAlertCount,
                            })}
                          >
                            <MaterialCommunityIcons
                              name="alert-circle"
                              size={20}
                              color={theme.status.warning}
                            />
                          </View>
                        ) : null}
                        {badge ? (
                          <View style={[styles.badge, {backgroundColor: palette.accent}]}>
                            <Text style={[styles.badgeText, ltrTextStyle, {color: '#FFFFFF'}]}>
                              {badge}
                            </Text>
                          </View>
                        ) : (
                          <MaterialCommunityIcons
                            name={chevronForward}
                            size={18}
                            color={palette.accent}
                          />
                        )}
                      </Pressable>
                      {canManageHomeCards ? (
                        <FinanceCardOverflowButton onPress={() => openCardMenu(card.id)} />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </View>

      {isAdmin ? (
        <>
          <OrdersFinancialReportSheet
            visible={reportSheetOpen}
            saving={exportingReport}
            onClose={() => setReportSheetOpen(false)}
            onExport={handleExportFinancialReport}
          />
          <LoadingOverlay visible={exportingReport} />
        </>
      ) : null}
      <FinanceCardOptionsSheet
        visible={homeMenuVisible}
        items={homeMenuItems}
        onClose={() => setHomeMenuVisible(false)}
      />
      {canManageHomeCards ? (
        <>
          <EditOrdersHomeCardSheet
            visible={addCardVisible}
            mode="add"
            saving={savingHomeCard}
            onClose={() => setAddCardVisible(false)}
            onSave={handleAddHomeCard}
          />
          {adminMenus}
        </>
      ) : null}
      <Modal
        visible={searchOpenedOrder !== null}
        animationType="slide"
        onRequestClose={closeSearchOpenedOrder}
      >
        {searchOpenedOrder ? (
          <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
            <ScreenHeader
              title={formatMirrorOrderInvoiceLabel(searchOpenedOrder.invoiceNumber)}
              startAction={
                <Pressable
                  onPress={closeSearchOpenedOrder}
                  hitSlop={10}
                  accessibilityRole="button"
                  style={({pressed}) => [{opacity: pressed ? 0.65 : 1}]}
                >
                  <MaterialCommunityIcons
                    name={chevronBack}
                    size={24}
                    color={theme.typography.primary}
                  />
                </Pressable>
              }
            />
            <View style={styles.searchOrderPanel}>
              <MirrorPricingConfirmedOrdersPanel
                showTitle={false}
                standaloneOrder={searchOpenedOrder}
              />
            </View>
          </ScreenContainer>
        ) : null}
      </Modal>
    </ScreenContainer>
  );
};

export default OrdersHomeScreen;
