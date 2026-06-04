import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
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
  resolveMirrorOptionPrice,
  type MirrorExtraPrice,
  type MirrorOrderOption,
} from '@app/utils/mirrorPricing';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface SelectedOption {
  category: MirrorPricingItemCategory;
  option: MirrorOrderOption | MirrorExtraPrice;
}

interface Props {
  lengthCm: number;
  widthCm: number;
  onAdded?: () => void;
}

const MirrorPricingAddToCartSection: React.FC<Props> = ({lengthCm, widthCm, onAdded}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, ltrTextStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const addItem = useMirrorPricingCartStore((state) => state.addItem);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedOption | null>(null);
  const [thickness, setThickness] = useState<MirrorPricingThickness>('4mm');
  const [quantity, setQuantity] = useState(1);
  const [itemNote, setItemNote] = useState('');

  const pricing = useMemo(() => {
    if (lengthCm <= 0 || widthCm <= 0) {
      return null;
    }
    return computeMirrorPricing({lengthCm, widthCm});
  }, [lengthCm, widthCm]);

  const availableThicknesses = useMemo(() => {
    if (!selected) {
      return [] as MirrorPricingThickness[];
    }
    return getAvailableThicknesses(selected.option);
  }, [selected]);

  useEffect(() => {
    if (availableThicknesses.length === 0) {
      return;
    }
    if (!availableThicknesses.includes(thickness)) {
      setThickness(availableThicknesses[0]);
    }
  }, [availableThicknesses, thickness]);

  const unitPrice = useMemo(() => {
    if (!selected) {
      return undefined;
    }
    return resolveMirrorOptionPrice(selected.option, thickness);
  }, [selected, thickness]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        iconWrap: {
          alignItems: 'flex-end',
          marginTop: theme.spacing.sm,
        },
        iconButton: {
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sheetContent: {gap: theme.spacing.sm, paddingBottom: theme.spacing.md},
        dimensionsHint: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
          marginBottom: theme.spacing.xs,
        },
        pickerButton: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderWidth: 1,
          borderRadius: theme.components.input.radius,
          gap: theme.spacing.sm,
        },
        pickerText: {flex: 1, fontSize: theme.typographyScale.size.sm},
        thicknessRow: {flexDirection: row, gap: theme.spacing.sm, marginTop: theme.spacing.xs},
        chip: {
          flex: 1,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.components.button.radius,
          borderWidth: 1,
          alignItems: 'center',
        },
        chipText: {fontSize: theme.typographyScale.size.sm, fontWeight: '600'},
        summaryRow: {
          flexDirection: row,
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.xs,
        },
        summaryLabel: {flex: 1, minWidth: 0, fontSize: theme.typographyScale.size.sm},
        summaryValueWrap: {flexShrink: 0},
        groupTitle: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
          marginTop: theme.spacing.md,
          marginBottom: theme.spacing.xs,
        },
        optionRow: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        optionText: {fontSize: theme.typographyScale.size.sm, lineHeight: 20},
        optionPrices: {flexShrink: 0, fontSize: theme.typographyScale.size.xs, marginTop: 4},
      }),
    [row, theme],
  );

  const handleAdd = () => {
    if (!selected || unitPrice === undefined) {
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

    setItemNote('');
    setQuantity(1);
    setSheetOpen(false);
    onAdded?.();
    Alert.alert(t('mirrorCartAddedTitle'), t('mirrorCartAddedMessage'));
  };

  const selectOption = (category: MirrorPricingItemCategory, option: MirrorOrderOption | MirrorExtraPrice) => {
    setSelected({category, option});
    setThickness(getAvailableThicknesses(option)[0] ?? '4mm');
    setPickerOpen(false);
  };

  if (!pricing) {
    return null;
  }

  const renderOptionRow = (
    category: MirrorPricingItemCategory,
    option: MirrorOrderOption | MirrorExtraPrice,
  ) => {
    const prices = [
      option.price4mm !== undefined
        ? `${t('mirrorPrice4mm')}: ${formatCurrency(option.price4mm, t('currencyLabel'))}`
        : null,
      option.price6mm !== undefined
        ? `${t('mirrorPrice6mm')}: ${formatCurrency(option.price6mm, t('currencyLabel'))}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <Pressable
        key={`${category}-${option.id}`}
        style={[styles.optionRow, {borderColor: theme.colors.divider}]}
        onPress={() => selectOption(category, option)}
      >
        <Text style={[styles.optionText, textStyle, {color: theme.typography.primary}]}>{t(option.labelKey)}</Text>
        <Text style={[styles.optionPrices, ltrTextStyle, {color: theme.typography.secondary}]}>{prices}</Text>
      </Pressable>
    );
  };

  const formContent = (
    <>
      <Text style={[styles.dimensionsHint, ltrTextStyle, {color: theme.typography.secondary}]}>
        {lengthCm} × {widthCm} cm
      </Text>

      <Pressable
        style={[
          styles.pickerButton,
          {borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground},
        ]}
        onPress={() => setPickerOpen(true)}
      >
        <Text
          style={[
            styles.pickerText,
            textStyle,
            {color: selected ? theme.typography.primary : theme.typography.secondary},
          ]}
        >
          {selected ? t(selected.option.labelKey) : t('mirrorCartChooseOption')}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={22} color={theme.colors.icon} />
      </Pressable>

      {availableThicknesses.length > 1 ? (
        <View style={styles.thicknessRow}>
          {availableThicknesses.map((value) => {
            const active = thickness === value;
            return (
              <Pressable
                key={value}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? theme.colors.primary : theme.colors.divider,
                    backgroundColor: active ? `${theme.colors.primary}18` : theme.colors.surface,
                  },
                ]}
                onPress={() => setThickness(value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    textStyle,
                    {color: active ? theme.colors.primary : theme.typography.primary},
                  ]}
                >
                  {value === '4mm' ? t('mirrorPrice4mm') : t('mirrorPrice6mm')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <AppInput
        fieldKey="cartQuantity"
        label={t('quantity')}
        numeric
        preserveZero
        value={quantity}
        onNumberChange={(value) => setQuantity(Math.max(1, Math.round(value)))}
        keyboardType="numeric"
      />

      <AppInput
        fieldKey="cartItemNote"
        label={t('mirrorCartItemNote')}
        value={itemNote}
        onChangeText={setItemNote}
        placeholder={t('mirrorCartItemNotePlaceholder')}
      />

      <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, inlineTextStyle, {color: theme.typography.secondary}]}>
          {t('mirrorCartLineTotal')}
        </Text>
        <View style={styles.summaryValueWrap}>
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
      </View>

      <AppButton label={t('mirrorCartAddToCart')} onPress={handleAdd} />
    </>
  );

  return (
    <>
      <View style={styles.iconWrap}>
        <Pressable
          style={({pressed}) => [
            styles.iconButton,
            listCard,
            {backgroundColor: `${theme.colors.primary}18`, opacity: pressed ? 0.82 : 1},
          ]}
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('mirrorCartAddSection')}
        >
          <MaterialCommunityIcons name="cart-plus" size={26} color={theme.colors.primary} />
        </Pressable>
      </View>

      <BottomSheet
        visible={sheetOpen}
        title={t('mirrorCartAddSection')}
        onClose={() => setSheetOpen(false)}
        formFields={['cartQuantity', 'cartItemNote']}
      >
        <View style={styles.sheetContent}>{formContent}</View>
      </BottomSheet>

      <BottomSheet visible={pickerOpen} title={t('mirrorCartChooseOption')} onClose={() => setPickerOpen(false)}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={[styles.groupTitle, textStyle, {color: theme.typography.primary, marginTop: 0}]}>
            {t('mirrorPricingOrderOptions')}
          </Text>
          {pricing.orderOptions.map((option) => renderOptionRow('order', option))}

          <Text style={[styles.groupTitle, textStyle, {color: theme.typography.primary}]}>
            {t('mirrorPricingExtras')}
          </Text>
          {pricing.extras.map((option) => renderOptionRow('extra', option))}
        </ScrollView>
      </BottomSheet>
    </>
  );
};

export default MirrorPricingAddToCartSection;
