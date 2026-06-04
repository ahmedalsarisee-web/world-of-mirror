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
  children: React.ReactNode;
}

const DashboardSection: React.FC<Props> = ({
  title,
  subtitle,
  icon,
  iconColor,
  iconBackground,
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
          marginBottom: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
        header: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: 2,
        },
        iconWrap: {
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerText: {
          flex: 1,
          minWidth: 0,
        },
        title: {
          fontSize: theme.typographyScale.size.md,
          fontWeight: '800',
        },
        subtitle: {
          fontSize: theme.typographyScale.size.xs,
          marginTop: 2,
          lineHeight: 16,
        },
      }),
    [row, theme],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, layoutStyle]}>
        {icon ? (
          <View style={[styles.iconWrap, {backgroundColor: iconBg}]}>
            <MaterialCommunityIcons name={icon} size={18} color={accent} />
          </View>
        ) : null}
        <View style={styles.headerText}>
          <Text style={[styles.title, textStyle, {color: theme.typography.primary}]}>{title}</Text>
          {subtitle ? (
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
