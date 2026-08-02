import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import GradientCard from '@app/components/common/GradientCard';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  title: string;
  subtitle: string;
  userName?: string;
  gradientColors?: string[];
  variant?: 'default' | 'compact';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

const DashboardHeroCard: React.FC<Props> = ({
  title,
  subtitle,
  userName = '',
  gradientColors,
  variant = 'default',
}) => {
  const {theme} = useTheme();
  const {centeredTextStyle, textStyle, row, layoutStyle} = useDirection();
  const isCompact = variant === 'compact';
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const initials = useMemo(() => getInitials(userName || title), [title, userName]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          marginBottom: theme.spacing.md,
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.lg,
          alignItems: 'center',
        },
        decorLarge: {
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: 'rgba(255,255,255,0.08)',
          top: -40,
          right: -30,
        },
        decorSmall: {
          position: 'absolute',
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: 'rgba(255,255,255,0.06)',
          bottom: -20,
          left: -16,
        },
        logoRing: {
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.45)',
          backgroundColor: 'rgba(255,255,255,0.22)',
          marginBottom: theme.spacing.md,
        },
        logoInitials: {
          fontSize: theme.typographyScale.size.lg,
          fontWeight: '800',
          color: theme.colors.onPrimary,
          textAlign: 'center',
          width: '100%',
          includeFontPadding: false,
        },
        title: {
          fontSize: theme.typographyScale.size.lg,
          fontWeight: '800',
          color: theme.colors.onPrimary,
          marginBottom: 4,
          textAlign: 'center',
        },
        subtitle: {
          fontSize: theme.typographyScale.size.sm,
          color: 'rgba(255,255,255,0.9)',
          lineHeight: 20,
          textAlign: 'center',
          paddingHorizontal: theme.spacing.sm,
        },
        compactCard: {
          marginBottom: theme.spacing.sm,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.lg,
        },
        compactRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.md,
        },
        compactAvatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.22)',
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.35)',
        },
        compactAvatarText: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '800',
          color: theme.colors.onPrimary,
          textAlign: 'center',
          width: '100%',
          includeFontPadding: false,
        },
        compactTextWrap: {
          flex: 1,
          minWidth: 0,
          gap: 2,
        },
        compactTitle: {
          fontSize: theme.typographyScale.size.md,
          fontWeight: '800',
          color: theme.colors.onPrimary,
        },
        compactSubtitle: {
          fontSize: theme.typographyScale.size.xs,
          color: 'rgba(255,255,255,0.88)',
          lineHeight: 16,
        },
      }),
    [row, theme],
  );

  if (isCompact) {
    return (
      <GradientCard
        colors={gradientColors ?? theme.gradient.header}
        style={{...listCard, ...styles.compactCard}}
      >
        <View style={[styles.compactRow, layoutStyle]}>
          <View style={styles.compactAvatar}>
            <Text style={styles.compactAvatarText} allowFontScaling={false}>
              {initials}
            </Text>
          </View>
          <View style={styles.compactTextWrap}>
            <Text style={[styles.compactTitle, textStyle]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.compactSubtitle, textStyle]} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
        </View>
      </GradientCard>
    );
  }

  return (
    <GradientCard colors={gradientColors ?? theme.gradient.header} style={{...listCard, ...styles.card}}>
      <View style={styles.decorLarge} />
      <View style={styles.decorSmall} />

      <View style={styles.logoRing}>
        <Text style={styles.logoInitials} allowFontScaling={false}>
          {initials}
        </Text>
      </View>

      <Text style={[styles.title, centeredTextStyle]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.subtitle, centeredTextStyle]} numberOfLines={3}>
        {subtitle}
      </Text>
    </GradientCard>
  );
};

export default DashboardHeroCard;
