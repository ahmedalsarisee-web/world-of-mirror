import React, {useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import AmountText from '@app/components/common/AmountText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {useMirrorPricingCartStore} from '@app/stores/mirrorPricingCartStore';
import {
  getCustomAdditionLineTotal,
  getCustomAdditionQuantity,
} from '@app/types/mirrorPricingCart';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  embedded?: boolean;
  onAdded?: () => void;
}

const MirrorPricingCustomAdditionsSection: React.FC<Props> = ({embedded = false, onAdded}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, ltrTextStyle, layoutStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState(0);
  const [priceKey, setPriceKey] = useState(0);

  const customAdditions = useMirrorPricingCartStore((state) => state.customAdditions);
  const addCustomAddition = useMirrorPricingCartStore((state) => state.addCustomAddition);
  const removeCustomAddition = useMirrorPricingCartStore((state) => state.removeCustomAddition);
  const updateCustomAdditionQuantity = useMirrorPricingCartStore(
    (state) => state.updateCustomAdditionQuantity,
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          padding: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        header: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.xs,
        },
        title: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        hint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
        },
        fieldsRow: {
          flexDirection: row,
          gap: theme.spacing.sm,
        },
        fieldGrow: {flex: 1},
        fieldPrice: {width: 120},
        entryCard: {
          padding: theme.spacing.sm,
          gap: theme.spacing.xs,
          borderWidth: 1,
          borderColor:
            theme.colors.background === '#F8FAFC' ? 'rgba(26, 51, 82, 0.2)' : 'rgba(91, 127, 166, 0.4)',
        },
        entryHeader: {
          flexDirection: row,
          alignItems: 'flex-start',
          gap: theme.spacing.xs,
        },
        entryTitle: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
        metaRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.xs,
        },
        meta: {
          fontSize: theme.typographyScale.size.xs,
        },
        qtyRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.xs,
        },
        qtyButton: {
          width: 32,
          height: 32,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          alignItems: 'center',
          justifyContent: 'center',
        },
        qtyValue: {
          minWidth: 28,
          textAlign: 'center',
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        list: {gap: theme.spacing.xs},
      }),
    [row, theme],
  );

  const handleAdd = () => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      Alert.alert(t('error'), t('mirrorCartCustomAdditionLabelRequired'));
      return;
    }
    if (price <= 0) {
      Alert.alert(t('error'), t('mirrorCartCustomAdditionPriceRequired'));
      return;
    }

    addCustomAddition(trimmedLabel, price);
    setLabel('');
    setPrice(0);
    setPriceKey((value) => value + 1);
    onAdded?.();
    Alert.alert(t('mirrorCartAddedTitle'), t('mirrorCartCustomAdditionAddedMessage'));
  };

  const content = (
    <>
      {!embedded ? (
        <>
          <View style={styles.header}>
            <MaterialCommunityIcons name="playlist-plus" size={20} color={theme.colors.primary} />
            <Text style={[styles.title, textStyle, {color: theme.typography.primary}]}>
              {t('mirrorCartCustomAdditions')}
            </Text>
          </View>

          <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
            {t('mirrorCartCustomAdditionsPageHint')}
          </Text>
        </>
      ) : null}

      <View style={[styles.fieldsRow, layoutStyle]}>
        <View style={styles.fieldGrow}>
          <AppInput
            fieldKey="customAdditionLabel"
            label={t('mirrorCartCustomAdditionLabel')}
            value={label}
            onChangeText={setLabel}
            placeholder={t('mirrorCartCustomAdditionLabelPlaceholder')}
          />
        </View>
        <View style={styles.fieldPrice}>
          <AppInput
            key={`customAdditionPrice-${priceKey}`}
            fieldKey="customAdditionPrice"
            label={t('mirrorCartCustomAdditionPrice')}
            numeric
            value={price}
            onNumberChange={setPrice}
            keyboardType="numeric"
          />
        </View>
      </View>

      <AppButton label={t('mirrorCartCustomAdditionAdd')} variant="outline" onPress={handleAdd} />

      {customAdditions.length > 0 ? (
        <View style={styles.list}>
          {customAdditions.map((entry) => {
            const quantity = getCustomAdditionQuantity(entry);
            const lineTotal = getCustomAdditionLineTotal(entry);

            return (
              <View key={entry.id} style={[listCard, styles.entryCard]}>
                <View style={styles.entryHeader}>
                  <View style={{flex: 1, minWidth: 0}}>
                    <Text style={[styles.entryTitle, inlineTextStyle, {color: theme.typography.primary}]}>
                      {entry.label}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary}]}>
                        {t('mirrorCartCustomAdditionKind')}
                      </Text>
                      <AmountText amount={entry.price} size="sm" currencyLabel={t('currencyLabel')} />
                    </View>
                  </View>
                  <Pressable onPress={() => removeCustomAddition(entry.id)} hitSlop={8}>
                    <MaterialCommunityIcons name="delete-outline" size={22} color={theme.status.error} />
                  </Pressable>
                </View>

                <View style={styles.qtyRow}>
                  <Text style={[styles.meta, inlineTextStyle, {color: theme.typography.secondary, flex: 1}]}>
                    {t('quantity')}
                  </Text>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => updateCustomAdditionQuantity(entry.id, quantity - 1)}
                  >
                    <MaterialCommunityIcons name="minus" size={18} color={theme.colors.icon} />
                  </Pressable>
                  <Text style={[styles.qtyValue, ltrTextStyle, {color: theme.typography.primary}]}>
                    {quantity}
                  </Text>
                  <Pressable
                    style={styles.qtyButton}
                    onPress={() => updateCustomAdditionQuantity(entry.id, quantity + 1)}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={theme.colors.icon} />
                  </Pressable>
                  <AmountText amount={lineTotal} size="sm" currencyLabel={t('currencyLabel')} />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </>
  );

  if (embedded) {
    return <View style={[styles.card, layoutStyle]}>{content}</View>;
  }

  return (
    <View style={[listCard, styles.card, layoutStyle]}>
      {content}
    </View>
  );
};

export default MirrorPricingCustomAdditionsSection;
