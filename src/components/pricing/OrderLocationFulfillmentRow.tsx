import React from 'react';
import {StyleSheet, Text, View, type TextStyle} from 'react-native';
import {useTranslation} from 'react-i18next';
import LinkableText from '@app/components/common/LinkableText';
import ConfirmedOrderInfoRow from '@app/components/pricing/ConfirmedOrderInfoRow';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {
  getOrderFulfillmentTypeLabel,
  type OrderFulfillmentType,
} from '@app/types/orderFulfillmentType';

interface Props {
  location: string;
  fulfillmentType?: OrderFulfillmentType;
  dense?: boolean;
  numberOfLines?: number;
  textStyle?: TextStyle;
}

const OrderLocationFulfillmentRow: React.FC<Props> = ({
  location,
  fulfillmentType,
  dense = false,
  numberOfLines = 1,
  textStyle,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {inlineTextStyle, row} = useDirection();
  const trimmedLocation = location.trim();
  const fulfillmentLabel = fulfillmentType
    ? getOrderFulfillmentTypeLabel(fulfillmentType, t)
    : '';

  if (!trimmedLocation && !fulfillmentLabel) {
    return null;
  }

  const metaStyle = textStyle ?? styles.defaultMeta;
  const locationPrefix = trimmedLocation ? `${t('mirrorCartLocation')}: ` : '';

  return (
    <ConfirmedOrderInfoRow icon="map-marker-outline" dense={dense}>
      <View style={[styles.contentRow, {flexDirection: row}]}>
        {trimmedLocation ? (
          <>
            <Text style={[metaStyle, inlineTextStyle, {color: theme.typography.secondary}]}>
              {locationPrefix}
            </Text>
            <LinkableText
              text={trimmedLocation}
              style={[metaStyle, inlineTextStyle, {color: theme.typography.secondary, flexShrink: 1}]}
              numberOfLines={numberOfLines}
            />
          </>
        ) : null}
        {trimmedLocation && fulfillmentLabel ? (
          <Text style={[metaStyle, inlineTextStyle, {color: theme.typography.secondary}]}>
            {' → '}
          </Text>
        ) : null}
        {fulfillmentLabel ? (
          <Text
            style={[metaStyle, inlineTextStyle, {color: theme.typography.primary, fontWeight: '700'}]}
            numberOfLines={1}
          >
            {fulfillmentLabel}
          </Text>
        ) : null}
      </View>
    </ConfirmedOrderInfoRow>
  );
};

const styles = StyleSheet.create({
  defaultMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  contentRow: {
    flex: 1,
    minWidth: 0,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});

export default OrderLocationFulfillmentRow;
