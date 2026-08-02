import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AmountText from '@app/components/common/AmountText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {MirrorPricingCartItem, MirrorPricingCustomAddition} from '@app/types/mirrorPricingCart';
import {
  getCustomAdditionLineTotal,
  getCustomAdditionQuantity,
  getMirrorPricingCartCount,
} from '@app/types/mirrorPricingCart';
import {getListCardStyle} from '@shared/theme/themeHelpers';
import {formatCurrency, roundMoney} from '@app/utils/format';

interface Props {
  items: MirrorPricingCartItem[];
  customAdditions: MirrorPricingCustomAddition[];
  discountAmount: number;
  subtotal: number;
  disabled?: boolean;
  onUpdateItemQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onUpdateCustomAdditionQuantity: (id: string, quantity: number) => void;
}

const EditConfirmedOrderCartItemsSection: React.FC<Props> = ({
  items,
  customAdditions,
  discountAmount,
  subtotal,
  disabled = false,
  onUpdateItemQuantity,
  onRemoveItem,
  onUpdateCustomAdditionQuantity,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, ltrTextStyle, appFont} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const itemCount = useMemo(() => getMirrorPricingCartCount(items), [items]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        block: {gap: theme.spacing.xs, marginTop: theme.spacing.xs},
        sectionTitle: {fontSize: theme.typographyScale.size.sm, fontWeight: '700'},
        itemCard: {padding: theme.spacing.md, gap: theme.spacing.sm},
        itemHeader: {flexDirection: row, alignItems: 'flex-start', gap: theme.spacing.sm},
        itemTitle: {fontSize: theme.typographyScale.size.sm, fontWeight: '700'},
        meta: {fontSize: theme.typographyScale.size.xs, lineHeight: 18},
        metaRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        },
        qtyRow: {flexDirection: row, alignItems: 'center', gap: theme.spacing.sm},
        qtyButton: {
          width: 32,
          height: 32,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          alignItems: 'center',
          justifyContent: 'center',
        },
        qtyValue: {minWidth: 28, textAlign: 'center', fontWeight: '700'},
        paymentMetaRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        },
        paymentMetaLabel: {fontSize: theme.typographyScale.size.xs, flex: 1},
      }),
    [row, theme],
  );

  if (items.length === 0 && customAdditions.length === 0) {
    return null;
  }

  return (
    <View style={styles.block}>
      {customAdditions.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
            {t('mirrorCartCustomAdditions')}
          </Text>
          {customAdditions.map((entry) => {
            const quantity = getCustomAdditionQuantity(entry);
            const lineTotal = getCustomAdditionLineTotal(entry);

            return (
              <View key={entry.id} style={[styles.itemCard, listCard]}>
                <Text style={[styles.itemTitle, inlineTextStyle, {color: theme.typography.primary}]}>
                  {entry.label}
                </Text>
                <View style={styles.qtyRow}>
                  <Text
                    style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary, flex: 1}]}
                  >
                    {t('quantity')}
                  </Text>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => onUpdateCustomAdditionQuantity(entry.id, quantity - 1)}
                    disabled={disabled}
                  >
                    <MaterialCommunityIcons name="minus" size={18} color={theme.colors.icon} />
                  </Pressable>
                  <Text style={[styles.qtyValue, ltrTextStyle, {color: theme.typography.primary}]}>
                    {quantity}
                  </Text>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => onUpdateCustomAdditionQuantity(entry.id, quantity + 1)}
                    disabled={disabled}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={theme.colors.icon} />
                  </Pressable>
                </View>
                <View style={styles.paymentMetaRow}>
                  <Text
                    style={[styles.paymentMetaLabel, inlineTextStyle, {color: theme.typography.secondary}]}
                  >
                    {t('mirrorCartLineTotal')}
                  </Text>
                  <AmountText amount={lineTotal} size="sm" currencyLabel={t('currencyLabel')} />
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      {items.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
            {t('mirrorCartItemsSection')} ({t('mirrorCartItemsCount', {count: itemCount})})
          </Text>

          {items.map((item) => {
            const lineTotal = roundMoney(item.unitPrice * item.quantity);
            return (
              <View key={item.id} style={[styles.itemCard, listCard]}>
                <View style={styles.itemHeader}>
                  <View style={{flex: 1, minWidth: 0}}>
                    <Text style={[styles.itemTitle, inlineTextStyle, {color: theme.typography.primary}]}>
                      {t(item.labelKey)}
                    </Text>
                    <Text style={[styles.meta, ltrTextStyle, {color: theme.typography.secondary}]}>
                      {item.lengthCm} × {item.widthCm} {t('mirrorUnitCm')}
                    </Text>
                    {item.note ? (
                      <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary}]}>
                        {item.note}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable onPress={() => onRemoveItem(item.id)} hitSlop={8} disabled={disabled}>
                    <MaterialCommunityIcons name="delete-outline" size={22} color={theme.status.error} />
                  </Pressable>
                </View>

                <View style={styles.qtyRow}>
                  <Text
                    style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary, flex: 1}]}
                  >
                    {t('quantity')}
                  </Text>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => onUpdateItemQuantity(item.id, item.quantity - 1)}
                    disabled={disabled}
                  >
                    <MaterialCommunityIcons name="minus" size={18} color={theme.colors.icon} />
                  </Pressable>
                  <Text style={[styles.qtyValue, ltrTextStyle, {color: theme.typography.primary}]}>
                    {item.quantity}
                  </Text>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => onUpdateItemQuantity(item.id, item.quantity + 1)}
                    disabled={disabled}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={theme.colors.icon} />
                  </Pressable>
                </View>

                <View style={styles.metaRow}>
                  <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary}]}>
                    {t('mirrorCartLineTotal')}
                  </Text>
                  <AmountText amount={lineTotal} size="sm" currencyLabel={t('currencyLabel')} />
                </View>
              </View>
            );
          })}

          <View style={styles.paymentMetaRow}>
            <Text style={[styles.paymentMetaLabel, inlineTextStyle, {color: theme.typography.secondary}]}>
              {t('mirrorCartSubtotal')}
            </Text>
            <AmountText amount={subtotal} size="sm" currencyLabel={t('currencyLabel')} />
          </View>

          {discountAmount > 0 ? (
            <View style={styles.paymentMetaRow}>
              <Text style={[styles.paymentMetaLabel, inlineTextStyle, {color: theme.typography.secondary}]}>
                {t('mirrorCartDiscount')}
              </Text>
              <Text
                style={[
                  ltrTextStyle,
                  appFont('bold'),
                  {color: theme.status.success, fontSize: theme.typographyScale.size.sm},
                ]}
              >
                − {formatCurrency(discountAmount, t('currencyLabel'))}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

export default EditConfirmedOrderCartItemsSection;
