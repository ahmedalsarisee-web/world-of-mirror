import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {AttendanceLocationPermissionState} from '@app/utils/attendancePermissions';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  state: AttendanceLocationPermissionState;
  onRequestPermission: () => void;
  loading?: boolean;
  variant?: 'default' | 'compact';
}

const AttendanceLocationPermissionCard: React.FC<Props> = ({
  state,
  onRequestPermission,
  loading = false,
  variant = 'default',
}) => {
  const isCompact = variant === 'compact';
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, centeredTextStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          padding: isCompact ? theme.spacing.sm : theme.spacing.md,
          marginBottom: isCompact ? theme.spacing.xs : theme.spacing.sm,
          gap: isCompact ? theme.spacing.xs : theme.spacing.sm,
        },
        header: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
        },
        title: {
          flex: 1,
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        message: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: isCompact ? 15 : 18,
        },
      }),
    [isCompact, row, theme],
  );

  if (state === 'granted') {
    return null;
  }

  const isBlocked = state === 'blocked';
  const message = isBlocked
    ? t('attendanceLocationDeniedMessage')
    : t('attendanceLocationPermissionPromptMessage');
  const actionLabel = isBlocked ? t('openSettings') : t('attendanceLocationPermissionAllow');

  return (
    <View style={[styles.card, listCard, layoutStyle]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="map-marker-radius" size={isCompact ? 18 : 22} color={theme.colors.primary} />
        <Text style={[styles.title, textStyle, {color: theme.typography.primary}]} numberOfLines={isCompact ? 1 : 2}>
          {t('attendanceLocationPermissionPromptTitle')}
        </Text>
      </View>
      <Text
        style={[styles.message, textStyle, centeredTextStyle, {color: theme.typography.secondary}]}
        numberOfLines={isCompact ? 2 : 4}
      >
        {message}
      </Text>
      <AppButton
        label={actionLabel}
        variant={isCompact ? 'outline' : 'primary'}
        onPress={onRequestPermission}
        loading={loading}
        disabled={loading}
      />
    </View>
  );
};

export default AttendanceLocationPermissionCard;