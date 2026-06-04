import React, {useMemo} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {AttendanceEventType, AttendanceRecord} from '@app/types/models';
import {getNextAttendanceAction} from '@app/utils/attendanceReport';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  records: AttendanceRecord[];
  daysWithCheckIn: number;
  totalSeconds: number;
  todayStatus: string;
  onAction: (type: AttendanceEventType) => void;
  actionLoading?: boolean;
  requireLocationCheck?: boolean;
  requireGpsLinked?: boolean;
}

const EmployeeHomeAttendanceCard: React.FC<Props> = ({
  records,
  todayStatus,
  onAction,
  actionLoading,
  requireLocationCheck = false,
  requireGpsLinked = false,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, centeredTextStyle, appFont} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const nextAction = useMemo(() => getNextAttendanceAction(records), [records]);
  const isCheckedIn = nextAction === 'check_out';
  const actionLabel = nextAction === 'check_in' ? t('checkIn') : t('checkOut');
  const actionColor = nextAction === 'check_in' ? theme.colors.success : theme.colors.danger;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: row,
          alignItems: 'center',
          padding: theme.spacing.md,
          marginBottom: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
        iconWrap: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isCheckedIn ? theme.colors.successLight : theme.colors.surfaceSecondary,
          flexShrink: 0,
        },
        textWrap: {flex: 1, minWidth: 0},
        labelRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: 4,
          marginBottom: 2,
        },
        label: {
          fontSize: theme.typographyScale.size.xs,
        },
        status: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        actionChip: {
          minWidth: 72,
          height: 34,
          borderRadius: theme.radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 10,
          flexShrink: 0,
        },
        actionLabel: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
        },
      }),
    [isCheckedIn, row, theme],
  );

  return (
    <View style={[listCard, styles.card, layoutStyle]}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons
          name={isCheckedIn ? 'account-check-outline' : 'calendar-clock'}
          size={20}
          color={isCheckedIn ? theme.colors.success : theme.colors.primary}
        />
      </View>

      <View style={styles.textWrap}>
        <View style={[styles.labelRow, layoutStyle]}>
          <Text style={[styles.label, textStyle, {color: theme.typography.secondary}]}>
            {t('attendanceTodayStatus')}
          </Text>
          {nextAction === 'check_in' && requireLocationCheck ? (
            <MaterialCommunityIcons name="map-marker-radius" size={12} color={theme.typography.secondary} />
          ) : null}
          {requireGpsLinked ? (
            <MaterialCommunityIcons name="crosshairs-gps" size={12} color={theme.colors.primary} />
          ) : null}
        </View>
        <Text style={[styles.status, textStyle, {color: theme.typography.primary}]} numberOfLines={1}>
          {todayStatus}
        </Text>
        {requireGpsLinked ? (
          <Text style={[styles.label, textStyle, {color: theme.colors.primary, marginTop: 4}]} numberOfLines={2}>
            {t('attendanceGpsLinkedActiveHint')}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => onAction(nextAction)}
        disabled={actionLoading}
        style={({pressed}) => [
          styles.actionChip,
          {backgroundColor: actionColor, opacity: pressed || actionLoading ? 0.75 : 1},
        ]}
      >
        {actionLoading ? (
          <ActivityIndicator size="small" color={theme.colors.onPrimary} />
        ) : (
          <Text style={[styles.actionLabel, centeredTextStyle, appFont('bold'), {color: theme.colors.onPrimary}]}>
            {actionLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
};

export default EmployeeHomeAttendanceCard;
