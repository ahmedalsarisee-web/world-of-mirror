import React, {useMemo} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import LiveAttendanceDurationText from '@app/components/attendance/LiveAttendanceDurationText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {AttendanceEventType, AttendanceRecord} from '@app/types/models';
import {
  formatAttendanceDuration,
  getNextAttendanceAction,
  getTodayAttendanceDay,
} from '@app/utils/attendanceReport';
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
  variant?: 'default' | 'compact';
}

const EmployeeHomeAttendanceCard: React.FC<Props> = ({
  records,
  todayStatus,
  onAction,
  actionLoading,
  requireLocationCheck = false,
  requireGpsLinked = false,
  variant = 'default',
}) => {
  const isCompact = variant === 'compact';
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, centeredTextStyle, appFont, ltrTextStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const nextAction = useMemo(() => getNextAttendanceAction(records), [records]);
  const todayDay = useMemo(() => getTodayAttendanceDay(records), [records]);
  const showTodayHours = Boolean(todayDay && (todayDay.isOpen || todayDay.totalDurationSeconds > 0));
  const isCheckedIn = nextAction === 'check_out';
  const actionLabel = nextAction === 'check_in' ? t('checkIn') : t('checkOut');
  const actionColor = nextAction === 'check_in' ? theme.colors.success : theme.colors.danger;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: row,
          alignItems: 'center',
          padding: isCompact ? theme.spacing.sm : theme.spacing.md,
          marginBottom: isCompact ? 0 : theme.spacing.lg,
          gap: theme.spacing.sm,
        },
        iconWrap: {
          width: isCompact ? 32 : 36,
          height: isCompact ? 32 : 36,
          borderRadius: isCompact ? 16 : 18,
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
          fontSize: isCompact ? theme.typographyScale.size.xs : theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        hoursPill: {
          alignSelf: 'flex-start',
          marginTop: 4,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: theme.radius.sm,
          backgroundColor: `${theme.colors.primary}18`,
        },
        hoursText: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
        },
        actionChip: {
          minWidth: isCompact ? 64 : 72,
          height: isCompact ? 30 : 34,
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
    [isCheckedIn, isCompact, row, theme],
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
          {requireLocationCheck ? (
            <MaterialCommunityIcons name="map-marker-radius" size={12} color={theme.typography.secondary} />
          ) : null}
          {requireGpsLinked ? (
            <MaterialCommunityIcons name="crosshairs-gps" size={12} color={theme.colors.primary} />
          ) : null}
        </View>
        <Text style={[styles.status, textStyle, {color: theme.typography.primary}]} numberOfLines={isCompact ? 1 : 2}>
          {todayStatus}
        </Text>
        {showTodayHours && todayDay ? (
          <View style={styles.hoursPill}>
            {todayDay.isOpen ? (
              <LiveAttendanceDurationText
                baseSeconds={todayDay.totalDurationSeconds}
                records={todayDay.records}
                style={[styles.hoursText, ltrTextStyle, appFont('bold'), {color: theme.colors.primary}]}
              />
            ) : (
              <Text style={[styles.hoursText, ltrTextStyle, appFont('bold'), {color: theme.colors.primary}]}>
                {formatAttendanceDuration(todayDay.totalDurationSeconds)}
              </Text>
            )}
          </View>
        ) : null}
        {!isCompact && requireGpsLinked ? (
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
