import React, {useMemo, useState} from 'react';

import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';

import {MaterialCommunityIcons} from '@expo/vector-icons';

import {useTranslation} from 'react-i18next';

import AppButton from '@app/components/common/AppButton';

import AmountText from '@app/components/common/AmountText';

import EmptyState from '@app/components/common/EmptyState';
import LinkableText from '@app/components/common/LinkableText';

import LoadingOverlay from '@app/components/common/LoadingOverlay';

import {useDirection} from '@app/hooks/useDirection';

import {useTheme} from '@app/context/ThemeContext';

import {isMockMode} from '@app/config/appMode';
import {deleteConfirmedOrder} from '@app/services/confirmedOrders.service';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';

import {getMirrorPricingCartCount} from '@app/stores/mirrorPricingCartStore';

import {formatCurrency, formatDateTime} from '@app/utils/format';

import {exportMirrorConfirmedOrderReport} from '@app/utils/exportMirrorCartReport';

import {getListCardStyle} from '@shared/theme/themeHelpers';

import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';

import {
  getConfirmedOrderLineTotal,
  resolveConfirmedOrderDiscount,
  resolveConfirmedOrderRemaining,
  resolveConfirmedOrderSubtotal,
} from '@app/types/mirrorPricingConfirmedOrder';



interface Props {

  showTitle?: boolean;

}



const MirrorPricingConfirmedOrdersPanel: React.FC<Props> = ({showTitle = true}) => {

  const {t} = useTranslation();

  const {theme} = useTheme();

  const {textStyle, inlineTextStyle, row, ltrTextStyle, chevronForward, isRTL} = useDirection();

  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const orders = useMirrorPricingConfirmedOrdersStore((state) => state.orders);

  const removeOrder = useMirrorPricingConfirmedOrdersStore((state) => state.removeOrder);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [exportingOrderId, setExportingOrderId] = useState<string | null>(null);



  const styles = useMemo(

    () =>

      StyleSheet.create({

        root: {gap: theme.spacing.sm},

        sectionTitle: {

          fontSize: theme.typographyScale.size.md,

          fontWeight: '700',

          marginBottom: theme.spacing.xs,

        },

        orderCard: {padding: theme.spacing.md, gap: theme.spacing.xs},

        orderHeader: {

          flexDirection: row,

          alignItems: 'center',

          gap: theme.spacing.sm,

        },

        orderIconWrap: {

          width: 40,

          height: 40,

          borderRadius: 20,

          alignItems: 'center',

          justifyContent: 'center',

          backgroundColor: `${theme.status.success}18`,

        },

        orderContent: {flex: 1, minWidth: 0, gap: 2},

        orderTitle: {fontSize: theme.typographyScale.size.sm, fontWeight: '700'},

        orderMeta: {fontSize: theme.typographyScale.size.xs, lineHeight: 18},

        orderTotalRow: {

          flexDirection: row,

          alignItems: 'center',

          justifyContent: 'space-between',

          gap: theme.spacing.sm,

          marginTop: theme.spacing.xs,

        },

        itemsBlock: {

          marginTop: theme.spacing.sm,

          paddingTop: theme.spacing.sm,

          borderTopWidth: StyleSheet.hairlineWidth,

          gap: theme.spacing.sm,

        },

        itemCard: {

          gap: 4,

          paddingVertical: theme.spacing.xs,

        },

        itemTitle: {fontSize: theme.typographyScale.size.xs, fontWeight: '600', lineHeight: 18},

        itemMeta: {fontSize: theme.typographyScale.size.xs, lineHeight: 16},

        itemPriceRow: {

          flexDirection: row,

          alignItems: 'center',

          justifyContent: 'space-between',

          gap: theme.spacing.sm,

        },

        orderActions: {

          gap: theme.spacing.sm,

          marginTop: theme.spacing.sm,

        },

      }),

    [row, theme],

  );



  const confirmRemove = (order: MirrorPricingConfirmedOrder) => {

    Alert.alert(t('mirrorOrdersRemoveTitle'), t('mirrorOrdersRemoveConfirm'), [

      {text: t('cancel'), style: 'cancel'},

      {

        text: t('confirm'),

        style: 'destructive',

        onPress: () => {
          void (async () => {
            try {
              if (isMockMode) {
                removeOrder(order.id);
              } else {
                await deleteConfirmedOrder(order.id);
              }
            } catch {
              Alert.alert(t('error'), t('saveFailed'));
              return;
            }

            if (expandedId === order.id) {
              setExpandedId(null);
            }
          })();
        },

      },

    ]);

  };



  const handleExportOrder = async (order: MirrorPricingConfirmedOrder) => {

    setExportingOrderId(order.id);

    try {

      await exportMirrorConfirmedOrderReport(order, t, {

        isRtl: isRTL,

        appName: t('appName'),

      });

    } catch (error) {

      console.error('[MirrorPricingConfirmedOrdersPanel] export failed', error);

      Alert.alert(t('error'), t('mirrorCartExportFailed'));

    } finally {

      setExportingOrderId(null);

    }

  };



  const renderCustomerLabel = (order: MirrorPricingConfirmedOrder) => {

    const name = order.customerName.trim();

    if (name) {

      return name;

    }

    return t('mirrorOrdersNoCustomerName');

  };



  if (orders.length === 0) {

    return (

      <View style={styles.root}>

        {showTitle ? (

          <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>

            {t('mirrorOrdersConfirmed')}

          </Text>

        ) : null}

        <EmptyState icon="clipboard-check-outline" message={t('mirrorOrdersEmpty')} />

      </View>

    );

  }



  return (

    <View style={styles.root}>

      {showTitle ? (

        <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>

          {t('mirrorOrdersConfirmed')} ({orders.length})

        </Text>

      ) : null}



      {orders.map((order) => {

        const expanded = expandedId === order.id;

        const itemCount = getMirrorPricingCartCount(order.items);

        const remainingAmount = resolveConfirmedOrderRemaining(order);

        const orderSubtotal = resolveConfirmedOrderSubtotal(order);

        const orderDiscount = resolveConfirmedOrderDiscount(order);



        return (

          <Pressable

            key={order.id}

            style={[styles.orderCard, listCard]}

            onPress={() => setExpandedId(expanded ? null : order.id)}

            accessibilityRole="button"

          >

            <View style={styles.orderHeader}>

              <View style={styles.orderIconWrap}>

                <MaterialCommunityIcons name="clipboard-check" size={22} color={theme.status.success} />

              </View>

              <View style={styles.orderContent}>

                <Text style={[styles.orderTitle, inlineTextStyle, {color: theme.typography.primary}]}>

                  {renderCustomerLabel(order)}

                </Text>

                <Text style={[styles.orderMeta, ltrTextStyle, {color: theme.typography.secondary}]}>

                  {formatDateTime(order.confirmedAt)}

                </Text>

                {order.customerPhone.trim() ? (

                  <Text style={[styles.orderMeta, ltrTextStyle, {color: theme.typography.secondary}]}>

                    {order.customerPhone.trim()}

                  </Text>

                ) : null}

              </View>

              <MaterialCommunityIcons

                name={expanded ? 'chevron-up' : chevronForward}

                size={22}

                color={theme.colors.icon}

              />

            </View>



            <View style={styles.orderTotalRow}>

              <Text style={[styles.orderMeta, inlineTextStyle, {color: theme.typography.secondary}]}>

                {t('mirrorCartItemsCount', {count: itemCount})}

              </Text>

              <AmountText amount={order.total} size="sm" currencyLabel={t('currencyLabel')} />

            </View>



            {expanded ? (

              <View style={[styles.itemsBlock, {borderColor: theme.colors.divider}]}>

                {order.customerLocation.trim() ? (
                  <LinkableText
                    text={order.customerLocation.trim()}
                    style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}
                  />
                ) : null}



                {orderDiscount > 0 ? (

                  <>

                    <View style={styles.orderTotalRow}>

                      <Text style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}>

                        {t('mirrorCartSubtotal')}

                      </Text>

                      <AmountText amount={orderSubtotal} size="sm" currencyLabel={t('currencyLabel')} />

                    </View>

                    <View style={styles.orderTotalRow}>

                      <Text style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}>

                        {t('mirrorCartDiscount')}

                      </Text>

                      <Text style={[ltrTextStyle, {color: theme.status.success, fontWeight: '700', fontSize: theme.typographyScale.size.xs}]}>

                        − {formatCurrency(orderDiscount, t('currencyLabel'))}

                      </Text>

                    </View>

                  </>

                ) : null}



                <View style={styles.orderTotalRow}>

                  <Text style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}>

                    {t('mirrorCartFullPrice')}

                  </Text>

                  <AmountText amount={order.total} size="sm" currencyLabel={t('currencyLabel')} />

                </View>



                {order.collectedAmount > 0 ? (

                  <>

                    <View style={styles.orderTotalRow}>

                      <Text style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}>

                        {t('mirrorCartCollectedAmount')}

                      </Text>

                      <AmountText amount={order.collectedAmount} size="sm" currencyLabel={t('currencyLabel')} />

                    </View>

                    <View style={styles.orderTotalRow}>

                      <Text style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}>

                        {t('mirrorCartRemainingAmount')}

                      </Text>

                      <AmountText amount={remainingAmount} size="sm" currencyLabel={t('currencyLabel')} />

                    </View>

                  </>

                ) : null}



                {order.items.map((item) => {

                  const lineTotal = getConfirmedOrderLineTotal(item);



                  return (

                    <View key={item.id} style={styles.itemCard}>

                      <Text style={[styles.itemTitle, inlineTextStyle, {color: theme.typography.primary}]}>

                        {t(item.labelKey)} × {item.quantity}

                      </Text>

                      <Text style={[styles.itemMeta, ltrTextStyle, {color: theme.typography.secondary}]}>

                        {item.lengthCm} × {item.widthCm} {t('mirrorUnitCm')} ·{' '}

                        {item.thickness === '4mm' ? t('mirrorPrice4mm') : t('mirrorPrice6mm')}

                      </Text>

                      <View style={styles.itemPriceRow}>

                        <Text style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}>

                          {t('mirrorCartPdfColUnitPrice')}

                        </Text>

                        <AmountText amount={item.unitPrice} size="sm" currencyLabel={t('currencyLabel')} />

                      </View>

                      <View style={styles.itemPriceRow}>

                        <Text style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}>

                          {t('mirrorCartLineTotal')}

                        </Text>

                        <AmountText amount={lineTotal} size="sm" currencyLabel={t('currencyLabel')} />

                      </View>

                      {item.note ? (
                        <LinkableText
                          text={item.note}
                          style={[styles.itemMeta, inlineTextStyle, {color: theme.typography.secondary}]}
                        />
                      ) : null}

                    </View>

                  );

                })}



                <View style={styles.orderActions}>

                  <AppButton

                    label={t('mirrorOrderExportInvoice')}

                    variant="outline"

                    onPress={() => {

                      void handleExportOrder(order);

                    }}

                    loading={exportingOrderId === order.id}

                    disabled={exportingOrderId !== null}

                  />

                  <Pressable onPress={() => confirmRemove(order)} hitSlop={8}>

                    <Text style={[styles.itemMeta, textStyle, {color: theme.status.error}]}>

                      {t('mirrorOrdersRemove')}

                    </Text>

                  </Pressable>

                </View>

              </View>

            ) : null}

          </Pressable>

        );

      })}



      <LoadingOverlay visible={exportingOrderId !== null} />

    </View>

  );

};



export default MirrorPricingConfirmedOrdersPanel;

