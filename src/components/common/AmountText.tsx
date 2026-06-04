import React from 'react';
import {StyleSheet, Text, type TextStyle} from 'react-native';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {formatCurrency} from '@app/utils/format';

interface Props {
  amount: number;
  style?: TextStyle;
  size?: 'sm' | 'md' | 'lg';
  currencyLabel?: string;
  /** Force green (inflows) or red (outflows) when the displayed value is always positive. */
  tone?: 'positive' | 'negative';
  /** Positive amounts red, negative amounts green (salary-advance account). */
  invertSignColors?: boolean;
}

const AmountText: React.FC<Props> = ({
  amount,
  style,
  size = 'md',
  currencyLabel,
  tone,
  invertSignColors = false,
}) => {
  const {theme} = useTheme();
  const {ltrTextStyle, appFont} = useDirection();
  const isSignedAmount = tone === undefined;
  const displayAmount = tone ? Math.abs(amount) : amount;
  const isPositive = tone === 'positive' || (tone === undefined && amount >= 0);
  const positiveColor = invertSignColors ? theme.colors.balanceNegative : theme.colors.balancePositive;
  const negativeColor = invertSignColors ? theme.colors.balancePositive : theme.colors.balanceNegative;
  const color = isPositive ? positiveColor : negativeColor;
  const fontSize =
    size === 'lg' ? theme.typographyScale.size.xxl : size === 'sm' ? theme.typographyScale.size.sm : theme.typographyScale.size.lg;
  const showPlus = isSignedAmount && amount > 0;

  return (
    <Text style={[styles.text, ltrTextStyle, appFont('bold'), {color, fontSize}, style]}>
      {showPlus ? '+' : ''}
      {formatCurrency(displayAmount, currencyLabel)}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {},
});

export default AmountText;
