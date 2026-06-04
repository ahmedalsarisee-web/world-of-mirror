import React, {useMemo} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import GradientCard from '@app/components/common/GradientCard';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {getListCardStyle} from '@shared/theme/themeHelpers';

const BRAND_MARK = require('../../../assets/icon.png');

interface Props {
  title: string;
  subtitle: string;
  userName?: string;
  gradientColors?: string[];
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
}) => {
  const {theme} = useTheme();
  const {centeredTextStyle} = useDirection();
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
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.45)',
          backgroundColor: '#FFFFFF',
          marginBottom: theme.spacing.md,
        },
        logoImage: {
          width: '100%',
          height: '100%',
        },
        avatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.22)',
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.35)',
          marginBottom: theme.spacing.sm,
        },
        avatarText: {
          fontSize: theme.typographyScale.size.md,
          fontWeight: '800',
          color: theme.colors.onPrimary,
          textAlign: 'center',
          width: '100%',
          includeFontPadding: false,
          lineHeight: theme.typographyScale.size.md + 4,
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
      }),
    [theme],
  );

  return (
    <GradientCard colors={gradientColors ?? theme.gradient.header} style={{...listCard, ...styles.card}}>
      <View style={styles.decorLarge} />
      <View style={styles.decorSmall} />

      <View style={styles.logoRing}>
        <Image source={BRAND_MARK} style={styles.logoImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>

      <View style={styles.avatar}>
        <Text style={styles.avatarText} allowFontScaling={false}>
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
