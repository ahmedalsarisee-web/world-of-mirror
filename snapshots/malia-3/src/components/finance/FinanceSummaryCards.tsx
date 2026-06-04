import React, {useMemo, type ComponentProps} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AmountText from '@app/components/common/AmountText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  cashIn: number;
  cashOut: number;
  totalBalance: number;
  loading?: boolean;
}

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface MetricProps {
  icon: IconName;
  iconColor: string;
  iconBackground: string;
  title: string;
  amount: number;
  tone?: 'positive' | 'negative';
  currencyLabel: string;
}

const CompactMetric: React.FC<MetricProps> = ({
  icon,
  iconColor,
  iconBackground,
  title,
  amount,
  tone,
  currencyLabel,
}) => {
  const {theme} = useTheme();
  const {textStyle, centeredTextStyle} = useDirection();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        metric: {flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm},
        iconWrap: {
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: theme.spacing.xs,
        },
        title: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
          color: theme.typography.primary,
          marginBottom: 2,
          textAlign: 'center',
        },
      }),
    [theme],
  );

  return (
    <View style={styles.metric}>
      <View style={[styles.iconWrap, {backgroundColor: iconBackground}]}>
        <MaterialCommunityIcons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={[styles.title, textStyle, centeredTextStyle]} numberOfLines={1}>
        {title}
      </Text>
      <AmountText amount={amount} tone={tone} size="sm" currencyLabel={currencyLabel} />
    </View>
  );
};

const FinanceSummaryCards: React.FC<Props> = ({cashIn, cashOut, totalBalance, loading}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const currencyLabel = t('currencyLabel');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {marginBottom: theme.spacing.lg, overflow: 'hidden'},
        metricsRow: {flexDirection: row, alignItems: 'stretch'},
        divider: {
          width: 1,
          backgroundColor: theme.colors.divider,
          marginVertical: theme.spacing.sm,
        },
        totalRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.colors.divider,
          backgroundColor: theme.colors.surfaceSecondary,
        },
        totalLeft: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          flex: 1,
        },
        totalIconWrap: {
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface,
        },
        totalTitle: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
          color: theme.colors.success,
          flexShrink: 1,
        },
        loadingWrap: {
          minHeight: 88,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.md,
        },
      }),
    [row, theme],
  );

  if (loading) {
    return (
      <View style={[styles.loadingWrap, listCard, styles.root]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[listCard, styles.root]}>
      <View style={styles.metricsRow}>
        <CompactMetric
          icon="cash-plus"
          iconColor={theme.colors.success}
          iconBackground={theme.colors.successLight}
          title={t('cashIn')}
          amount={cashIn}
          tone="positive"
          currencyLabel={currencyLabel}
        />
        <View style={styles.divider} />
        <CompactMetric
          icon="cash-minus"
          iconColor={theme.colors.danger}
          iconBackground={theme.colors.dangerLight}
          title={t('cashOut')}
          amount={cashOut}
          tone="negative"
          currencyLabel={currencyLabel}
        />
      </View>

      <View style={[styles.totalRow, layoutStyle]}>
        <View style={styles.totalLeft}>
          <View style={styles.totalIconWrap}>
            <MaterialCommunityIcons name="wallet-outline" size={16} color={theme.colors.primary} />
          </View>
          <Text style={[styles.totalTitle, textStyle]} numberOfLines={1}>
            {t('totalBalance')}
          </Text>
        </View>
        <AmountText amount={totalBalance} size="sm" currencyLabel={currencyLabel} />
      </View>
    </View>
  );
};

export default FinanceSummaryCards;
