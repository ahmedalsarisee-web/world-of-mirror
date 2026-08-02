import React, {useMemo, type ComponentProps} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface DashboardMetric {
  key: string;
  icon: IconName;
  iconColor: string;
  iconBackground: string;
  accentColor?: string;
  label: string;
  value: string;
  hint?: string;
}

interface Props {
  metrics: DashboardMetric[];
  variant?: 'default' | 'compact';
}

const DashboardMetricGrid: React.FC<Props> = ({metrics, variant = 'default'}) => {
  const isCompact = variant === 'compact';
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, centeredTextStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        grid: {
          flexDirection: row,
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        },
        tile: {
          flexGrow: 1,
          flexBasis: metrics.length > 2 ? (isCompact ? '31%' : '30%') : '46%',
          minWidth: metrics.length === 1 ? '100%' : isCompact ? 90 : 100,
          padding: isCompact ? theme.spacing.sm : theme.spacing.md,
          borderTopWidth: isCompact ? 2 : 3,
          gap: isCompact ? 2 : theme.spacing.xs,
        },
        iconWrap: {
          width: isCompact ? 28 : 34,
          height: isCompact ? 28 : 34,
          borderRadius: isCompact ? 8 : 10,
          alignItems: 'center',
          justifyContent: 'center',
        },
        label: {
          fontSize: isCompact ? 10 : theme.typographyScale.size.xs,
          fontWeight: '600',
          lineHeight: isCompact ? 13 : 16,
        },
        value: {
          fontSize: isCompact ? theme.typographyScale.size.md : theme.typographyScale.size.lg,
          fontWeight: '800',
        },
        hint: {
          fontSize: 10,
          lineHeight: 14,
        },
      }),
    [isCompact, metrics.length, theme],
  );

  return (
    <View style={[styles.grid, layoutStyle]}>
      {metrics.map((metric) => (
        <View
          key={metric.key}
          style={[
            listCard,
            styles.tile,
            {borderTopColor: metric.accentColor ?? metric.iconColor},
          ]}
        >
          <View style={[styles.iconWrap, {backgroundColor: metric.iconBackground}]}>
            <MaterialCommunityIcons name={metric.icon} size={isCompact ? 15 : 18} color={metric.iconColor} />
          </View>
          <Text
            style={[styles.label, textStyle, centeredTextStyle, {color: theme.typography.secondary}]}
            numberOfLines={2}
          >
            {metric.label}
          </Text>
          <Text style={[styles.value, textStyle, centeredTextStyle, {color: theme.typography.primary}]}>
            {metric.value}
          </Text>
          {metric.hint ? (
            <Text
              style={[styles.hint, textStyle, centeredTextStyle, {color: theme.typography.muted}]}
              numberOfLines={1}
            >
              {metric.hint}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
};

export default DashboardMetricGrid;
