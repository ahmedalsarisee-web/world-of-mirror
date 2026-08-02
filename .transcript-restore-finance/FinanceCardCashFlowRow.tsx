import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AmountText from '@app/components/common/AmountText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  cashIn: number;
  cashOut: number;
}

const FinanceCardCashFlowRow: React.FC<Props> = ({cashIn, cashOut}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {row, layoutStyle, centeredTextStyle} = useDirection();
  const currencyLabel = t('currencyLabel');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: row,
          alignItems: 'stretch',
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceSecondary,
          overflow: 'hidden',
        },
        column: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.xs,
          gap: 2,
        },
        divider: {
          width: 1,
          backgroundColor: theme.colors.divider,
          marginVertical: theme.spacing.xs,
        },
        label: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        },
      }),
    [row, theme],
  );

  return (
    <View style={[styles.root, layoutStyle]}>
      <View style={styles.column}>
        <Text
          style={[styles.label, centeredTextStyle, {color: theme.colors.success}]}
          numberOfLines={1}
        >
          {t('cashIn')}
        </Text>
        <AmountText amount={cashIn} tone="positive" size="sm" currencyLabel={currencyLabel} />
      </View>
      <View style={styles.divider} />
      <View style={styles.column}>
        <Text
          style={[styles.label, centeredTextStyle, {color: theme.colors.danger}]}
          numberOfLines={1}
        >
          {t('cashOut')}
        </Text>
        <AmountText amount={cashOut} tone="negative" size="sm" currencyLabel={currencyLabel} />
      </View>
    </View>
  );
};

export default FinanceCardCashFlowRow;
