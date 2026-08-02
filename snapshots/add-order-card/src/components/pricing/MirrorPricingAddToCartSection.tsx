import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import AmountText from '@app/components/common/AmountText';
import BottomSheet from '@app/components/common/BottomSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {useMirrorPricingCartStore} from '@app/stores/mirrorPricingCartStore';
import type {MirrorPricingItemCategory, MirrorPricingThickness} from '@app/types/mirrorPricingCart';
import {formatCurrency} from '@app/utils/format';
import {
  computeMirrorPricing,
  getAvailableThicknesses,
  isGlassOption,
  resolveMirrorOptionPrice,
  type MirrorExtraPrice,
  type MirrorOrderOption,
} from '@app/utils/mirrorPricing';

interface SelectedOption {
  category: MirrorPricingItemCategory;
  option: MirrorOrderOption | MirrorExtraPrice;
}

interface Props {
  lengthCm: number;
  widthCm: number;
  thickness: MirrorPricingThickness;
  onAdded?: () => void;
}

const MirrorPricingAddToCartSection: React.FC<Props> = ({lengthCm, widthCm, thickness, onAdded}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, ltrTextStyle} = useDirection();
  const addItem = useMirrorPricingCartStore((state) => state.addItem);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedOption | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [itemNote, setItemNote] = useState('');

  const pricing = useMemo(() => {
    if (lengthCm <= 0 || widthCm <= 0) {
      return null;
    }
    return computeMirrorPricing({lengthCm, widthCm});
  }, [lengthCm, widthCm]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    if (!getAvailableThicknesses(selected.option).includes(thickness)) {
      setSelected(null);
    }
  }, [selected, thickness]);

  const unitPrice = useMemo(() => {
    if (!selected) {
      return undefined;
    }
    return resolveMirrorOptionPrice(selected.option, thickness);
  }, [selected, thickness]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {gap: theme.spacing.sm},
        pickerButton: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: theme.spacing.xs + 2,
          paddingHorizontal: theme.spacing.sm,
          borderWidth: 1,
          borderRadius: theme.components.input.radius,
          gap: theme.spacing.xs,
        },
        pickerText: {flex: 1, fontSize: theme.typographyScale.size.sm, fontWeight: '600'},
        fieldsRow: {flexDirection: row, gap: theme.spacing.sm},
        fieldHalf: {flex: 1},
        summaryBar: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.components.input.radius,
        },
        summaryLabel: {fontSize: theme.typographyScale.size.xs, fontWeight: '600'},
        groupTitle: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          marginTop: theme.spacing.sm,
          marginBottom: 2,
        },
        optionRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.xs + 2,
          paddingHorizontal: theme.spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        optionText: {flex: 1, fontSize: theme.typographyScale.size.sm, lineHeight: 18},
        optionPrice: {fontSize: theme.typographyScale.size.xs, fontWeight: '600'},
      }),
    [row, theme],
  );

  const handleAdd = () => {
    if (!selected) {
      Alert.alert(t('error'), t('mirrorCartSelectOption'));
      return;
    }

    if (!getAvailableThicknesses(selected.option).includes(thickness)) {
      Alert.alert(t('error'), t('mirrorCartThicknessUnavailable'));
      return;
    }

    if (unitPrice === undefined) {
      Alert.alert(t('error'), t('mirrorCartSelectOption'));
      return;
    }

    addItem({
      lengthCm,
      widthCm,
      category: selected.category,
      optionId: selected.option.id,
      labelKey: selected.option.labelKey,
      thickness,
      unitPrice,
      quantity: Math.max(1, Math.round(quantity)),
      note: itemNote.trim() || undefined,
    });

    setSelected(null);
    setItemNote('');
    setQuantity(1);
    onAdded?.();
    Alert.alert(t('mirrorCartAddedTitle'), t('mirrorCartAddedMessage'));
  };

  const selectOption = (category: MirrorPricingItemCategory, option: MirrorOrderOption | MirrorExtraPrice) => {
    setSelected({category, option});
    setPickerOpen(false);
  };

  if (!pricing) {
    return null;
  }

  const isOptionAvailable = (option: MirrorOrderOption | MirrorExtraPrice) => {
    if (isGlassOption(option.id) && thickness !== '6mm') {
      return false;
    }
    return resolveMirrorOptionPrice(option, thickness) !== undefined;
  };

  const renderOptionRow = (
    category: MirrorPricingItemCategory,
    option: MirrorOrderOption | MirrorExtraPrice,
  ) => {
    const price = resolveMirrorOptionPrice(option, thickness);
    if (price === undefined) {
      return null;
    }

    return (
      <Pressable
        key={`${category}-${option.id}`}
        style={[styles.optionRow, {borderColor: theme.colors.divider}]}
        onPress={() => selectOption(category, option)}
      >
        <Text style={[styles.optionText, textStyle, {color: theme.typography.primary}]} numberOfLines={2}>
          {t(option.labelKey)}
        </Text>
        <Text style={[styles.optionPrice, ltrTextStyle, {color: theme.colors.primary}]}>
          {formatCurrency(price, t('currencyLabel'))}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      <View style={styles.root}>
        <Pressable
          style={[
            styles.pickerButton,
            {borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground},
          ]}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('mirrorCartChooseOption')}
        >
          <MaterialCommunityIcons name="format-list-bulleted" size={18} color={theme.colors.icon} />
          <Text
            style={[
              styles.pickerText,
              textStyle,
              {color: selected ? theme.typography.primary : theme.typography.secondary},
            ]}
            numberOfLines={1}
          >
            {selected ? t(selected.option.labelKey) : t('mirrorCartChooseOption')}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={theme.colors.icon} />
        </Pressable>

        {selected ? (
          <>
            <View style={styles.fieldsRow}>
              <View style={styles.fieldHalf}>
                <AppInput
                  fieldKey="cartQuantity"
                  label={t('quantity')}
                  numeric
                  preserveZero
                  value={quantity}
                  onNumberChange={(value) => setQuantity(Math.max(1, Math.round(value)))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.fieldHalf}>
                <AppInput
                  fieldKey="cartItemNote"
                  label={t('mirrorCartItemNote')}
                  value={itemNote}
                  onChangeText={setItemNote}
                  placeholder={t('mirrorCartItemNotePlaceholder')}
                />
              </View>
            </View>

            <View
              style={[
                styles.summaryBar,
                {backgroundColor: `${theme.colors.primary}10`, borderColor: `${theme.colors.primary}25`, borderWidth: 1},
              ]}
            >
              <Text style={[styles.summaryLabel, inlineTextStyle, {color: theme.typography.secondary}]}>
                {t('mirrorCartLineTotal')}
              </Text>
              {unitPrice !== undefined ? (
                <AmountText
                  amount={unitPrice * Math.max(1, Math.round(quantity))}
                  size="sm"
                  currencyLabel={t('currencyLabel')}
                />
              ) : (
                <Text style={[inlineTextStyle, {color: theme.typography.secondary}]}>—</Text>
              )}
            </View>

            <AppButton label={t('mirrorCartAddToCart')} onPress={handleAdd} />
          </>
        ) : null}
      </View>

      <BottomSheet
        visible={pickerOpen}
        title={t('mirrorCartChooseOption')}
        onClose={() => setPickerOpen(false)}
        sheetStyle={{maxHeight: '85%'}}
        showsScrollIndicator
      >
        <Text style={[styles.groupTitle, textStyle, {color: theme.typography.primary, marginTop: 0}]}>
          {t('mirrorPricingOrderOptions')}
        </Text>
        {pricing.orderOptions.filter(isOptionAvailable).map((option) => renderOptionRow('order', option))}
      </BottomSheet>
    </>
  );
};

export default MirrorPricingAddToCartSection;
