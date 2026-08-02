import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import EmptyState from '@app/components/common/EmptyState';
import LoadingOverlay from '@app/components/common/LoadingOverlay';
import ScreenContainer from '@app/components/common/ScreenContainer';
import ScreenHeader from '@app/components/common/ScreenHeader';
import OrdersFinancialReportButton from '@app/components/pricing/OrdersFinancialReportButton';
import OrdersFinancialReportSheet from '@app/components/pricing/OrdersFinancialReportSheet';
import OrdersSearchBar from '@app/components/pricing/OrdersSearchBar';
import OrdersSearchResultCard from '@app/components/pricing/OrdersSearchResultCard';
import {useDirection} from '@app/hooks/useDirection';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {useTheme} from '@app/context/ThemeContext';
import {getAllTransactions, subscribeToAllTransactions} from '@app/services/transactions.service';
import {getFinanceAccounts, subscribeToUsers} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import {getMirrorPricingCartCount, useMirrorPricingCartStore} from '@app/stores/mirrorPricingCartStore';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import {useOrdersHomeUiStore} from '@app/stores/ordersHomeUiStore';
import type {AppUser} from '@app/types/models';
import {isCompletedOrderWithOutstandingBalance} from '@app/types/mirrorPricingConfirmedOrder';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import type {PricingStackParamList} from '@app/types/navigation';
import {canViewMirrorCartCost} from '@app/utils/adminPermissions';
import {exportOrdersFinancialReport} from '@app/utils/exportOrdersFinancialReport';
import {
  buildOrdersFinancialReport,
  filterOrdersByDateRange,
  filterTransactionsByDateRange,
} from '@app/utils/ordersFinancialReport';
import {searchMirrorOrders} from '@app/utils/mirrorOrdersSearch';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type Nav = NativeStackNavigationProp<PricingStackParamList, 'OrdersHome'>;

type OrderHomeCardPalette = {
  background: string;
  border: string;
  accent: string;
  iconBackground: string;
};

type OrderHomeCard = {
  key: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  palette: OrderHomeCardPalette;
  title: string;
  subtitle: string;
  badge?: number;
  onPress: () => void;
};

function getOrdersHomeCardPalettes(isLight: boolean): Record<string, OrderHomeCardPalette> {
  if (isLight) {
    return {
      calculator: {
        background: '#F4F1FF',
        border: '#DDD6FE',
        accent: '#6C4DFF',
        iconBackground: '#ECE7FF',
      },
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
    };
  }

  return {
    calculator: {
      background: '#1A1730',
      border: '#3D3566',
      accent: '#A78BFA',
      iconBackground: '#2A2548',
    },
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
  };
}

function countOrdersWithStatus(
  orders: {status?: MirrorPricingOrderStatus}[],
  status: MirrorPricingOrderStatus,
): number {
  return orders.filter((order) => resolveMirrorPricingOrderStatus(order.status) === status).length;
}

const OrdersHomeScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, layoutStyle, chevronForward, ltrTextStyle, isRTL} = useDirection();
  const navigation = useNavigation<Nav>();
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'admin';
  const showReportCost = canViewMirrorCartCost(currentUser);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const {data: financeUsers} = useFirestoreSubscription<AppUser[]>([], subscribeToUsers, [], {
    enabled: isAdmin,
  });
  const {data: allTransactions} = useFirestoreSubscription(
    [],
    subscribeToAllTransactions,
    [],
    {enabled: isAdmin},
  );
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const isLightTheme = theme.colors.background === '#F8FAFC';
  const cardPalettes = useMemo(() => getOrdersHomeCardPalettes(isLightTheme), [isLightTheme]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchResetVersion = useOrdersHomeUiStore((state) => state.resetVersion);
  const skipInitialSearchReset = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchInput), 200);
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

  const cartItems = useMirrorPricingCartStore((state) => state.items);
  const cartCount = useMemo(() => getMirrorPricingCartCount(cartItems), [cartItems]);
  const allOrders = useMirrorPricingConfirmedOrdersStore((state) => state.orders);

  const searchResults = useMemo(
    () => searchMirrorOrders(allOrders, debouncedSearchQuery, t),
    [allOrders, debouncedSearchQuery, t],
  );

  const hasSearchQuery = debouncedSearchQuery.trim().length > 0;

  const preparationCount = useMemo(
    () => countOrdersWithStatus(allOrders, 'preparation'),
    [allOrders],
  );
  const readyDeliveryCount = useMemo(
    () => countOrdersWithStatus(allOrders, 'ready_delivery'),
    [allOrders],
  );
  const readyInstallationCount = useMemo(
    () => countOrdersWithStatus(allOrders, 'ready_installation'),
    [allOrders],
  );
  const completedCount = useMemo(
    () => countOrdersWithStatus(allOrders, 'completed'),
    [allOrders],
  );
  const completedOutstandingCount = useMemo(
    () => allOrders.filter(isCompletedOrderWithOutstandingBalance).length,
    [allOrders],
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
        searchBlock: {flexShrink: 0},
        sectionBlock: {gap: theme.spacing.xs},
        sectionLabel: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          opacity: 0.7,
        },
        cardsGrid: {gap: theme.spacing.xs},
        results: {gap: theme.spacing.sm, paddingBottom: theme.spacing.xxl},
        card: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          minHeight: 72,
        },
        iconWrap: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        cardBody: {flex: 1, minWidth: 0, gap: 2, justifyContent: 'center'},
        cardTitle: {fontSize: theme.typographyScale.size.sm, fontWeight: '700', lineHeight: 18},
        cardSubtitle: {fontSize: theme.typographyScale.size.xs, lineHeight: 15},
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
      }),
    [row, theme],
  );

  const openOrderFromSearch = (orderId: string, status: MirrorPricingOrderStatus) => {
    if (status === 'preparation') {
      navigation.navigate('ConfirmedOrders', {focusOrderId: orderId});
      return;
    }
    navigation.navigate('OrdersByStatus', {status, focusOrderId: orderId});
  };

  const handleExportFinancialReport = async (startDate: string, endDate: string) => {
    setExportingReport(true);
    try {
      const filteredOrders = filterOrdersByDateRange(allOrders, startDate, endDate);
      if (filteredOrders.length === 0) {
        Alert.alert(t('error'), t('ordersFinancialReportEmpty'));
        return;
      }

      const users = getFinanceAccounts(financeUsers);
      const transactions =
        allTransactions.length > 0
          ? filterTransactionsByDateRange(allTransactions, startDate, endDate)
          : filterTransactionsByDateRange(
              await getAllTransactions(users),
              startDate,
              endDate,
            );

      const reportData = buildOrdersFinancialReport(filteredOrders, transactions, users);
      await exportOrdersFinancialReport(reportData, t, {
        isRtl: isRTL,
        appName: t('appName'),
        showCost: showReportCost,
        startDate,
        endDate,
      });
      setReportSheetOpen(false);
    } catch (error) {
      console.error('[OrdersHomeScreen] financial report export failed', error);
      Alert.alert(t('error'), t('ordersFinancialReportFailed'));
    } finally {
      setExportingReport(false);
    }
  };

  const cards: OrderHomeCard[] = [
    {
      key: 'calculator',
      icon: 'plus',
      palette: cardPalettes.calculator,
      title: t('mirrorPricing'),
      subtitle: t('ordersHomeCalculatorHint'),
      badge: cartCount > 0 ? cartCount : undefined,
      onPress: () => navigation.navigate('MirrorPricing'),
    },
    {
      key: 'preparation',
      icon: 'clipboard-check-outline',
      palette: cardPalettes.preparation,
      title: t('mirrorOrdersConfirmed'),
      subtitle: t('ordersHomeConfirmedHint'),
      badge: preparationCount > 0 ? preparationCount : undefined,
      onPress: () => navigation.navigate('ConfirmedOrders', undefined),
    },
    {
      key: 'ready_delivery',
      icon: 'truck-delivery-outline',
      palette: cardPalettes.ready_delivery,
      title: t('mirrorOrdersReadyDelivery'),
      subtitle: t('ordersHomeReadyDeliveryHint'),
      badge: readyDeliveryCount > 0 ? readyDeliveryCount : undefined,
      onPress: () => navigation.navigate('OrdersByStatus', {status: 'ready_delivery'}),
    },
    {
      key: 'ready_installation',
      icon: 'hammer-wrench',
      palette: cardPalettes.ready_installation,
      title: t('mirrorOrdersReadyInstallation'),
      subtitle: t('ordersHomeReadyInstallationHint'),
      badge: readyInstallationCount > 0 ? readyInstallationCount : undefined,
      onPress: () => navigation.navigate('OrdersByStatus', {status: 'ready_installation'}),
    },
    {
      key: 'completed_outstanding',
      icon: 'hand-coin-outline',
      palette: cardPalettes.completed_outstanding,
      title: t('mirrorOrdersCompletedOutstanding'),
      subtitle: t('ordersHomeCompletedOutstandingHint'),
      badge: completedOutstandingCount > 0 ? completedOutstandingCount : undefined,
      onPress: () =>
        navigation.navigate('OrdersByStatus', {
          status: 'completed',
          outstandingOnly: true,
        }),
    },
    {
      key: 'completed',
      icon: 'check-decagram-outline',
      palette: cardPalettes.completed,
      title: t('mirrorOrdersCompleted'),
      subtitle: t('ordersHomeCompletedHint'),
      badge: completedCount > 0 ? completedCount : undefined,
      onPress: () => navigation.navigate('OrdersByStatus', {status: 'completed'}),
    },
  ];

  return (
    <ScreenContainer scroll style={{padding: 0}} contentStyle={{padding: 0, flexGrow: 1}}>
      <View style={styles.screenBody}>
        <ScreenHeader
          title={t('orders')}
          action={
            isAdmin ? (
              <OrdersFinancialReportButton
                onPress={() => setReportSheetOpen(true)}
                loading={exportingReport}
              />
            ) : undefined
          }
        />

        <View style={[styles.content, layoutStyle]}>
          <View style={styles.searchBlock}>
            <OrdersSearchBar
              value={searchInput}
              onChangeText={setSearchInput}
              resultCount={hasSearchQuery ? searchResults.length : undefined}
            />
          </View>

          {hasSearchQuery ? (
            <View style={styles.results}>
              {searchResults.length === 0 ? (
                <EmptyState icon="text-search" message={t('ordersSearchNoResults')} />
              ) : (
                searchResults.map((result) => (
                  <OrdersSearchResultCard
                    key={result.order.id}
                    result={result}
                    onPress={() =>
                      openOrderFromSearch(
                        result.order.id,
                        resolveMirrorPricingOrderStatus(result.order.status),
                      )
                    }
                  />
                ))
              )}
            </View>
          ) : (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, textStyle, {color: theme.typography.secondary}]}>
                {t('ordersHomeSections')}
              </Text>
              <View style={styles.cardsGrid}>
                {cards.map((card) => (
                  <Pressable
                    key={card.key}
                    style={({pressed}) => [
                      styles.card,
                      listCard,
                      {
                        backgroundColor: card.palette.background,
                        borderColor: card.palette.border,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                    onPress={card.onPress}
                    accessibilityRole="button"
                  >
                    <View style={[styles.iconWrap, {backgroundColor: card.palette.iconBackground}]}>
                      <MaterialCommunityIcons name={card.icon} size={20} color={card.palette.accent} />
                    </View>
                    <View style={styles.cardBody}>
                      <Text
                        style={[styles.cardTitle, textStyle, {color: theme.typography.primary}]}
                        numberOfLines={1}
                      >
                        {card.title}
                      </Text>
                      <Text
                        style={[styles.cardSubtitle, inlineTextStyle, {color: theme.typography.secondary}]}
                        numberOfLines={2}
                      >
                        {card.subtitle}
                      </Text>
                    </View>
                    {card.badge ? (
                      <View style={[styles.badge, {backgroundColor: card.palette.accent}]}>
                        <Text style={[styles.badgeText, ltrTextStyle, {color: '#FFFFFF'}]}>
                          {card.badge}
                        </Text>
                      </View>
                    ) : (
                      <MaterialCommunityIcons
                        name={chevronForward}
                        size={20}
                        color={card.palette.accent}
                      />
                    )}
                  </Pressable>
                ))}
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
    </ScreenContainer>
  );
};

export default OrdersHomeScreen;
