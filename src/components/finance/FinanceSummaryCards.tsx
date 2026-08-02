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
  variant?: 'default' | 'compact';
}

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface FlowChipProps {
  icon: IconName;
  label: string;
  amount: number;
  tone: 'positive' | 'negative';
  currencyLabel: string;
}

const FlowChip: React.FC<FlowChipProps> = ({icon, label, amount, tone, currencyLabel}) => {
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, inlineTextStyle} = useDirection();
  const isPositive = tone === 'positive';
  const accent = isPositive ? theme.colors.success : theme.colors.danger;
  const background = isPositive ? theme.colors.successLight : theme.colors.dangerLight;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        chip: {
          flex: 1,
          flexDirection: row,
          alignItems: 'center',
          gap: 8,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 10,
        },
        iconWrap: {
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        label: {
          fontSize: 10,
          fontWeight: '600',
        },
      }),
    [],
  );

  return (
    <View style={[styles.chip, layoutStyle, {backgroundColor: background}]}>
      <View style={[styles.iconWrap, {backgroundColor: theme.colors.card}]}>
        <MaterialCommunityIcons name={icon} size={13} color={accent} />
      </View>
      <View style={{flex: 1, minWidth: 0}}>
        <Text style={[styles.label, inlineTextStyle, {color: theme.typography.secondary}]} numberOfLines={1}>
          {label}
        </Text>
        <AmountText amount={amount} tone={tone} size="sm" currencyLabel={currencyLabel} />
      </View>
    </View>
  );
};

const FinanceSummaryCards: React.FC<Props> = ({
  cashIn,
  cashOut,
  totalBalance,
  loading,
  variant = 'default',
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, centeredTextStyle, inlineTextStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const currencyLabel = t('currencyLabel');
  const isCompact = variant === 'compact';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          overflow: 'hidden',
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radius.lg,
        },
        accentBar: {
          position: 'absolute',
          top: 0,
          start: 0,
          end: 0,
          height: 4,
          backgroundColor: theme.colors.primary,
          opacity: 0.85,
        },
        label: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
          marginBottom: 4,
          textAlign: 'center',
        },
        balanceWrap: {
          alignItems: 'center',
          marginBottom: theme.spacing.md,
        },
        balanceLabel: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
        chipsRow: {
          flexDirection: row,
          gap: theme.spacing.sm,
        },
        compactRoot: {
          overflow: 'hidden',
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.lg,
        },
        compactRow: {
          flexDirection: row,
          alignItems: 'stretch',
          gap: theme.spacing.sm,
        },
        compactCol: {
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
          gap: 4,
        },
        compactLabel: {
          fontSize: 10,
          fontWeight: '600',
          textAlign: 'center',
        },
        loadingWrap: {
          minHeight: 72,
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

  if (isCompact) {
    return (
      <View style={[listCard, styles.compactRoot]}>
        <View style={[styles.compactRow, layoutStyle]}>
          <View style={styles.compactCol}>
            <Text
              style={[
                styles.compactLabel,
                centeredTextStyle,
                {color: theme.typography.secondary},
              ]}
              numberOfLines={2}
            >
              {t('totalBalance')}
            </Text>
            <AmountText amount={totalBalance} size="md" currencyLabel={currencyLabel} tone="positive" />
          </View>
          <View style={styles.compactCol}>
            <Text
              style={[
                styles.compactLabel,
                centeredTextStyle,
                {color: theme.typography.secondary},
              ]}
              numberOfLines={2}
            >
              {t('cashIn')}
            </Text>
            <AmountText amount={cashIn} size="md" currencyLabel={currencyLabel} tone="positive" />
          </View>
          <View style={styles.compactCol}>
            <Text
              style={[
                styles.compactLabel,
                centeredTextStyle,
                {color: theme.typography.secondary},
              ]}
              numberOfLines={2}
            >
              {t('cashOut')}
            </Text>
            <AmountText amount={cashOut} size="md" currencyLabel={currencyLabel} tone="negative" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[listCard, styles.root]}>
      <View style={styles.accentBar} />
      <View style={styles.balanceWrap}>
        <Text
          style={[
            styles.label,
            styles.balanceLabel,
            textStyle,
            centeredTextStyle,
            {color: theme.typography.secondary},
          ]}
        >
          {t('totalBalance')}
        </Text>
        <AmountText amount={totalBalance} size="lg" currencyLabel={currencyLabel} />
      </View>

      <View style={[styles.chipsRow, layoutStyle]}>
        <FlowChip
          icon="arrow-down-bold"
          label={t('cashIn')}
          amount={cashIn}
          tone="positive"
          currencyLabel={currencyLabel}
        />
        <FlowChip
          icon="arrow-up-bold"
          label={t('cashOut')}
          amount={cashOut}
          tone="negative"
          currencyLabel={currencyLabel}
        />
      </View>
    </View>
  );
};

export default FinanceSummaryCards;
