import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AmountText from '@app/components/common/AmountText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {OrdersSearchResult} from '@app/utils/mirrorOrdersSearch';
import {formatOrdersSearchMatchSummary} from '@app/utils/mirrorOrdersSearch';
import {resolveOrderSearchSectionTitle} from '@app/utils/ordersHomeCardNavigation';
import type {OrdersHomeCardConfig} from '@app/types/ordersHomeCard';
import {
  getMirrorPricingOrderStatusIcon,
  resolveMirrorPricingOrderStatus,
} from '@app/types/mirrorPricingOrderStatus';
import type {AppUser} from '@app/types/models';
import {resolveOrderConfirmedByShortNote} from '@app/utils/confirmedOrderConfirmedBy';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';
import CustomerPhoneLink from '@app/components/common/CustomerPhoneLink';
import ConfirmedOrderInfoRow from '@app/components/pricing/ConfirmedOrderInfoRow';
import OrderLocationFulfillmentRow from '@app/components/pricing/OrderLocationFulfillmentRow';
import {formatDateTime} from '@app/utils/format';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  result: OrdersSearchResult;
  homeCards: OrdersHomeCardConfig[];
  usersById: Map<string, AppUser>;
  onPress: () => void;
}

const OrdersSearchResultCard: React.FC<Props> = ({result, homeCards, usersById, onPress}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, ltrTextStyle, chevronForward} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const {order, matchedFields} = result;
  const sectionTitle = resolveOrderSearchSectionTitle(order, homeCards, t);
  const sectionIcon = order.homeCardId
    ? ('folder-outline' as const)
    : getMirrorPricingOrderStatusIcon(resolveMirrorPricingOrderStatus(order.status));
  const invoiceLabel = formatMirrorOrderInvoiceLabel(order.invoiceNumber);
  const customerLabel = order.customerName.trim() || t('mirrorOrdersNoCustomerName');
  const matchSummary = formatOrdersSearchMatchSummary(matchedFields, t);
  const confirmedByLabel = resolveOrderConfirmedByShortNote(order, usersById, t);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
        },
        iconWrap: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${theme.colors.primary}14`,
        },
        body: {flex: 1, minWidth: 0, gap: theme.spacing.xs},
        topRow: {flexDirection: row, alignItems: 'center', gap: 8, flexWrap: 'wrap'},
        invoice: {fontSize: theme.typographyScale.size.sm, fontWeight: '800'},
        statusChip: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: `${theme.colors.primary}12`,
        },
        statusText: {fontSize: 10, fontWeight: '700'},
        title: {fontSize: theme.typographyScale.size.sm, fontWeight: '700', lineHeight: 20},
        meta: {fontSize: theme.typographyScale.size.xs, lineHeight: 17},
        match: {fontSize: theme.typographyScale.size.xs, lineHeight: 16},
        divider: {borderTopWidth: StyleSheet.hairlineWidth},
        summary: {gap: theme.spacing.xs},
        amountRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        },
      }),
    [row, theme],
  );

  return (
    <Pressable
      style={({pressed}) => [styles.card, listCard, {opacity: pressed ? 0.78 : 1}]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons
          name={sectionIcon}
          size={22}
          color={theme.colors.primary}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          {invoiceLabel ? (
            <Text style={[styles.invoice, ltrTextStyle, {color: theme.colors.primary}]}>
              {invoiceLabel}
            </Text>
          ) : null}
          <View style={styles.statusChip}>
            <Text style={[styles.statusText, inlineTextStyle, {color: theme.colors.primary}]}>
              {sectionTitle}
            </Text>
          </View>
        </View>

        <ConfirmedOrderInfoRow icon="account-outline">
          <Text style={[styles.title, inlineTextStyle, {color: theme.typography.primary}]} numberOfLines={1}>
            {customerLabel}
          </Text>
        </ConfirmedOrderInfoRow>

        {order.customerPhone.trim() ? (
          <ConfirmedOrderInfoRow icon="phone-outline">
            <CustomerPhoneLink phone={order.customerPhone} style={[styles.meta, ltrTextStyle]} />
          </ConfirmedOrderInfoRow>
        ) : null}

        <OrderLocationFulfillmentRow
          location={order.customerLocation}
          fulfillmentType={order.fulfillmentType}
          numberOfLines={2}
          textStyle={styles.meta}
        />

        <View style={[styles.divider, {borderColor: theme.colors.divider}]} />

        <View style={styles.summary}>
          <ConfirmedOrderInfoRow icon="calendar-clock-outline">
            <Text style={[styles.meta, ltrTextStyle, {color: theme.typography.secondary}]} numberOfLines={1}>
              {formatDateTime(order.confirmedAt)}
            </Text>
          </ConfirmedOrderInfoRow>

          {confirmedByLabel ? (
            <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary}]} numberOfLines={1}>
              {confirmedByLabel}
            </Text>
          ) : null}

          {matchSummary ? (
            <Text style={[styles.match, inlineTextStyle, {color: theme.status.success}]} numberOfLines={2}>
              {t('ordersSearchMatchedIn', {fields: matchSummary})}
            </Text>
          ) : null}

          <View style={styles.amountRow}>
            <AmountText amount={order.total} size="sm" currencyLabel={t('currencyLabel')} />
          </View>
        </View>
      </View>

      <MaterialCommunityIcons name={chevronForward} size={22} color={theme.colors.icon} />
    </Pressable>
  );
};

export default OrdersSearchResultCard;
