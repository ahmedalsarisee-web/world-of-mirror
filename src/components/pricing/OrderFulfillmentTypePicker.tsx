import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {
  ORDER_FULFILLMENT_TYPES,
  getOrderFulfillmentTypeLabel,
  getOrderFulfillmentTypePalette,
  type OrderFulfillmentType,
} from '@app/types/orderFulfillmentType';

interface Props {
  value: OrderFulfillmentType | null;
  onChange: (value: OrderFulfillmentType) => void;
  disabled?: boolean;
  error?: string;
}

const OrderFulfillmentTypePicker: React.FC<Props> = ({value, onChange, disabled = false, error}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {row, textStyle, layoutStyle} = useDirection();
  const isLight = theme.colors.background === '#F8FAFC';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {gap: theme.spacing.xs},
        label: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          opacity: 0.7,
        },
        row: {
          flexDirection: row,
          alignItems: 'stretch',
          gap: 4,
        },
        option: {
          flex: 1,
          flexBasis: 0,
          minWidth: 0,
          minHeight: 46,
          borderRadius: 10,
          borderWidth: 1.5,
          paddingHorizontal: 3,
          paddingVertical: 6,
          alignItems: 'center',
          justifyContent: 'center',
        },
        optionText: {
          fontSize: 9,
          fontWeight: '700',
          lineHeight: 12,
          textAlign: 'center',
        },
        error: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 16,
        },
      }),
    [row, theme],
  );

  return (
    <View style={[styles.root, layoutStyle]}>
      <Text
        style={[
          styles.label,
          textStyle,
          {color: error ? theme.status.error : theme.typography.secondary},
        ]}
      >
        {t('orderFulfillmentTypeLabel')}
      </Text>
      <View
        style={[
          styles.row,
          error && !value
            ? {
                borderWidth: 1,
                borderColor: theme.status.error,
                borderRadius: 10,
                padding: 2,
              }
            : null,
        ]}
      >
        {ORDER_FULFILLMENT_TYPES.map((type) => {
          const palette = getOrderFulfillmentTypePalette(type, isLight);
          const selected = value === type;
          return (
            <Pressable
              key={type}
              disabled={disabled}
              onPress={() => onChange(type)}
              accessibilityRole="radio"
              accessibilityState={{selected, disabled}}
              accessibilityLabel={getOrderFulfillmentTypeLabel(type, t)}
              style={({pressed}) => [
                styles.option,
                {
                  backgroundColor: selected ? palette.selectedBackground : palette.background,
                  borderColor: selected ? palette.selectedBorder : palette.border,
                  opacity: disabled ? 0.55 : pressed ? 0.88 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  textStyle,
                  {
                    color: selected ? palette.selectedText : palette.text,
                  },
                ]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {getOrderFulfillmentTypeLabel(type, t)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text style={[styles.error, textStyle, {color: theme.status.error}]}>{error}</Text>
      ) : null}
    </View>
  );
};

export default OrderFulfillmentTypePicker;
