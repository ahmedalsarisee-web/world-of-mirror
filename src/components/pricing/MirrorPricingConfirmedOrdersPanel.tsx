import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Alert, BackHandler, FlatList, Pressable, StyleSheet, Text, View} from 'react-native';

import {MaterialCommunityIcons} from '@expo/vector-icons';

import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';

import ConfirmedOrderActionChip from '@app/components/pricing/ConfirmedOrderActionChip';
import BottomSheet from '@app/components/common/BottomSheet';

import AmountText from '@app/components/common/AmountText';

import EmptyState from '@app/components/common/EmptyState';
import CustomerPhoneLink from '@app/components/common/CustomerPhoneLink';
import LinkableText from '@app/components/common/LinkableText';

import LoadingOverlay from '@app/components/common/LoadingOverlay';

import {useDirection} from '@app/hooks/useDirection';
import {useConfirmedOrdersList} from '@app/hooks/useConfirmedOrdersList';

import {useTheme} from '@app/context/ThemeContext';

import {isMockMode} from '@app/config/appMode';
import {useAuthStore} from '@app/stores/authStore';
import {canDeleteOrders, canLeaveOrderCardNotes, canMoveOrders} from '@app/utils/employeePermissions';
import EditConfirmedOrderSheet from '@app/components/pricing/EditConfirmedOrderSheet';
import OrderCardNoteSheet from '@app/components/pricing/OrderCardNoteSheet';
import OrderInvoiceDetailsSheet from '@app/components/pricing/OrderInvoiceDetailsSheet';
import OrderLocationFulfillmentRow from '@app/components/pricing/OrderLocationFulfillmentRow';
import OrderNoteBanner from '@app/components/pricing/OrderNoteBanner';
import OrderPaymentFollowUpNoteSheet from '@app/components/pricing/OrderPaymentFollowUpNoteSheet';
import {
  deleteConfirmedOrder,
  fetchConfirmedOrderById,
  filterConfirmedOrdersForListParams,
  updateConfirmedOrder,
  updateConfirmedOrderCardNote,
  updateConfirmedOrderCatalogAnnotationData,
  updateConfirmedOrderFavorite,
  type ConfirmedOrderUpdatePayload,
} from '@app/services/confirmedOrders.service';
import type {ConfirmedOrderEditFields} from '@app/utils/confirmedOrderEdit';
import {
  confirmedOrdersPageSnapshotKey,
  useMirrorPricingConfirmedOrdersStore,
} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import {useOrdersHomeUiStore} from '@app/stores/ordersHomeUiStore';

import {formatCurrency, formatDateTime, roundMoney} from '@app/utils/format';
import ConfirmedOrderInfoRow from '@app/components/pricing/ConfirmedOrderInfoRow';
import ConfirmedOrderCatalogImages from '@app/components/pricing/ConfirmedOrderCatalogImages';
import {useOrdersHomeCards} from '@app/hooks/useOrdersHomeCards';
import {useUsersDirectory} from '@app/hooks/useUsersDirectory';
import type {AppUser} from '@app/types/models';
import {resolveOrderConfirmedByName} from '@app/utils/confirmedOrderConfirmedBy';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';
import {
  pruneOrderImageAnnotationData,
  type CatalogMirrorImageAnnotationData,
} from '@app/utils/catalogImageTextAnnotations';
import {normalizeMirrorCatalogImageIds, type MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';

import {exportMirrorConfirmedOrderReport} from '@app/utils/exportMirrorCartReport';
import {shareOrderWithDeliveryCompany} from '@app/utils/deliveryCompanyShare';
import {invalidateCatalogImageMarkerCache} from '@app/utils/catalogImageMarker';
import {invalidateMirrorCatalogMaterializedUri} from '@app/utils/mirrorCatalogExpoImage';
import {
  getOrderStudioImageSaveErrorMessage,
  uploadOrderStudioImages,
} from '@app/services/orderStudioImages.service';
import {pickImage} from '@app/utils/imagePicker';
import {buildCatalogToStudioReplaceUpdates, buildStudioImageReplaceUpdates, buildStudioToCatalogReplaceUpdates} from '@app/utils/orderStudioImageReplace';
import {consumeOrderOverlayBackPress} from '@app/utils/orderOverlayBackHandler';

import {getListCardStyle} from '@shared/theme/themeHelpers';

import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {hasOrderInvoiceExtraLines, shouldPersistImageAnnotationsForOrderStatus, sortConfirmedOrdersByStatusChangedAt} from '@app/types/mirrorPricingConfirmedOrder';
import {
  getCustomAdditionLineTotal,
  getCustomAdditionQuantity,
} from '@app/types/mirrorPricingCart';
import type {PricingStackParamList} from '@app/types/navigation';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {
  getMirrorPricingOrderMoveTargetIcon,
  resolveMirrorPricingOrderMoveTargetStatus,
  resolveMirrorPricingOrderStatus,
  type MirrorPricingOrderMoveTarget,
} from '@app/types/mirrorPricingOrderStatus';
import {
  resolveMirrorPricingOrderStatusEmptyMessage,
  resolveMirrorPricingOrderStatusLabel,
} from '@app/utils/ordersHomeCardLabels';
import {
  getAddOrderDestinationLabel,
  getOrderMoveDestinationLabel,
  getOrderMoveDestinations,
  hasOrderMoveDestinations,
  orderWouldChangeDestination,
  resolveOrderMoveDestinationKey,
} from '@app/utils/orderMoveDestinations';
import {clearConfirmedOrdersListCache} from '@app/utils/confirmedOrdersListCache';

import {
  getConfirmedOrderLineTotal,
  hasActiveOrderCardNote,
  hasPaymentFollowUp,
  resolveConfirmedOrderDiscount,
  resolveConfirmedOrderPieceCount,
  resolveConfirmedOrderRemaining,
  resolveConfirmedOrderSubtotal,
  resolvePriorCollectedAmount,
  shouldSnapshotPriorCollectedAmount,
} from '@app/types/mirrorPricingConfirmedOrder';
import {
  resolveOrdersHomeScreenCards,
} from '@app/types/ordersHomeCard';
import {filterVisibleOrdersHomeCards} from '@app/utils/ordersHomeCardVisibility';



type PanelNav = NativeStackNavigationProp<PricingStackParamList>;

interface Props {
  showTitle?: boolean;
  sectionTitle?: string;
  statusFilter?: MirrorPricingOrderStatus;
  homeCardId?: string;
  focusOrderId?: string;
  focusToken?: number;
  outstandingOnly?: boolean;
  activeOnly?: boolean;
  /** When set, shows only this order (e.g. from search) without loading a status list. */
  standaloneOrder?: MirrorPricingConfirmedOrder;
}

const ORDER_MOVE_FIRESTORE_KEYS: (keyof ConfirmedOrderUpdatePayload)[] = [
  'status',
  'homeCardId',
  'statusChangedAt',
  'lastMovedByUserId',
  'lastMovedByUserName',
  'lastMovedFromLabel',
  'lastMovedToLabel',
  'collectedAmount',
  'remainingAmount',
  'paymentFollowUpRequired',
  'paymentFollowUpNote',
  'paymentFollowUpAt',
  'priorCollectedAmount',
  'catalogMirrorImageAnnotationData',
  'isFavorite',
  'favoritedAt',
];

function pickOrderMoveFirestorePayload(
  payload: ConfirmedOrderUpdatePayload,
): ConfirmedOrderUpdatePayload {
  const picked = {} as ConfirmedOrderUpdatePayload;
  for (const key of ORDER_MOVE_FIRESTORE_KEYS) {
    if (key in payload) {
      picked[key] = payload[key];
    }
  }
  return picked;
}

function resolveLatestConfirmedOrder(order: MirrorPricingConfirmedOrder): MirrorPricingConfirmedOrder {
  return (
    useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === order.id) ??
    order
  );
}

const MirrorPricingConfirmedOrdersPanel: React.FC<Props> = ({
  showTitle = true,
  sectionTitle,
  statusFilter = 'preparation',
  homeCardId,
  focusOrderId,
  focusToken,
  outstandingOnly = false,
  activeOnly = false,
  standaloneOrder,
}) => {

  const {t} = useTranslation();
  const navigation = useNavigation<PanelNav>();
  const currentUser = useAuthStore((state) => state.user);
  const authEmail = useAuthStore((state) => state.authEmail);
  const canDeleteOrdersPermission = canDeleteOrders(currentUser);
  const canMoveOrderStatus = canMoveOrders(currentUser);
  const canManageOrderCardNotes = canLeaveOrderCardNotes(currentUser);

  const {theme} = useTheme();

  const {textStyle, inlineTextStyle, row, ltrTextStyle, chevronForward, isRTL, layoutStyle} = useDirection();

  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const isStandalone = Boolean(standaloneOrder);
  const standaloneLiveOrder = useMirrorPricingConfirmedOrdersStore((state) =>
    standaloneOrder
      ? state.orders.find((order) => order.id === standaloneOrder.id)
      : undefined,
  );
  const resolvedStandaloneOrder = standaloneLiveOrder ?? standaloneOrder;

  const {
    orders,
    totalCount,
    hasMore,
    loading,
    loadingMore,
    loadMore,
  } = useConfirmedOrdersList({
    statusFilter,
    homeCardId,
    outstandingOnly,
    activeOnly,
    enabled: !isStandalone,
  });
  const upsertOrders = useMirrorPricingConfirmedOrdersStore((state) => state.upsertOrders);
  const listParams = useMemo(
    () => ({statusFilter, homeCardId, outstandingOnly, activeOnly}),
    [activeOnly, homeCardId, outstandingOnly, statusFilter],
  );
  const [focusOrderOverride, setFocusOrderOverride] =
    useState<MirrorPricingConfirmedOrder | null>(null);
  const listRef = useRef<FlatList<MirrorPricingConfirmedOrder>>(null);
  const appliedFocusKeyRef = useRef<string | null>(null);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  const displayOrders = useMemo(() => {
    if (resolvedStandaloneOrder) {
      return [resolvedStandaloneOrder];
    }
    if (!focusOrderOverride) {
      return orders;
    }
    if (orders.some((order) => order.id === focusOrderOverride.id)) {
      return orders;
    }
    return sortConfirmedOrdersByStatusChangedAt([focusOrderOverride, ...orders]);
  }, [focusOrderOverride, orders, resolvedStandaloneOrder]);
  const {users: adminUsers} = useUsersDirectory('all', currentUser?.role === 'admin');
  const appUsers = useMemo(() => {
    if (currentUser?.role === 'admin') {
      return adminUsers;
    }
    if (!currentUser) {
      return [];
    }
    return [currentUser];
  }, [adminUsers, currentUser]);
  const {cards: storedHomeCards} = useOrdersHomeCards();
  const allHomeCards = useMemo(
    () => resolveOrdersHomeScreenCards(storedHomeCards, t),
    [storedHomeCards, t],
  );
  const visibleHomeCards = useMemo(
    () => filterVisibleOrdersHomeCards(currentUser, authEmail, allHomeCards),
    [allHomeCards, authEmail, currentUser],
  );
  const usersById = useMemo(() => new Map(appUsers.map((user) => [user.id, user])), [appUsers]);

  const updateOrder = useMirrorPricingConfirmedOrdersStore((state) => state.updateOrder);

  const statusTitle = homeCardId
    ? t('ordersHomeCustomCard')
    : activeOnly
      ? t('ordersActiveTitle')
      : outstandingOnly
        ? t('mirrorOrdersCompletedOutstanding')
        : resolveMirrorPricingOrderStatusLabel(statusFilter, allHomeCards, t);
  const statusEmptyMessage = homeCardId
    ? t('ordersHomeCustomCardEmpty')
    : activeOnly
      ? t('ordersActiveEmpty')
      : resolveMirrorPricingOrderStatusEmptyMessage(statusFilter, allHomeCards, t, {
          outstandingOnly,
        });
  const displayTitle = sectionTitle ?? statusTitle;

  const [expandedId, setExpandedId] = useState<string | null>(() =>
    standaloneOrder ? standaloneOrder.id : null,
  );
  const [moveSheetOrder, setMoveSheetOrder] = useState<MirrorPricingConfirmedOrder | null>(null);
  const [movingOrderId, setMovingOrderId] = useState<string | null>(null);
  const [paymentFollowUpNoteSheet, setPaymentFollowUpNoteSheet] = useState<{
    order: MirrorPricingConfirmedOrder;
    mode: 'move' | 'edit';
  } | null>(null);
  const [paymentFollowUpSaving, setPaymentFollowUpSaving] = useState(false);
  const [cardNoteDraft, setCardNoteDraft] = useState<{orderId: string; initialNote: string} | null>(
    null,
  );
  const [cardNoteSaving, setCardNoteSaving] = useState(false);

  const [exportingOrderId, setExportingOrderId] = useState<string | null>(null);
  const [invoiceDetailsSheetOrder, setInvoiceDetailsSheetOrder] =
    useState<MirrorPricingConfirmedOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<MirrorPricingConfirmedOrder | null>(null);
  const [editingOrderPreview, setEditingOrderPreview] = useState<MirrorPricingConfirmedOrder | null>(
    null,
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingCatalogImagesOrderId, setSavingCatalogImagesOrderId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (consumeOrderOverlayBackPress()) {
        event.preventDefault();
        return;
      }
      if (!expandedId) {
        return;
      }
      event.preventDefault();
      setExpandedId(null);
    });

    return unsubscribe;
  }, [expandedId, navigation]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBackPress = () => {
        if (consumeOrderOverlayBackPress()) {
          return true;
        }
        if (editingOrder) {
          setEditingOrder(null);
          return true;
        }
        if (paymentFollowUpNoteSheet) {
          setPaymentFollowUpNoteSheet(null);
          return true;
        }
        if (cardNoteDraft) {
          setCardNoteDraft(null);
          return true;
        }
        if (invoiceDetailsSheetOrder) {
          setInvoiceDetailsSheetOrder(null);
          return true;
        }
        if (moveSheetOrder) {
          setMoveSheetOrder(null);
          return true;
        }
        if (!expandedId) {
          return false;
        }
        setExpandedId(null);
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
      return () => subscription.remove();
    }, [
      cardNoteDraft,
      editingOrder,
      expandedId,
      invoiceDetailsSheetOrder,
      moveSheetOrder,
      paymentFollowUpNoteSheet,
    ]),
  );

  const dismissOrderCardOverlays = useCallback((orderId: string) => {
    setMoveSheetOrder(null);
    setCardNoteDraft((current) => (current?.orderId === orderId ? null : current));
    setInvoiceDetailsSheetOrder((current) => (current?.id === orderId ? null : current));
    setExpandedId((current) => (current === orderId ? null : current));
  }, []);

  const applyFocusedOrder = useCallback(
    (order: MirrorPricingConfirmedOrder, fromSearch = false) => {
      if (!fromSearch && filterConfirmedOrdersForListParams([order], listParams).length === 0) {
        return false;
      }
      const alreadyInStore = useMirrorPricingConfirmedOrdersStore
        .getState()
        .orders.some((entry) => entry.id === order.id);
      if (!alreadyInStore) {
        upsertOrders([order]);
      }
      setFocusOrderOverride((current) => (current?.id === order.id ? current : order));
      setExpandedId((current) => (current === order.id ? current : order.id));
      useOrdersHomeUiStore.getState().clearPendingSearchFocusOrder();
      return true;
    },
    [listParams, upsertOrders],
  );

  useEffect(() => {
    if (!standaloneOrder) {
      return;
    }
    setExpandedId(standaloneOrder.id);
  }, [standaloneOrder?.id]);

  useEffect(() => {
    if (standaloneOrder || !focusOrderId) {
      if (!focusOrderId) {
        appliedFocusKeyRef.current = null;
      }
      return;
    }

    const focusKey = `${focusOrderId}:${focusToken ?? 0}`;
    if (appliedFocusKeyRef.current === focusKey) {
      return;
    }
    appliedFocusKeyRef.current = focusKey;

    const pendingOrder = useOrdersHomeUiStore.getState().pendingSearchFocusOrder;
    if (pendingOrder?.id === focusOrderId) {
      applyFocusedOrder(pendingOrder, true);
      return;
    }

    const listHasOrder = ordersRef.current.some((order) => order.id === focusOrderId);
    if (listHasOrder) {
      setExpandedId((current) => (current === focusOrderId ? current : focusOrderId));
      setFocusOrderOverride((current) => (current === null ? current : null));
      return;
    }

    const inStore = useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.find((order) => order.id === focusOrderId);
    if (inStore && applyFocusedOrder(inStore)) {
      return;
    }

    let cancelled = false;
    void fetchConfirmedOrderById(focusOrderId).then((order) => {
      if (cancelled || !order) {
        return;
      }
      applyFocusedOrder(order);
    });

    return () => {
      cancelled = true;
    };
  }, [applyFocusedOrder, focusOrderId, focusToken, standaloneOrder]);

  const listHasMore = isStandalone ? false : hasMore;
  const listLoadingMore = isStandalone ? false : loadingMore;
  const listLoadMore = isStandalone ? async () => undefined : loadMore;

  useEffect(() => {
    if (!focusOrderId || expandedId !== focusOrderId) {
      return;
    }
    const index = displayOrders.findIndex((order) => order.id === focusOrderId);
    if (index < 0) {
      return;
    }
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({index, animated: true, viewPosition: 0.1});
    }, 120);
    return () => clearTimeout(timer);
  }, [displayOrders, expandedId, focusOrderId]);



  const displayOrdersRevisionKey = useMemo(
    () => confirmedOrdersPageSnapshotKey(displayOrders),
    [displayOrders],
  );

  const styles = useMemo(

    () =>

      StyleSheet.create({

        root: {flex: 1, gap: theme.spacing.xs},
        listContent: {flexGrow: 1, paddingBottom: theme.spacing.sm},
        listSeparator: {height: theme.spacing.xs},
        loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing.lg},
        listFooter: {
          minHeight: 48,
          paddingVertical: theme.spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        loadMoreButton: {
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
          paddingVertical: theme.spacing.md,
        },
        loadMoreText: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },

        sectionTitle: {

          fontSize: theme.typographyScale.size.md,

          fontWeight: '700',

          marginBottom: theme.spacing.xs,

        },

        orderCard: {padding: theme.spacing.sm, gap: theme.spacing.xs},
        orderCardFrame: {
          borderWidth: 1,
          borderColor: theme.colors.background === '#F8FAFC' ? '#1A3352' : '#5B7FA6',
        },

        orderHeader: {
          flexDirection: row,
          alignItems: 'flex-start',
          gap: theme.spacing.xs,
        },

        orderIconWrap: {
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${theme.status.success}18`,
        },

        orderContent: {flex: 1, minWidth: 0, gap: 2},

        orderTopRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.xs,
        },
        favoriteButton: {
          width: 28,
          height: 28,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        paymentFollowUpButton: {
          width: 28,
          height: 28,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        orderIdentity: {flex: 1, minWidth: 0, gap: 1},
        orderCompactMeta: {
          flexDirection: row,
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: 1,
        },
        orderConfirmedByRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: 4,
          marginTop: 2,
        },
        orderConfirmedByText: {
          fontSize: 10,
          lineHeight: 13,
          fontStyle: 'italic',
        },

        orderTitle: {fontSize: theme.typographyScale.size.xs, fontWeight: '700', lineHeight: 16},

        orderInvoice: {fontSize: theme.typographyScale.size.xs, fontWeight: '800', lineHeight: 16},

        orderMeta: {fontSize: 11, lineHeight: 15},

        orderTotalRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        },

        expandedBody: {
          gap: theme.spacing.xs,
          paddingTop: theme.spacing.xs,
          borderTopWidth: StyleSheet.hairlineWidth,
        },

        detailSection: {gap: 4},

        detailSectionTitle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.35,
          textTransform: 'uppercase',
        },

        detailSectionBody: {gap: 2},

        itemRow: {
          flexDirection: row,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.xs,
          paddingVertical: 3,
        },

        itemRowMain: {flex: 1, minWidth: 0, gap: 1},

        itemTitle: {fontSize: theme.typographyScale.size.xs, fontWeight: '700', lineHeight: 15},

        itemMeta: {fontSize: 11, lineHeight: 14},

        paymentBox: {
          borderRadius: theme.components.input.radius,
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: theme.spacing.xs,
          gap: 2,
        },

        paymentRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.xs,
        },

        paymentTotalRow: {
          marginTop: 2,
          paddingTop: 4,
          borderTopWidth: StyleSheet.hairlineWidth,
        },

        priorCollectedCallout: {
          marginTop: 4,
          fontSize: 11,
          fontWeight: '800',
          lineHeight: 15,
        },

        orderActions: {
          gap: theme.spacing.xs,
        },
        orderActionsSection: {gap: 6},
        orderActionsSectionTitle: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
        },
        orderActionsGrid: {
          flexDirection: row,
          flexWrap: 'wrap',
          gap: 6,
        },
        moveOptionsGrid: {
          gap: 8,
        },
        moveOptionRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: 12,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.components.input.radius,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          backgroundColor: theme.colors.card,
        },
        moveOptionLabel: {
          flex: 1,
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
        orderActionChipHalf: {
          flexGrow: 1,
          flexBasis: '48%',
          maxWidth: '48%',
        },
        orderActionChipThird: {
          flexGrow: 1,
          flexBasis: '31%',
          maxWidth: '31%',
        },
        orderActionsToolsRow: {
          flexDirection: row,
          flexWrap: 'wrap',
          gap: 6,
        },
        orderActionChipTool: {
          flexGrow: 1,
          flexBasis: '48%',
          maxWidth: '48%',
        },
        orderRemoveRow: {
          alignItems: 'center',
          paddingTop: 2,
        },
        orderDetailsChip: {
          alignSelf: 'flex-start',
          minHeight: 28,
          paddingVertical: 4,
          paddingHorizontal: 10,
        },
        orderDetailsChipLabel: {
          fontSize: 10,
          lineHeight: 13,
        },

      }),

    [row, theme],

  );

  const renderListSeparator = useCallback(
    () => <View style={styles.listSeparator} />,
    [styles.listSeparator],
  );

  const listFooter = useMemo(() => {
    if (listLoadingMore) {
      return (
        <View style={styles.listFooter}>
          <ActivityIndicator color={theme.colors.primary} size="small" />
        </View>
      );
    }
    if (listHasMore) {
      return (
        <Pressable
          style={styles.loadMoreButton}
          onPress={() => {
            void listLoadMore();
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.loadMoreText, textStyle, {color: theme.colors.primary}]}>
            {t('ordersLoadMore')}
          </Text>
        </Pressable>
      );
    }
    return <View style={styles.listFooter} />;
  }, [
    listHasMore,
    listLoadMore,
    listLoadingMore,
    styles.listFooter,
    styles.loadMoreButton,
    styles.loadMoreText,
    t,
    textStyle,
    theme.colors.primary,
  ]);



  const confirmRemove = (order: MirrorPricingConfirmedOrder) => {
    Alert.alert(t('mirrorOrdersRemoveTitle'), t('mirrorOrdersRemoveConfirm'), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('confirm'),
        style: 'destructive',
        onPress: () => {
          runRemoveOrder(order);
        },
      },
    ]);
  };

  const runRemoveOrder = (order: MirrorPricingConfirmedOrder) => {
    if (!canDeleteOrdersPermission) {
      Alert.alert(t('error'), t('mirrorOrdersRemoveNotAllowed'));
      return;
    }

    if (expandedId === order.id) {
      setExpandedId(null);
    }

    void (async () => {
      try {
        await deleteConfirmedOrder(order.id);
        clearConfirmedOrdersListCache();
        useOrdersHomeUiStore.getState().bumpCardStatsRevision();
      } catch (error) {
        const code = (error as {code?: string})?.code;
        Alert.alert(
          t('error'),
          code === 'permission-denied'
            ? t('mirrorOrdersRemoveNotAllowed')
            : t('mirrorOrdersRemoveFailed'),
        );
        return;
      }
    })();
  };

  const handleSaveEdit = async (orderId: string, fields: ConfirmedOrderEditFields) => {
    setSavingEdit(true);
    const previous = useMirrorPricingConfirmedOrdersStore.getState().orders.find((o) => o.id === orderId);
    updateOrder(orderId, fields);
    try {
      if (!isMockMode) {
        await updateConfirmedOrder(orderId, fields);
      }
      setEditingOrderPreview(null);
      Alert.alert(t('mirrorOrdersEditSavedTitle'), t('mirrorOrdersEditSaved'));
    } catch {
      if (previous) {
        updateOrder(orderId, previous);
      }
      throw new Error('edit failed');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleShareDelivery = useCallback(
    (order: MirrorPricingConfirmedOrder) => {
      const storeOrder =
        useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === order.id) ??
        null;
      const draftOrder =
        editingOrder?.id === order.id && editingOrderPreview?.id === order.id
          ? editingOrderPreview
          : null;

      void shareOrderWithDeliveryCompany(order, t, {storeOrder, draftOrder});
    },
    [editingOrder, editingOrderPreview, t],
  );

  const handleCatalogAnnotationSave = async (
    orderId: string,
    annotationData: CatalogMirrorImageAnnotationData,
  ) => {
    const order = useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === orderId);
    if (!order) {
      return;
    }

    const previous = useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.find((entry) => entry.id === orderId);
    const pruned = pruneOrderImageAnnotationData(
      order.catalogMirrorImages ?? [],
      order.studioOrderImages,
      annotationData,
    );
    setSavingCatalogImagesOrderId(order.id);
    try {
      const updates = {catalogMirrorImageAnnotationData: pruned};
      updateOrder(orderId, updates);
      if (!isMockMode) {
        await updateConfirmedOrderCatalogAnnotationData(orderId, pruned);
      }
      Alert.alert(t('mirrorCatalogAnnotationSaved'));
    } catch {
      if (previous) {
        updateOrder(orderId, previous);
      }
      Alert.alert(t('error'), t('mirrorCatalogAnnotationSaveFailed'));
      throw new Error('annotation save failed');
    } finally {
      setSavingCatalogImagesOrderId(null);
    }
  };

  const handleCatalogImageReplace = async (
    orderId: string,
    oldImageId: MirrorCatalogImageId,
    newImageId: MirrorCatalogImageId,
  ) => {
    if (oldImageId === newImageId) {
      return;
    }

    const order = useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === orderId);
    if (!order) {
      return;
    }

    const previous = useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.find((entry) => entry.id === orderId);
    const imageIds = normalizeMirrorCatalogImageIds(order.catalogMirrorImages);
    const nextImageIds = imageIds.map((entry) => (entry === oldImageId ? newImageId : entry));
    const nextAnnotationData = {...(order.catalogMirrorImageAnnotationData ?? {})};
    delete nextAnnotationData[oldImageId];
    const prunedAnnotationData = pruneOrderImageAnnotationData(
      nextImageIds,
      order.studioOrderImages,
      nextAnnotationData,
    );
    const updates = {
      catalogMirrorImages: nextImageIds,
      catalogMirrorImageAnnotationData: prunedAnnotationData,
    };

    setSavingCatalogImagesOrderId(order.id);
    try {
      invalidateMirrorCatalogMaterializedUri(oldImageId);
      invalidateMirrorCatalogMaterializedUri(newImageId);
      invalidateCatalogImageMarkerCache(oldImageId);
      updateOrder(orderId, updates);
      if (!isMockMode) {
        await updateConfirmedOrder(orderId, buildConfirmedOrderUpdatePayload(order, updates));
      }
      Alert.alert(t('mirrorCatalogImageReplaced'));
    } catch {
      if (previous) {
        updateOrder(orderId, previous);
      }
      Alert.alert(t('error'), t('mirrorCatalogImageReplaceFailed'));
      throw new Error('catalog image replace failed');
    } finally {
      setSavingCatalogImagesOrderId(null);
    }
  };

  const handleCatalogImageRemove = async (
    orderId: string,
    imageId: MirrorCatalogImageId,
  ) => {
    const order = useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === orderId);
    if (!order) {
      return;
    }

    const previous = useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.find((entry) => entry.id === orderId);
    const imageIds = normalizeMirrorCatalogImageIds(order.catalogMirrorImages);
    const nextImageIds = imageIds.filter((entry) => entry !== imageId);
    const nextAnnotationData = {...(order.catalogMirrorImageAnnotationData ?? {})};
    delete nextAnnotationData[imageId];
    const prunedAnnotationData = pruneOrderImageAnnotationData(
      nextImageIds,
      order.studioOrderImages,
      nextAnnotationData,
    );
    const updates = {
      catalogMirrorImages: nextImageIds.length > 0 ? nextImageIds : undefined,
      catalogMirrorImageAnnotationData: prunedAnnotationData,
    };

    setSavingCatalogImagesOrderId(order.id);
    try {
      updateOrder(orderId, updates);
      if (!isMockMode) {
        await updateConfirmedOrder(orderId, buildConfirmedOrderUpdatePayload(order, updates));
      }
      Alert.alert(t('mirrorCatalogImageRemoved'));
    } catch {
      if (previous) {
        updateOrder(orderId, previous);
      }
      Alert.alert(t('error'), t('mirrorCatalogImageRemoveFailed'));
      throw new Error('catalog image remove failed');
    } finally {
      setSavingCatalogImagesOrderId(null);
    }
  };

  const handleStudioImageRemove = async (orderId: string, imageUrl: string) => {
    const order = useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === orderId);
    if (!order) {
      return;
    }

    const previous = useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.find((entry) => entry.id === orderId);
    const nextStudioImages = (order.studioOrderImages ?? []).filter((entry) => entry !== imageUrl);
    const nextAnnotationData = {...(order.catalogMirrorImageAnnotationData ?? {})};
    delete nextAnnotationData[imageUrl];
    const prunedAnnotationData = pruneOrderImageAnnotationData(
      order.catalogMirrorImages ?? [],
      nextStudioImages,
      nextAnnotationData,
    );
    const updates = {
      studioOrderImages: nextStudioImages.length > 0 ? nextStudioImages : undefined,
      catalogMirrorImageAnnotationData: prunedAnnotationData,
    };

    setSavingCatalogImagesOrderId(order.id);
    try {
      updateOrder(orderId, updates);
      if (!isMockMode) {
        await updateConfirmedOrder(orderId, buildConfirmedOrderUpdatePayload(order, updates));
      }
      Alert.alert(t('mirrorCatalogImageRemoved'));
    } catch {
      if (previous) {
        updateOrder(orderId, previous);
      }
      Alert.alert(t('error'), t('mirrorCatalogImageRemoveFailed'));
      throw new Error('studio image remove failed');
    } finally {
      setSavingCatalogImagesOrderId(null);
    }
  };

  const handleCatalogImageReplaceWithStudio = async (
    orderId: string,
    oldImageId: MirrorCatalogImageId,
  ) => {
    if (!currentUser?.id || savingCatalogImagesOrderId) {
      return;
    }

    const picked = await pickImage();
    if (!picked) {
      return;
    }

    const order = useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === orderId);
    if (!order) {
      return;
    }

    const catalogIds = normalizeMirrorCatalogImageIds(order.catalogMirrorImages);
    if (!catalogIds.includes(oldImageId)) {
      return;
    }

    const previous = useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.find((entry) => entry.id === orderId);

    setSavingCatalogImagesOrderId(order.id);
    try {
      const uploadedUrls = await uploadOrderStudioImages([picked], currentUser.id);
      const newUrl = uploadedUrls[0];
      if (!newUrl) {
        Alert.alert(t('error'), t('mirrorCatalogImageReplaceFailed'));
        return;
      }

      const updates = buildCatalogToStudioReplaceUpdates(order, oldImageId, newUrl);
      invalidateMirrorCatalogMaterializedUri(oldImageId);
      invalidateCatalogImageMarkerCache(oldImageId);
      updateOrder(orderId, updates);
      if (!isMockMode) {
        await updateConfirmedOrder(orderId, buildConfirmedOrderUpdatePayload(order, updates));
      }
      Alert.alert(t('mirrorCatalogReplacedWithStudio'));
    } catch (error) {
      if (previous) {
        updateOrder(orderId, previous);
      }
      Alert.alert(t('error'), getOrderStudioImageSaveErrorMessage(error));
      throw new Error('catalog to studio replace failed');
    } finally {
      setSavingCatalogImagesOrderId(null);
    }
  };

  const handleStudioImageReplace = async (orderId: string, oldUrl: string) => {
    if (!currentUser?.id || savingCatalogImagesOrderId) {
      return;
    }

    const picked = await pickImage();
    if (!picked) {
      return;
    }

    const order = useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === orderId);
    if (!order || !(order.studioOrderImages ?? []).includes(oldUrl)) {
      return;
    }

    const previous = useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.find((entry) => entry.id === orderId);

    setSavingCatalogImagesOrderId(order.id);
    try {
      const uploadedUrls = await uploadOrderStudioImages([picked], currentUser.id);
      const newUrl = uploadedUrls[0];
      if (!newUrl || newUrl === oldUrl) {
        Alert.alert(t('error'), t('mirrorCatalogImageReplaceFailed'));
        return;
      }

      const updates = buildStudioImageReplaceUpdates(order, oldUrl, newUrl);
      invalidateCatalogImageMarkerCache(oldUrl);
      updateOrder(orderId, updates);
      if (!isMockMode) {
        await updateConfirmedOrder(orderId, buildConfirmedOrderUpdatePayload(order, updates));
      }
      Alert.alert(t('orderStudioImageReplaced'));
    } catch (error) {
      if (previous) {
        updateOrder(orderId, previous);
      }
      Alert.alert(t('error'), getOrderStudioImageSaveErrorMessage(error));
      throw new Error('studio image replace failed');
    } finally {
      setSavingCatalogImagesOrderId(null);
    }
  };

  const handleStudioImageReplaceWithCatalog = async (
    orderId: string,
    oldUrl: string,
    newImageId: MirrorCatalogImageId,
  ) => {
    const order = useMirrorPricingConfirmedOrdersStore.getState().orders.find((entry) => entry.id === orderId);
    if (!order || !(order.studioOrderImages ?? []).includes(oldUrl)) {
      return;
    }

    const previous = useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.find((entry) => entry.id === orderId);

    setSavingCatalogImagesOrderId(order.id);
    try {
      const updates = buildStudioToCatalogReplaceUpdates(order, oldUrl, newImageId);
      invalidateMirrorCatalogMaterializedUri(newImageId);
      invalidateCatalogImageMarkerCache(oldUrl);
      updateOrder(orderId, updates);
      if (!isMockMode) {
        await updateConfirmedOrder(orderId, buildConfirmedOrderUpdatePayload(order, updates));
      }
      Alert.alert(t('mirrorCatalogImageReplaced'));
    } catch {
      if (previous) {
        updateOrder(orderId, previous);
      }
      Alert.alert(t('error'), t('mirrorCatalogImageReplaceFailed'));
      throw new Error('studio to catalog replace failed');
    } finally {
      setSavingCatalogImagesOrderId(null);
    }
  };

  const buildConfirmedOrderUpdatePayload = (
    order: MirrorPricingConfirmedOrder,
    overrides: Partial<ConfirmedOrderUpdatePayload> = {},
  ): ConfirmedOrderUpdatePayload => ({
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerLocation: order.customerLocation,
    customerNotes: order.customerNotes,
    customerPhotosLink: order.customerPhotosLink,
    catalogMirrorImages: order.catalogMirrorImages,
    catalogMirrorImageAnnotationData: order.catalogMirrorImageAnnotationData,
    studioOrderImages: order.studioOrderImages,
    collectedAmount: order.collectedAmount,
    subtotal: resolveConfirmedOrderSubtotal(order),
    discountAmount: resolveConfirmedOrderDiscount(order),
    total: order.total,
    remainingAmount: resolveConfirmedOrderRemaining(order),
    items: order.items,
    status: resolveMirrorPricingOrderStatus(order.status),
    statusChangedAt: order.statusChangedAt ?? order.confirmedAt,
    homeCardId: order.homeCardId,
    paymentFollowUpRequired: order.paymentFollowUpRequired,
    paymentFollowUpNote: order.paymentFollowUpNote,
    paymentFollowUpAt: order.paymentFollowUpAt,
    orderCardNote: order.orderCardNote,
    ...overrides,
  });

  const applyOrderMove = async (
    order: MirrorPricingConfirmedOrder,
    overrides: Partial<ConfirmedOrderUpdatePayload>,
  ): Promise<boolean> => {
    if (movingOrderId) {
      return false;
    }

    dismissOrderCardOverlays(order.id);
    setMovingOrderId(order.id);

    const previous = useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.find((entry) => entry.id === order.id);
    const destinationBefore = resolveOrderMoveDestinationKey(order);
    const currentStatus = resolveMirrorPricingOrderStatus(order.status);
    const requestedStatus = overrides.status ?? currentStatus;
    const statusChanged = requestedStatus !== currentStatus;
    const cardChanged =
      'homeCardId' in overrides && overrides.homeCardId !== order.homeCardId;
    const payload = buildConfirmedOrderUpdatePayload(order, {
      ...overrides,
    });
    const destinationAfter = resolveOrderMoveDestinationKey({
      ...order,
      ...payload,
    });
    const destinationChanged = destinationBefore !== destinationAfter;
    const shouldStampMove = destinationChanged || statusChanged || cardChanged;
    const moveFields =
      destinationChanged && currentUser
        ? {
            lastMovedByUserId: currentUser.id,
            lastMovedByUserName: currentUser.name?.trim() || currentUser.id,
            lastMovedFromLabel: getAddOrderDestinationLabel(destinationBefore, allHomeCards, t),
            lastMovedToLabel: getAddOrderDestinationLabel(destinationAfter, allHomeCards, t),
          }
        : {};
    const clearFavoriteFields =
      destinationChanged && order.isFavorite
        ? {isFavorite: false as const, favoritedAt: undefined}
        : {};
    const finalPayload = shouldStampMove
      ? {
          ...payload,
          statusChangedAt: new Date().toISOString(),
          ...moveFields,
          ...clearFavoriteFields,
        }
      : {...payload, ...clearFavoriteFields};

    updateOrder(order.id, finalPayload);
    try {
      if (!isMockMode) {
        await updateConfirmedOrder(order.id, pickOrderMoveFirestorePayload(finalPayload));
      }
    } catch {
      if (previous) {
        updateOrder(order.id, previous);
      }
      Alert.alert(t('error'), t('mirrorOrdersStatusUpdateFailed'));
      return false;
    } finally {
      setMovingOrderId(null);
    }

    if (destinationChanged) {
      clearConfirmedOrdersListCache();
      useOrdersHomeUiStore.getState().bumpCardStatsRevision();
    }

    return true;
  };

  const completeOrderWithFullPayment = (
    order: MirrorPricingConfirmedOrder,
    extraOverrides: Partial<ConfirmedOrderUpdatePayload> = {},
  ) => {
    const latest = resolveLatestConfirmedOrder(order);
    const priorCollectedSnapshot = shouldSnapshotPriorCollectedAmount(latest)
      ? roundMoney(latest.collectedAmount)
      : undefined;

    void applyOrderMove(latest, {
      status: 'completed',
      collectedAmount: roundMoney(latest.total),
      remainingAmount: 0,
      homeCardId: undefined,
      paymentFollowUpRequired: false,
      paymentFollowUpNote: undefined,
      paymentFollowUpAt: undefined,
      priorCollectedAmount: priorCollectedSnapshot,
      ...extraOverrides,
    });
  };

  const handleCardNoteSave = async (note: string) => {
    if (!cardNoteDraft) {
      return;
    }

    const trimmed = note.trim();
    const updates = {orderCardNote: trimmed || undefined};
    const previous = useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.find((entry) => entry.id === cardNoteDraft.orderId);

    setCardNoteSaving(true);
    updateOrder(cardNoteDraft.orderId, updates);
    try {
      if (!isMockMode) {
        await updateConfirmedOrderCardNote(cardNoteDraft.orderId, trimmed || undefined);
      }
      setCardNoteDraft(null);
    } catch {
      if (previous) {
        updateOrder(cardNoteDraft.orderId, {
          orderCardNote: previous.orderCardNote,
        });
      }
      Alert.alert(t('error'), t('mirrorOrdersCardNoteSaveFailed'));
    } finally {
      setCardNoteSaving(false);
    }
  };

  const handlePaymentFollowUpNoteSave = async (note: string) => {
    if (!paymentFollowUpNoteSheet) {
      return;
    }

    const {order, mode} = paymentFollowUpNoteSheet;
    const latest = resolveLatestConfirmedOrder(order);
    setPaymentFollowUpSaving(true);
    try {
      if (mode === 'move') {
        const success = await applyOrderMove(latest, {
          status: 'completed',
          homeCardId: undefined,
          paymentFollowUpRequired: true,
          paymentFollowUpNote: note,
          paymentFollowUpAt: new Date().toISOString(),
        });
        if (success) {
          setPaymentFollowUpNoteSheet(null);
        }
        return;
      }

      const updates = {
        paymentFollowUpNote: note,
        paymentFollowUpAt: new Date().toISOString(),
      };
      const previous = useMirrorPricingConfirmedOrdersStore
        .getState()
        .orders.find((entry) => entry.id === order.id);
      updateOrder(order.id, updates);
      try {
        if (!isMockMode) {
          await updateConfirmedOrder(order.id, updates);
        }
        setPaymentFollowUpNoteSheet(null);
      } catch {
        if (previous) {
          updateOrder(order.id, previous);
        }
        Alert.alert(t('error'), t('mirrorOrdersPaymentFollowUpNoteSaveFailed'));
      }
    } finally {
      setPaymentFollowUpSaving(false);
    }
  };

  const handlePaymentFollowUpAlertPress = (order: MirrorPricingConfirmedOrder) => {
    Alert.alert(
      t('mirrorOrdersPaymentFollowUpTitle'),
      t('mirrorOrdersPaymentFollowUpMessage'),
      [
        {
          text: t('mirrorOrdersPaymentFollowUpEditNote'),
          onPress: () => {
            setPaymentFollowUpNoteSheet({order, mode: 'edit'});
          },
        },
        {text: t('mirrorOrdersPaymentFollowUpNo'), style: 'cancel'},
        {
          text: t('mirrorOrdersPaymentFollowUpYes'),
          onPress: () => {
            completeOrderWithFullPayment(order);
          },
        },
      ],
    );
  };

  const promptCompletedPaymentOnMove = (order: MirrorPricingConfirmedOrder) => {
    const latest = resolveLatestConfirmedOrder(order);
    setMoveSheetOrder(null);

    Alert.alert(
      t('mirrorOrdersMoveToCompletedPaymentTitle'),
      t('mirrorOrdersMoveToCompletedPaymentMessage'),
      [
        {text: t('cancel'), style: 'cancel'},
        {
          text: t('mirrorOrdersMoveToCompletedPaymentNo'),
          onPress: () => {
            setPaymentFollowUpNoteSheet({order: latest, mode: 'move'});
          },
        },
        {
          text: t('mirrorOrdersMoveToCompletedPaymentYes'),
          onPress: () => {
            completeOrderWithFullPayment(latest);
          },
        },
      ],
    );
  };

  const handleMoveOrder = (order: MirrorPricingConfirmedOrder, target: MirrorPricingOrderMoveTarget) => {
    if (!canMoveOrderStatus || movingOrderId) {
      return;
    }

    const latest = resolveLatestConfirmedOrder(order);

    if (target === 'completed' || target === 'completed_outstanding') {
      promptCompletedPaymentOnMove(latest);
      return;
    }

    const status = resolveMirrorPricingOrderMoveTargetStatus(target);
    if (!orderWouldChangeDestination(latest, target)) {
      return;
    }

    setMoveSheetOrder(null);
    void applyOrderMove(latest, {status, homeCardId: undefined});
  };

  const handleMoveToCustomCard = (order: MirrorPricingConfirmedOrder, cardId: string) => {
    const latest = resolveLatestConfirmedOrder(order);
    if (!canMoveOrderStatus || movingOrderId || latest.homeCardId === cardId) {
      return;
    }
    setMoveSheetOrder(null);
    void applyOrderMove(latest, {homeCardId: cardId});
  };

  const resolveMoveTargetLabel = (target: MirrorPricingOrderMoveTarget): string =>
    getOrderMoveDestinationLabel(target, visibleHomeCards, t);

  const moveSheetDestinations = useMemo(() => {
    if (!moveSheetOrder) {
      return {destinations: [], statusTargets: [], customCards: []};
    }
    return getOrderMoveDestinations(moveSheetOrder, visibleHomeCards);
  }, [moveSheetOrder, visibleHomeCards]);

  const applyFavoriteToggle = (order: MirrorPricingConfirmedOrder, nextFavorite: boolean) => {
    const previous = useMirrorPricingConfirmedOrdersStore
      .getState()
      .orders.find((entry) => entry.id === order.id);
    const updates = {
      isFavorite: nextFavorite,
      favoritedAt: nextFavorite ? new Date().toISOString() : undefined,
    };

    updateOrder(order.id, updates);
    void (async () => {
      try {
        if (!isMockMode) {
          await updateConfirmedOrderFavorite(order.id, nextFavorite);
        }
      } catch {
        if (previous) {
          updateOrder(order.id, {
            isFavorite: previous.isFavorite,
            favoritedAt: previous.favoritedAt,
          });
        }
        Alert.alert(t('error'), t('saveFailed'));
      }
    })();
  };

  const handleToggleFavorite = (order: MirrorPricingConfirmedOrder) => {
    if (order.isFavorite) {
      Alert.alert(t('mirrorOrdersRemoveFavorite'), t('mirrorOrdersRemoveFavoriteConfirmMessage'), [
        {text: t('no'), style: 'cancel'},
        {text: t('yes'), onPress: () => applyFavoriteToggle(order, false)},
      ]);
      return;
    }

    Alert.alert(t('mirrorOrdersAddFavorite'), t('mirrorOrdersAddFavoriteConfirmMessage'), [
      {text: t('no'), style: 'cancel'},
      {text: t('yes'), onPress: () => applyFavoriteToggle(order, true)},
    ]);
  };

  const runOrderExport = async (order: MirrorPricingConfirmedOrder) => {
    setExportingOrderId(order.id);
    try {
      await exportMirrorConfirmedOrderReport(order, t, {
        isRtl: isRTL,
        appName: t('appName'),
      });
    } catch (error) {
      console.error('[MirrorPricingConfirmedOrdersPanel] export failed', error);
      Alert.alert(t('error'), t('mirrorOrderExportFailed'));
    } finally {
      setExportingOrderId(null);
    }
  };

  const handleExportOrder = (order: MirrorPricingConfirmedOrder) => {
    void runOrderExport(order);
  };

  const renderCustomerLabel = (order: MirrorPricingConfirmedOrder) => {

    const name = order.customerName.trim();

    if (name) {

      return name;

    }

    return t('mirrorOrdersNoCustomerName');

  };



  if (loading && displayOrders.length === 0) {
    return (
      <View style={styles.root}>
        {showTitle ? (
          <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
            {displayTitle}
          </Text>
        ) : null}
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (displayOrders.length === 0) {

    return (

      <View style={styles.root}>

        {showTitle ? (

          <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>

            {displayTitle}

          </Text>

        ) : null}

        <EmptyState icon="clipboard-check-outline" message={statusEmptyMessage} />

      </View>

    );

  }



  return (

    <View style={styles.root}>

      <FlatList
        ref={listRef}
        data={displayOrders}
        keyExtractor={(item) => item.id}
        extraData={`${expandedId ?? ''}:${displayOrdersRevisionKey}`}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews={false}
        ItemSeparatorComponent={renderListSeparator}
        onScrollToIndexFailed={({index}) => {
          listRef.current?.scrollToOffset({offset: Math.max(0, index * 120), animated: true});
        }}
        onEndReached={() => {
          if (listHasMore && !listLoadingMore) {
            void listLoadMore();
          }
        }}
        onEndReachedThreshold={0.25}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          showTitle ? (
            <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
              {displayTitle} ({totalCount ?? displayOrders.length})
            </Text>
          ) : null
        }
        renderItem={({item: order}) => {

        const expanded = expandedId === order.id;

        const itemCount = resolveConfirmedOrderPieceCount(order);

        const remainingAmount = resolveConfirmedOrderRemaining(order);

        const priorCollectedAmount = resolvePriorCollectedAmount(order);

        const orderSubtotal = resolveConfirmedOrderSubtotal(order);

        const orderDiscount = resolveConfirmedOrderDiscount(order);
        const invoiceLabel = formatMirrorOrderInvoiceLabel(order.invoiceNumber);
        const confirmedByName = resolveOrderConfirmedByName(order, usersById);
        const hasMoveOptions = hasOrderMoveDestinations(order, visibleHomeCards);

        return (

          <Pressable

            style={[styles.orderCard, listCard, styles.orderCardFrame]}

            onPress={() => {
              const nextExpanded = expanded ? null : order.id;
              setExpandedId(nextExpanded);
              if (!nextExpanded) {
                setMoveSheetOrder(null);
                setInvoiceDetailsSheetOrder((current) =>
                  current?.id === order.id ? null : current,
                );
              }
            }}

            accessibilityRole="button"

          >

            <View style={styles.orderHeader}>
              <View style={styles.orderIconWrap}>
                <MaterialCommunityIcons name="clipboard-check" size={16} color={theme.status.success} />
              </View>

              <View style={styles.orderContent}>
                <View style={styles.orderTopRow}>
                  <View style={styles.orderIdentity}>
                    {invoiceLabel ? (
                      <Text style={[styles.orderInvoice, ltrTextStyle, {color: theme.colors.primary}]}>
                        {invoiceLabel}
                      </Text>
                    ) : null}
                    <Text
                      style={[styles.orderTitle, inlineTextStyle, {color: theme.typography.primary}]}
                      numberOfLines={expanded ? undefined : 1}
                    >
                      {renderCustomerLabel(order)}
                    </Text>
                  </View>
                  {hasPaymentFollowUp(order) ? (
                    <Pressable
                      onPress={() => handlePaymentFollowUpAlertPress(order)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('mirrorOrdersPaymentFollowUpAlertA11y')}
                      style={styles.paymentFollowUpButton}
                    >
                      <MaterialCommunityIcons
                        name="alert-circle"
                        size={22}
                        color={theme.status.warning}
                      />
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => handleToggleFavorite(order)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={
                      order.isFavorite ? t('mirrorOrdersRemoveFavorite') : t('mirrorOrdersAddFavorite')
                    }
                    style={styles.favoriteButton}
                  >
                    <MaterialCommunityIcons
                      name={order.isFavorite ? 'star' : 'star-outline'}
                      size={20}
                      color={order.isFavorite ? '#FBBF24' : theme.colors.icon}
                    />
                  </Pressable>
                  <AmountText amount={order.total} size="sm" currencyLabel={t('currencyLabel')} />
                </View>

                {hasPaymentFollowUp(order) && order.paymentFollowUpNote?.trim() ? (
                  <OrderNoteBanner note={order.paymentFollowUpNote} inlineTextStyle={inlineTextStyle} />
                ) : null}

                {hasActiveOrderCardNote(order) ? (
                  <OrderNoteBanner note={order.orderCardNote ?? ''} inlineTextStyle={inlineTextStyle} />
                ) : null}

                {order.customerPhone.trim() ? (
                  <ConfirmedOrderInfoRow icon="phone-outline" dense>
                    <CustomerPhoneLink
                      phone={order.customerPhone}
                      style={[styles.orderMeta, ltrTextStyle]}
                    />
                  </ConfirmedOrderInfoRow>
                ) : null}

                {order.customerPhone2?.trim() ? (
                  <ConfirmedOrderInfoRow icon="phone-plus-outline" dense>
                    <CustomerPhoneLink
                      phone={order.customerPhone2}
                      style={[styles.orderMeta, ltrTextStyle]}
                    />
                  </ConfirmedOrderInfoRow>
                ) : null}

                <OrderLocationFulfillmentRow
                  location={order.customerLocation}
                  fulfillmentType={order.fulfillmentType}
                  dense
                  numberOfLines={expanded ? undefined : 1}
                  textStyle={styles.orderMeta}
                />

                {order.customerPhotosLink?.trim() ? (
                  <ConfirmedOrderInfoRow icon="image-multiple-outline" dense>
                    <LinkableText
                      text={order.customerPhotosLink.trim()}
                      style={[styles.orderMeta, inlineTextStyle, {color: theme.colors.primary}]}
                      numberOfLines={expanded ? undefined : 1}
                    />
                  </ConfirmedOrderInfoRow>
                ) : null}

                {expanded && order.customerNotes?.trim() ? (
                  <ConfirmedOrderInfoRow icon="note-text-outline" dense>
                    <Text style={[styles.orderMeta, inlineTextStyle, {color: theme.typography.secondary}]}>
                      {order.customerNotes.trim()}
                    </Text>
                  </ConfirmedOrderInfoRow>
                ) : null}

                {expanded && order.pieceCount && order.pieceCount > 0 && order.items.length === 0 ? (
                  <ConfirmedOrderInfoRow icon="package-variant" dense>
                    <Text style={[styles.orderMeta, inlineTextStyle, {color: theme.typography.secondary}]}>
                      {t('customerPieceCount')}: {order.pieceCount}
                    </Text>
                  </ConfirmedOrderInfoRow>
                ) : null}

                <View style={styles.orderCompactMeta}>
                  <Text style={[styles.orderMeta, ltrTextStyle, {color: theme.typography.secondary}]}>
                    {formatDateTime(order.confirmedAt)}
                  </Text>
                  {itemCount > 0 ? (
                    <Text style={[styles.orderMeta, inlineTextStyle, {color: theme.typography.secondary}]}>
                      · {t('mirrorCartItemsCount', {count: itemCount})}
                    </Text>
                  ) : null}
                </View>

              </View>

              <MaterialCommunityIcons
                name={expanded ? 'chevron-up' : chevronForward}
                size={18}
                color={theme.colors.icon}
              />
            </View>

            {confirmedByName ? (
              <View
                style={[
                  styles.orderConfirmedByRow,
                  {flexDirection: row, alignSelf: isRTL ? 'flex-end' : 'flex-start'},
                ]}
              >
                <MaterialCommunityIcons
                  name="account-check-outline"
                  size={11}
                  color={theme.typography.secondary}
                />
                <Text
                  style={[
                    styles.orderConfirmedByText,
                    inlineTextStyle,
                    {color: theme.typography.secondary},
                  ]}
                  numberOfLines={1}
                >
                  {confirmedByName}
                </Text>
              </View>
            ) : null}

            {expanded ? (
              <View style={[styles.expandedBody, {borderColor: theme.colors.divider}]}>
                {hasOrderInvoiceExtraLines(order) ? (
                  <ConfirmedOrderActionChip
                    label={t('orderInvoiceDetailsChipLabel')}
                    icon="clipboard-text-outline"
                    tone="success"
                    style={styles.orderDetailsChip}
                    labelStyle={styles.orderDetailsChipLabel}
                    onPress={() => setInvoiceDetailsSheetOrder(order)}
                    disabled={exportingOrderId !== null || savingEdit}
                  />
                ) : null}

                <ConfirmedOrderCatalogImages
                  imageIds={order.catalogMirrorImages}
                  studioImageUrls={order.studioOrderImages}
                  annotationData={
                    shouldPersistImageAnnotationsForOrderStatus(order.status)
                      ? order.catalogMirrorImageAnnotationData
                      : undefined
                  }
                  annotatable={shouldPersistImageAnnotationsForOrderStatus(order.status)}
                  replaceable
                  removable
                  annotating={savingCatalogImagesOrderId === order.id}
                  replacing={savingCatalogImagesOrderId === order.id}
                  removing={savingCatalogImagesOrderId === order.id}
                  onAnnotationDataChange={(data) => handleCatalogAnnotationSave(order.id, data)}
                  onReplaceImage={(oldImageId, newImageId) =>
                    handleCatalogImageReplace(order.id, oldImageId, newImageId)
                  }
                  onReplaceImageWithStudio={(oldImageId) =>
                    handleCatalogImageReplaceWithStudio(order.id, oldImageId)
                  }
                  onRemoveImage={(imageId) => handleCatalogImageRemove(order.id, imageId)}
                  onRemoveStudioImage={(imageUrl) => handleStudioImageRemove(order.id, imageUrl)}
                  onReplaceStudioImage={(imageUrl) => handleStudioImageReplace(order.id, imageUrl)}
                  onReplaceStudioImageWithCatalog={(imageUrl, newImageId) =>
                    handleStudioImageReplaceWithCatalog(order.id, imageUrl, newImageId)
                  }
                />

                {order.items.length > 0 || (order.customAdditions?.length ?? 0) > 0 ? (
                  <View style={styles.detailSection}>
                    <Text
                      style={[styles.detailSectionTitle, inlineTextStyle, {color: theme.typography.secondary}]}
                    >
                      {t('mirrorCartItemsSection')}
                    </Text>
                    <View style={styles.detailSectionBody}>
                      {order.items.map((item) => {
                        const lineTotal = getConfirmedOrderLineTotal(item);

                        return (
                          <View key={item.id} style={styles.itemRow}>
                            <View style={styles.itemRowMain}>
                              <Text
                                style={[styles.itemTitle, inlineTextStyle, {color: theme.typography.primary}]}
                              >
                                {t(item.labelKey)} × {item.quantity}
                              </Text>
                              <Text style={[styles.itemMeta, ltrTextStyle, {color: theme.typography.secondary}]}>
                                {item.lengthCm} × {item.widthCm} {t('mirrorUnitCm')} ·{' '}
                                {item.thickness === '4mm' ? t('mirrorPrice4mm') : t('mirrorPrice6mm')} ·{' '}
                                {formatCurrency(item.unitPrice, t('currencyLabel'))}
                              </Text>
                              {item.note ? (
                                <LinkableText
                                  text={item.note}
                                  style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}
                                />
                              ) : null}
                            </View>
                            <AmountText amount={lineTotal} size="sm" currencyLabel={t('currencyLabel')} />
                          </View>
                        );
                      })}

                      {order.customAdditions?.map((entry) => {
                        const quantity = getCustomAdditionQuantity(entry);
                        const lineTotal = getCustomAdditionLineTotal(entry);

                        return (
                          <View key={entry.id} style={styles.itemRow}>
                            <View style={styles.itemRowMain}>
                              <Text
                                style={[styles.itemTitle, inlineTextStyle, {color: theme.typography.primary}]}
                              >
                                {entry.label} × {quantity}
                              </Text>
                              <Text style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}>
                                {t('mirrorCartCustomAdditionKind')} ·{' '}
                                {formatCurrency(entry.price, t('currencyLabel'))}
                              </Text>
                            </View>
                            <AmountText amount={lineTotal} size="sm" currencyLabel={t('currencyLabel')} />
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <View style={styles.detailSection}>
                  <Text
                    style={[styles.detailSectionTitle, inlineTextStyle, {color: theme.typography.secondary}]}
                  >
                    {t('mirrorCartPaymentInfo')}
                  </Text>
                  <View
                    style={[
                      styles.paymentBox,
                      {
                        backgroundColor: `${theme.colors.primary}08`,
                        borderColor: `${theme.colors.primary}20`,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    {orderDiscount > 0 ? (
                      <>
                        <View style={styles.paymentRow}>
                          <Text style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}>
                            {t('mirrorCartSubtotal')}
                          </Text>
                          <AmountText amount={orderSubtotal} size="sm" currencyLabel={t('currencyLabel')} />
                        </View>
                        <View style={styles.paymentRow}>
                          <Text style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}>
                            {t('mirrorCartDiscount')}
                          </Text>
                          <Text
                            style={[
                              ltrTextStyle,
                              {
                                color: theme.status.success,
                                fontWeight: '700',
                                fontSize: 11,
                              },
                            ]}
                          >
                            − {formatCurrency(orderDiscount, t('currencyLabel'))}
                          </Text>
                        </View>
                      </>
                    ) : null}

                    <View style={[styles.paymentRow, styles.paymentTotalRow, {borderColor: theme.colors.divider}]}>
                      <Text style={[styles.itemTitle, inlineTextStyle, {color: theme.typography.primary}]}>
                        {t('mirrorCartFullPrice')}
                      </Text>
                      <AmountText amount={order.total} size="sm" currencyLabel={t('currencyLabel')} />
                    </View>

                    {order.collectedAmount > 0 ? (
                      <>
                        {priorCollectedAmount != null ? (
                          <Text
                            style={[
                              styles.priorCollectedCallout,
                              inlineTextStyle,
                              {color: theme.status.warning},
                            ]}
                          >
                            *** {t('mirrorOrdersPriorCollectedAmount')}:{' '}
                            {formatCurrency(priorCollectedAmount, t('currencyLabel'))}
                          </Text>
                        ) : null}
                        <View style={styles.paymentRow}>
                          <Text style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}>
                            {priorCollectedAmount != null
                              ? t('mirrorCartCollectedAmountFull')
                              : t('mirrorCartCollectedAmount')}
                          </Text>
                          <AmountText amount={order.collectedAmount} size="sm" currencyLabel={t('currencyLabel')} />
                        </View>
                        {priorCollectedAmount == null ? (
                          <View style={styles.paymentRow}>
                            <Text style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}>
                              {t('mirrorCartRemainingAmount')}
                            </Text>
                            <AmountText amount={remainingAmount} size="sm" currencyLabel={t('currencyLabel')} />
                          </View>
                        ) : null}
                      </>
                    ) : null}
                  </View>
                </View>

                <View style={styles.orderActions}>
                  <View style={styles.orderActionsSection}>
                    <View style={styles.orderActionsToolsRow}>
                      {canMoveOrderStatus && hasMoveOptions ? (
                        <ConfirmedOrderActionChip
                          label={t('mirrorOrdersActionsMove')}
                          icon="swap-horizontal"
                          tone="primary"
                          style={styles.orderActionChipHalf}
                          onPress={() => setMoveSheetOrder(order)}
                          disabled={exportingOrderId !== null || savingEdit || movingOrderId !== null}
                        />
                      ) : null}
                      <ConfirmedOrderActionChip
                        label={t('mirrorOrdersShareDelivery')}
                        icon="truck-delivery-outline"
                        tone="primary"
                        style={
                          canMoveOrderStatus && hasMoveOptions
                            ? styles.orderActionChipHalf
                            : styles.orderActionChipTool
                        }
                        onPress={() => {
                          void handleShareDelivery(order);
                        }}
                        disabled={exportingOrderId !== null || savingEdit}
                      />
                    </View>
                  </View>

                  <View style={styles.orderActionsSection}>
                    <Text
                      style={[
                        styles.orderActionsSectionTitle,
                        inlineTextStyle,
                        {color: theme.typography.secondary},
                      ]}
                    >
                      {t('mirrorOrdersActionsTools')}
                    </Text>
                    <View style={styles.orderActionsToolsRow}>
                      <ConfirmedOrderActionChip
                        label={t('mirrorOrdersEditShort')}
                        icon="pencil-outline"
                        style={styles.orderActionChipTool}
                        onPress={() => {
                          const latest =
                            useMirrorPricingConfirmedOrdersStore
                              .getState()
                              .orders.find((entry) => entry.id === order.id) ?? order;
                          setEditingOrder(latest);
                        }}
                        disabled={exportingOrderId !== null || savingEdit}
                      />
                      {canManageOrderCardNotes ? (
                        <ConfirmedOrderActionChip
                          label={
                            order.orderCardNote?.trim()
                              ? t('mirrorOrdersCardNoteEdit')
                              : t('mirrorOrdersCardNoteAdd')
                          }
                          icon="note-text-outline"
                          style={styles.orderActionChipTool}
                          onPress={() =>
                            setCardNoteDraft({
                              orderId: order.id,
                              initialNote: order.orderCardNote?.trim() ?? '',
                            })
                          }
                          disabled={exportingOrderId !== null || savingEdit || cardNoteSaving}
                        />
                      ) : null}
                      <ConfirmedOrderActionChip
                        label={t('mirrorOrderExportShort')}
                        icon="file-pdf-box"
                        style={styles.orderActionChipTool}
                        onPress={() => {
                          void handleExportOrder(order);
                        }}
                        disabled={exportingOrderId !== null || savingEdit}
                      />
                    </View>
                  </View>

                  {canDeleteOrdersPermission ? (
                    <View style={styles.orderRemoveRow}>
                      <ConfirmedOrderActionChip
                        label={t('mirrorOrdersRemove')}
                        icon="trash-can-outline"
                        tone="danger"
                        onPress={() => confirmRemove(order)}
                        disabled={exportingOrderId !== null || savingEdit}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

          </Pressable>

        );

        }}
      />



      <LoadingOverlay
        visible={
          exportingOrderId !== null ||
          savingEdit ||
          savingCatalogImagesOrderId !== null ||
          movingOrderId !== null
        }
      />

      <EditConfirmedOrderSheet
        order={editingOrder}
        visible={editingOrder !== null}
        saving={savingEdit}
        onClose={() => {
          setEditingOrder(null);
          setEditingOrderPreview(null);
        }}
        onSave={handleSaveEdit}
        onPreviewChange={setEditingOrderPreview}
      />

      <BottomSheet
        visible={moveSheetOrder !== null}
        title={t('mirrorOrdersActionsMove')}
        onClose={() => setMoveSheetOrder(null)}
        showsScrollIndicator
      >
        <View style={styles.moveOptionsGrid}>
          {moveSheetDestinations.destinations.map((destination) => {
            if (destination.kind === 'status') {
              return (
                <Pressable
                  key={destination.target}
                  style={({pressed}) => [
                    styles.moveOptionRow,
                    {opacity: pressed ? 0.7 : 1},
                  ]}
                  onPress={() => {
                    if (!moveSheetOrder) {
                      return;
                    }
                    handleMoveOrder(moveSheetOrder, destination.target);
                  }}
                  disabled={exportingOrderId !== null || savingEdit || movingOrderId !== null}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name={getMirrorPricingOrderMoveTargetIcon(destination.target)}
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[styles.moveOptionLabel, inlineTextStyle, {color: theme.typography.primary}]}
                  >
                    {resolveMoveTargetLabel(destination.target)}
                  </Text>
                  <MaterialCommunityIcons
                    name={chevronForward}
                    size={18}
                    color={theme.colors.icon}
                  />
                </Pressable>
              );
            }

            return (
              <Pressable
                key={destination.card.id}
                style={({pressed}) => [
                  styles.moveOptionRow,
                  {opacity: pressed ? 0.7 : 1},
                ]}
                onPress={() => {
                  if (!moveSheetOrder) {
                    return;
                  }
                  handleMoveToCustomCard(moveSheetOrder, destination.card.id);
                }}
                disabled={exportingOrderId !== null || savingEdit || movingOrderId !== null}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons
                  name="folder-outline"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text
                  style={[styles.moveOptionLabel, inlineTextStyle, {color: theme.typography.primary}]}
                >
                  {destination.card.name}
                </Text>
                <MaterialCommunityIcons
                  name={chevronForward}
                  size={18}
                  color={theme.colors.icon}
                />
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      <OrderPaymentFollowUpNoteSheet
        visible={paymentFollowUpNoteSheet !== null}
        initialNote={paymentFollowUpNoteSheet?.order.paymentFollowUpNote ?? ''}
        saveLabel={
          paymentFollowUpNoteSheet?.mode === 'edit'
            ? t('mirrorOrdersPaymentFollowUpNoteUpdateSave')
            : t('mirrorOrdersPaymentFollowUpNoteSave')
        }
        saving={paymentFollowUpSaving}
        onClose={() => setPaymentFollowUpNoteSheet(null)}
        onSave={handlePaymentFollowUpNoteSave}
      />

      <OrderCardNoteSheet
        visible={cardNoteDraft !== null}
        initialNote={cardNoteDraft?.initialNote ?? ''}
        saving={cardNoteSaving}
        onClose={() => setCardNoteDraft(null)}
        onSave={handleCardNoteSave}
      />

      <OrderInvoiceDetailsSheet
        order={invoiceDetailsSheetOrder}
        onClose={() => setInvoiceDetailsSheetOrder(null)}
      />

    </View>

  );

};



export default MirrorPricingConfirmedOrdersPanel;

