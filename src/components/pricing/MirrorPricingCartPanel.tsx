import React, {useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import AmountText from '@app/components/common/AmountText';
import BottomSheet from '@app/components/common/BottomSheet';
import EmptyState from '@app/components/common/EmptyState';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {
  getMirrorPricingCartCount,
  getMirrorPricingCartDiscount,
  getMirrorPricingCartEffectiveTotal,
  getMirrorPricingCartSubtotal,
  normalizeCartTotalOverride,
  useMirrorPricingCartStore,
} from '@app/stores/mirrorPricingCartStore';
import {useAuthStore} from '@app/stores/authStore';
import {canViewMirrorCartCost} from '@app/utils/adminPermissions';
import {
  getMirrorCartItemLineCost,
  getMirrorCartItemUnitCost,
  getMirrorPricingCartCostTotal,
} from '@app/utils/mirrorPricingCost';
import {getListCardStyle} from '@shared/theme/themeHelpers';
import {exportMirrorCartReport, exportMirrorConfirmedOrderReport} from '@app/utils/exportMirrorCartReport';
import {formatCurrency, roundMoney} from '@app/utils/format';
import {isMockMode} from '@app/config/appMode';
import {createConfirmedOrder, getConfirmedOrderSaveErrorKey} from '@app/services/confirmedOrders.service';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';

interface Props {
  embedded?: boolean;
  onOrderConfirmed?: () => void;
}

const MirrorPricingCartPanel: React.FC<Props> = ({embedded = false, onOrderConfirmed}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, ltrTextStyle, chevronForward, isRTL, appFont} = useDirection();
  const currentUser = useAuthStore((state) => state.user);
  const showCartCost = canViewMirrorCartCost(currentUser);
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const paymentCardStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.primary,
      borderWidth: 2,
      borderRadius: theme.components.card.radius,
      overflow: 'hidden' as const,
      ...theme.shadow.card,
    }),
    [theme],
  );
  const [customerInfoOpen, setCustomerInfoOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const items = useMirrorPricingCartStore((state) => state.items);
  const customerName = useMirrorPricingCartStore((state) => state.customerName);
  const customerPhone = useMirrorPricingCartStore((state) => state.customerPhone);
  const customerLocation = useMirrorPricingCartStore((state) => state.customerLocation);
  const collectedAmount = useMirrorPricingCartStore((state) => state.collectedAmount);
  const cartTotalOverride = useMirrorPricingCartStore((state) => state.cartTotalOverride);
  const setCustomerName = useMirrorPricingCartStore((state) => state.setCustomerName);
  const setCustomerPhone = useMirrorPricingCartStore((state) => state.setCustomerPhone);
  const setCustomerLocation = useMirrorPricingCartStore((state) => state.setCustomerLocation);
  const setCollectedAmount = useMirrorPricingCartStore((state) => state.setCollectedAmount);
  const setCartTotalOverride = useMirrorPricingCartStore((state) => state.setCartTotalOverride);
  const removeItem = useMirrorPricingCartStore((state) => state.removeItem);
  const updateItemQuantity = useMirrorPricingCartStore((state) => state.updateItemQuantity);
  const clearCart = useMirrorPricingCartStore((state) => state.clearCart);
  const addConfirmedOrder = useMirrorPricingConfirmedOrdersStore((state) => state.addOrder);

  const subtotal = useMemo(() => getMirrorPricingCartSubtotal(items), [items]);
  const total = useMemo(
    () => getMirrorPricingCartEffectiveTotal(items, cartTotalOverride),
    [cartTotalOverride, items],
  );
  const discountAmount = useMemo(
    () => getMirrorPricingCartDiscount(items, cartTotalOverride),
    [cartTotalOverride, items],
  );
  const totalCost = useMemo(
    () => (showCartCost ? getMirrorPricingCartCostTotal(items) : 0),
    [showCartCost, items],
  );
  const count = useMemo(() => getMirrorPricingCartCount(items), [items]);
  const remainingAmount = useMemo(
    () => roundMoney(Math.max(0, total - collectedAmount)),
    [collectedAmount, total],
  );
  const hasCustomerInfo = Boolean(
    customerName.trim() ||
      customerPhone.trim() ||
      customerLocation.trim() ||
      collectedAmount > 0,
  );
  const customerPreview = useMemo(() => {
    const parts = [
      customerName.trim(),
      customerPhone.trim(),
      customerLocation.trim(),
      collectedAmount > 0 ? formatCurrency(collectedAmount, t('currencyLabel')) : '',
    ].filter(Boolean);
    if (parts.length === 0) {
      return t('mirrorCartCustomerInfoTap');
    }
    return parts.join(' · ');
  }, [collectedAmount, customerLocation, customerName, customerPhone, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          padding: embedded ? 0 : theme.spacing.md,
          paddingBottom: embedded ? 0 : theme.spacing.xxl,
          gap: theme.spacing.md,
        },
        customerCard: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
        },
        customerIconWrap: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${theme.colors.primary}18`,
        },
        customerContent: {flex: 1, minWidth: 0, gap: 4},
        customerTitle: {fontSize: theme.typographyScale.size.sm, fontWeight: '700'},
        customerPreview: {fontSize: theme.typographyScale.size.xs, lineHeight: 18},
        sheetFields: {gap: theme.spacing.sm, paddingBottom: theme.spacing.md},
        sheetDone: {marginTop: theme.spacing.sm},
        paymentCard: {overflow: 'hidden'},
        paymentHeader: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
        },
        paymentHeaderTitle: {
          flex: 1,
          fontSize: theme.typographyScale.size.md,
          fontWeight: '700',
        },
        paymentBody: {
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        grandTotalBox: {
          borderRadius: theme.components.button.radius,
          padding: theme.spacing.md,
          alignItems: 'stretch',
          gap: theme.spacing.sm,
        },
        grandTotalInput: {marginBottom: 0},
        paymentMetaRow: {
          flexDirection: row,
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
        },
        paymentMetaLabel: {
          flex: 1,
          minWidth: 0,
          fontSize: theme.typographyScale.size.sm,
        },
        adminCostBox: {
          borderRadius: theme.components.input.radius,
          padding: theme.spacing.sm,
          borderWidth: 1,
          borderStyle: 'dashed',
        },
        sectionDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.divider,
          marginVertical: theme.spacing.xs,
        },
        itemsSectionTitle: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
          marginBottom: theme.spacing.xs,
        },
        itemCard: {padding: theme.spacing.md, marginBottom: theme.spacing.sm, gap: theme.spacing.xs},
        itemHeader: {
          flexDirection: row,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        },
        itemTitle: {flex: 1, fontSize: theme.typographyScale.size.sm, fontWeight: '700', lineHeight: 20},
        dimensions: {
          flexShrink: 0,
          alignSelf: 'flex-start',
          fontSize: theme.typographyScale.size.xs,
          marginTop: 2,
        },
        meta: {fontSize: theme.typographyScale.size.xs, lineHeight: 18},
        metaRow: {
          flexDirection: row,
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
          marginTop: 2,
        },
        qtyRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.sm,
        },
        qtyButton: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceSecondary,
        },
        qtyValue: {
          flexShrink: 0,
          minWidth: 28,
          textAlign: 'center',
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        lineTotalRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.xs,
        },
        costRow: {
          paddingTop: theme.spacing.xs,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        actions: {gap: theme.spacing.sm},
      }),
    [embedded, row, theme],
  );

  const handleCartTotalChange = (value: number) => {
    setCartTotalOverride(normalizeCartTotalOverride(value, subtotal));
  };

  const confirmOrder = () => {
    Alert.alert(t('mirrorOrdersConfirmTitle'), t('mirrorOrdersConfirmMessage'), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('mirrorOrdersConfirmAction'),
        onPress: () => {
          void (async () => {
            const confirmedAt = new Date().toISOString();
            const remainingAmount = Math.max(0, total - collectedAmount);
            const orderSnapshot = {
              customerName,
              customerPhone,
              customerLocation,
              collectedAmount,
              subtotal,
              discountAmount: discountAmount > 0 ? discountAmount : undefined,
              total,
              remainingAmount,
              items: items.map((item) => ({...item})),
            };

            let orderId = confirmedAt;
            let savedLocallyOnly = false;
            try {
              if (isMockMode) {
                addConfirmedOrder(orderSnapshot);
                orderId =
                  useMirrorPricingConfirmedOrdersStore.getState().orders[0]?.id ?? confirmedAt;
              } else {
                orderId = await createConfirmedOrder(orderSnapshot, currentUser?.id);
              }
            } catch (error) {
              console.warn('[confirmOrder]', error);
              const errorCode = (error as {code?: string})?.code;

              if (errorCode === 'permission-denied') {
                addConfirmedOrder(orderSnapshot);
                orderId =
                  useMirrorPricingConfirmedOrdersStore.getState().orders[0]?.id ?? confirmedAt;
                savedLocallyOnly = true;
              } else {
                Alert.alert(t('error'), t(getConfirmedOrderSaveErrorKey(error)));
                return;
              }
            }

            clearCart();

            const exportOrder: MirrorPricingConfirmedOrder = {
              ...orderSnapshot,
              id: orderId,
              confirmedAt,
            };

            Alert.alert(
              t('mirrorOrdersConfirmedTitle'),
              savedLocallyOnly
                ? t('confirmedOrderSavedLocallyHint')
                : t('mirrorOrdersConfirmedExportHint'),
              [
                {
                  text: t('mirrorOrderExportInvoice'),
                  onPress: () => {
                    void handleExportConfirmedOrder(exportOrder);
                  },
                },
                {text: t('done'), style: 'cancel'},
              ],
            );
            onOrderConfirmed?.();
          })();
        },
      },
    ]);
  };

  const confirmClear = () => {
    Alert.alert(t('mirrorCartClearTitle'), t('mirrorCartClearConfirm'), [
      {text: t('cancel'), style: 'cancel'},
      {text: t('confirm'), style: 'destructive', onPress: clearCart},
    ]);
  };

  const handleExportPdf = async () => {
    if (items.length === 0) {
      Alert.alert(t('error'), t('mirrorCartExportEmpty'));
      return;
    }

    setExportingPdf(true);
    try {
      await exportMirrorCartReport(
        {
          customerName,
          customerPhone,
          customerLocation,
          collectedAmount,
          items,
          subtotal,
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
          total,
        },
        t,
        {
          isRtl: isRTL,
          appName: t('appName'),
        },
      );
    } catch (error) {
      console.error('[MirrorPricingCartPanel] export failed', error);
      Alert.alert(t('error'), t('mirrorCartExportFailed'));
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportConfirmedOrder = async (order: MirrorPricingConfirmedOrder) => {
    setExportingPdf(true);
    try {
      await exportMirrorConfirmedOrderReport(order, t, {
        isRtl: isRTL,
        appName: t('appName'),
      });
    } catch (error) {
      console.error('[MirrorPricingCartPanel] confirmed order export failed', error);
      Alert.alert(t('error'), t('mirrorCartExportFailed'));
    } finally {
      setExportingPdf(false);
    }
  };

  const renderDiscountRow = (amount: number) => (
    <View style={styles.paymentMetaRow}>
      <Text style={[styles.paymentMetaLabel, inlineTextStyle, {color: theme.typography.secondary}]}>
        {t('mirrorCartDiscount')}
      </Text>
      <Text style={[ltrTextStyle, appFont('bold'), {color: theme.status.success, fontSize: theme.typographyScale.size.sm}]}>
        − {formatCurrency(amount, t('currencyLabel'))}
      </Text>
    </View>
  );

  const renderPaymentMetaRow = (label: string, amount: number, tone?: 'cost') => (
    <View style={styles.paymentMetaRow}>
      <Text
        style={[
          styles.paymentMetaLabel,
          inlineTextStyle,
          {color: tone === 'cost' ? theme.status.warning : theme.typography.secondary},
        ]}
      >
        {label}
      </Text>
      <AmountText amount={amount} size="sm" currencyLabel={t('currencyLabel')} />
    </View>
  );

  const content = (
    <>
        <Pressable
          style={[styles.customerCard, listCard]}
          onPress={() => setCustomerInfoOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('mirrorCartCustomerInfo')}
        >
          <View style={styles.customerIconWrap}>
            <MaterialCommunityIcons name="card-account-details-outline" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.customerContent}>
            <Text style={[styles.customerTitle, textStyle, {color: theme.typography.primary}]}>
              {t('mirrorCartCustomerInfo')}
            </Text>
            <Text
              style={[
                styles.customerPreview,
                hasCustomerInfo ? inlineTextStyle : textStyle,
                ltrTextStyle,
                {color: hasCustomerInfo ? theme.typography.secondary : theme.typography.secondary},
              ]}
              numberOfLines={2}
            >
              {customerPreview}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={hasCustomerInfo ? 'check-circle' : chevronForward}
            size={22}
            color={hasCustomerInfo ? theme.status.success : theme.colors.icon}
          />
        </Pressable>

        <View style={[styles.paymentCard, paymentCardStyle]}>
          <View style={[styles.paymentHeader, {backgroundColor: theme.colors.primary}]}>
            <MaterialCommunityIcons name="cash-multiple" size={22} color={theme.colors.onPrimary} />
            <Text style={[styles.paymentHeaderTitle, textStyle, {color: theme.colors.onPrimary}]}>
              {t('mirrorCartPaymentInfo')}
            </Text>
          </View>

          <View style={[styles.paymentBody, {backgroundColor: `${theme.colors.primary}0D`}]}>
            {items.length > 0 ? (
              <>
                <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary}]}>
                  {t('mirrorCartItemsCount', {count})}
                </Text>

                {discountAmount > 0 ? (
                  <>
                    {renderPaymentMetaRow(t('mirrorCartSubtotal'), subtotal)}
                    {renderDiscountRow(discountAmount)}
                  </>
                ) : null}

                <View
                  style={[
                    styles.grandTotalBox,
                    {
                      backgroundColor: theme.colors.card,
                      borderWidth: 1,
                      borderColor: `${theme.colors.primary}40`,
                    },
                  ]}
                >
                  <AppInput
                    label={t('mirrorCartFullPrice')}
                    numeric
                    preserveZero
                    value={total}
                    onNumberChange={handleCartTotalChange}
                    keyboardType="numeric"
                    style={styles.grandTotalInput}
                  />
                </View>

                {collectedAmount > 0 ? (
                  <>
                    <View style={[styles.sectionDivider, {backgroundColor: `${theme.colors.primary}25`}]} />
                    {renderPaymentMetaRow(t('mirrorCartCollectedAmount'), collectedAmount)}
                    {renderPaymentMetaRow(t('mirrorCartRemainingAmount'), remainingAmount)}
                  </>
                ) : null}

                {showCartCost ? (
                  <View
                    style={[
                      styles.adminCostBox,
                      {
                        borderColor: theme.status.warning,
                        backgroundColor: `${theme.status.warning}12`,
                      },
                    ]}
                  >
                    {renderPaymentMetaRow(t('mirrorCartTotalCost'), totalCost, 'cost')}
                  </View>
                ) : null}
              </>
            ) : collectedAmount > 0 ? (
              <>
                {renderPaymentMetaRow(t('mirrorCartCollectedAmount'), collectedAmount)}
                <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary}]}>
                  {t('mirrorCartPaymentEmptyHint')}
                </Text>
              </>
            ) : (
              <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary}]}>
                {t('mirrorCartPaymentEmptyHint')}
              </Text>
            )}
          </View>
        </View>

      {items.length === 0 ? (
        <EmptyState icon="cart-outline" message={t('mirrorCartEmptyConfirmHint')} />
      ) : (
        <>
          <Text style={[styles.itemsSectionTitle, textStyle, {color: theme.typography.primary}]}>
            {t('mirrorCartItemsSection')}
          </Text>

          {items.map((item) => {
            const lineTotal = roundMoney(item.unitPrice * item.quantity);
            const unitCost = showCartCost ? getMirrorCartItemUnitCost(item) : undefined;
            const lineCost = showCartCost ? getMirrorCartItemLineCost(item) : 0;

            return (
              <View key={item.id} style={[styles.itemCard, listCard]}>
                <View style={styles.itemHeader}>
                  <View style={{flex: 1, minWidth: 0}}>
                    <Text style={[styles.itemTitle, inlineTextStyle, {color: theme.typography.primary}]}>
                      {t(item.labelKey)}
                    </Text>
                    <Text style={[styles.dimensions, ltrTextStyle, {color: theme.typography.secondary}]}>
                      {item.lengthCm} × {item.widthCm} {t('mirrorUnitCm')}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary}]}>
                        {item.thickness === '4mm' ? t('mirrorPrice4mm') : t('mirrorPrice6mm')}
                      </Text>
                      <AmountText amount={item.unitPrice} size="sm" currencyLabel={t('currencyLabel')} />
                    </View>
                    {item.note ? (
                      <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary}]}>
                        {item.note}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                    <MaterialCommunityIcons name="delete-outline" size={22} color={theme.status.error} />
                  </Pressable>
                </View>

                <View style={styles.qtyRow}>
                  <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary, flex: 1}]}>
                    {t('quantity')}
                  </Text>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => updateItemQuantity(item.id, item.quantity - 1)}
                  >
                    <MaterialCommunityIcons name="minus" size={18} color={theme.colors.icon} />
                  </Pressable>
                  <Text style={[styles.qtyValue, ltrTextStyle, {color: theme.typography.primary}]}>
                    {item.quantity}
                  </Text>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => updateItemQuantity(item.id, item.quantity + 1)}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={theme.colors.icon} />
                  </Pressable>
                </View>

                <View style={styles.lineTotalRow}>
                  <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary}]}>
                    {t('mirrorCartLineTotal')}
                  </Text>
                  <AmountText amount={lineTotal} size="sm" currencyLabel={t('currencyLabel')} />
                </View>

                {showCartCost && unitCost !== undefined ? (
                  <>
                    <View style={styles.metaRow}>
                      <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary}]}>
                        {t('mirrorCartUnitCost')}
                      </Text>
                      <AmountText amount={unitCost} size="sm" currencyLabel={t('currencyLabel')} />
                    </View>
                    <View style={[styles.lineTotalRow, styles.costRow, {borderColor: theme.colors.divider}]}>
                      <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary}]}>
                        {t('mirrorCartLineCost')}
                      </Text>
                      <AmountText amount={lineCost} size="sm" currencyLabel={t('currencyLabel')} />
                    </View>
                  </>
                ) : null}
              </View>
            );
          })}
        </>
      )}

      <View style={styles.actions}>
        <AppButton label={t('mirrorOrdersConfirmAction')} onPress={confirmOrder} />
        <AppButton label={t('mirrorCartClear')} variant="outline" onPress={confirmClear} />
        {items.length > 0 ? (
          <AppButton
            label={t('mirrorCartExportPdf')}
            onPress={handleExportPdf}
            loading={exportingPdf}
            disabled={exportingPdf}
            variant="outline"
          />
        ) : null}
      </View>
    </>
  );

  return (
    <>
      {embedded ? (
        <View style={styles.scroll}>{content}</View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      )}

      <BottomSheet
        visible={customerInfoOpen}
        title={t('mirrorCartCustomerInfo')}
        onClose={() => setCustomerInfoOpen(false)}
        formFields={['customerName', 'customerPhone', 'customerLocation', 'collectedAmount']}
      >
        <View style={styles.sheetFields}>
          <AppInput
            fieldKey="customerName"
            label={t('customerName')}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder={t('mirrorCartCustomerNamePlaceholder')}
          />
          <AppInput
            fieldKey="customerPhone"
            label={t('mirrorCartCustomerPhone')}
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder={t('mirrorCartCustomerPhonePlaceholder')}
            keyboardType="number-pad"
            maxLength={10}
          />
          <AppInput
            fieldKey="customerLocation"
            label={t('mirrorCartLocation')}
            value={customerLocation}
            onChangeText={setCustomerLocation}
            placeholder={t('mirrorCartLocationPlaceholder')}
            multiline
          />
          <AppInput
            fieldKey="collectedAmount"
            label={t('mirrorCartCollectedAmount')}
            numeric
            value={collectedAmount}
            onNumberChange={setCollectedAmount}
            keyboardType="numeric"
            placeholder="0"
          />
          <AppButton
            label={t('done')}
            onPress={() => setCustomerInfoOpen(false)}
            style={styles.sheetDone}
          />
        </View>
      </BottomSheet>
    </>
  );
};

export default MirrorPricingCartPanel;
