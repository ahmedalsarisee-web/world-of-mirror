import React, {useMemo, type ComponentProps} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  iconBackground?: string;
  compact?: boolean;
  children: React.ReactNode;
}

const DashboardSection: React.FC<Props> = ({
  title,
  subtitle,
  icon,
  iconColor,
  iconBackground,
  compact = false,
  children,
}) => {
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle} = useDirection();
  const accent = iconColor ?? theme.colors.primary;
  const iconBg = iconBackground ?? theme.colors.surfaceSecondary;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          marginBottom: compact ? theme.spacing.sm : theme.spacing.lg,
          gap: compact ? theme.spacing.xs : theme.spacing.sm,
        },
        header: {
          flexDirection: row,
          alignItems: 'center',
          gap: compact ? theme.spacing.xs : theme.spacing.sm,
          paddingHorizontal: 2,
        },
        iconWrap: {
          width: compact ? 28 : 36,
          height: compact ? 28 : 36,
          borderRadius: compact ? 8 : 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerText: {
          flex: 1,
          minWidth: 0,
        },
        title: {
          fontSize: compact ? theme.typographyScale.size.sm : theme.typographyScale.size.md,
          fontWeight: '800',
        },
        subtitle: {
          fontSize: theme.typographyScale.size.xs,
          marginTop: 2,
          lineHeight: 16,
        },
      }),
    [compact, row, theme],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, layoutStyle]}>
        {icon ? (
          <View style={[styles.iconWrap, {backgroundColor: iconBg}]}>
            <MaterialCommunityIcons name={icon} size={compact ? 15 : 18} color={accent} />
          </View>
        ) : null}
        <View style={styles.headerText}>
          <Text style={[styles.title, textStyle, {color: theme.typography.primary}]}>{title}</Text>
          {!compact && subtitle ? (
            <Text style={[styles.subtitle, textStyle, {color: theme.typography.secondary}]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
};

export default DashboardSection;
