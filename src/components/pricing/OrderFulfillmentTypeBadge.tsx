import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {
  getOrderFulfillmentTypeLabel,
  getOrderFulfillmentTypePalette,
  type OrderFulfillmentType,
} from '@app/types/orderFulfillmentType';

interface Props {
  type: OrderFulfillmentType;
  compact?: boolean;
}

const OrderFulfillmentTypeBadge: React.FC<Props> = ({type, compact = false}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {inlineTextStyle} = useDirection();
  const isLight = theme.colors.background === '#F8FAFC';
  const palette = getOrderFulfillmentTypePalette(type, isLight);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          alignSelf: 'flex-start',
          borderRadius: 999,
          borderWidth: 1,
          paddingHorizontal: compact ? 8 : 10,
          paddingVertical: compact ? 2 : 4,
          maxWidth: '100%',
        },
        text: {
          fontSize: compact ? 10 : 11,
          fontWeight: '700',
          lineHeight: compact ? 14 : 15,
        },
      }),
    [compact],
  );

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.selectedBackground,
          borderColor: palette.selectedBorder,
        },
      ]}
    >
      <Text style={[styles.text, inlineTextStyle, {color: palette.selectedText}]} numberOfLines={1}>
        {getOrderFulfillmentTypeLabel(type, t)}
      </Text>
    </View>
  );
};

export default OrderFulfillmentTypeBadge;
