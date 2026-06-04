import React, {useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {updateEmployeeAttendanceResetSchedule} from '@app/services/users.service';
import type {AttendanceHoursResetSchedule, AttendanceResetScheduleType} from '@app/types/models';
import {formatScheduleSummary} from '@app/utils/attendanceSchedule';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  userId: string;
  schedule?: AttendanceHoursResetSchedule;
}

const WEEKDAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6];

const AttendanceResetSchedulePanel: React.FC<Props> = ({userId, schedule}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const [scheduleType, setScheduleType] = useState<AttendanceResetScheduleType>(
    schedule?.type ?? 'none',
  );
  const [weeklyDay, setWeeklyDay] = useState(schedule?.weeklyDay ?? 4);
  const [monthlyDay, setMonthlyDay] = useState(String(schedule?.monthlyDay ?? 15));
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setScheduleType(schedule?.type ?? 'none');
    setWeeklyDay(schedule?.weeklyDay ?? 4);
    setMonthlyDay(String(schedule?.monthlyDay ?? 15));
  }, [schedule?.monthlyDay, schedule?.type, schedule?.weeklyDay]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          padding: theme.spacing.md,
          marginBottom: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        title: {
          fontSize: theme.typographyScale.size.md,
          fontWeight: '700',
        },
        hint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
        },
        typeRow: {
          flexDirection: row,
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
        },
        typeChip: {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
        },
        typeChipText: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
        },
        weekdayRow: {
          flexDirection: row,
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
        },
        weekdayChip: {
          minWidth: 44,
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          alignItems: 'center',
        },
        currentSummary: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
        },
      }),
    [row, theme],
  );

  const handleSave = async () => {
    const parsedMonthlyDay = Number(monthlyDay);
    if (scheduleType === 'monthly' && (!Number.isInteger(parsedMonthlyDay) || parsedMonthlyDay < 1 || parsedMonthlyDay > 31)) {
      Alert.alert(t('error'), t('attendanceResetScheduleInvalidDay'));
      return;
    }

    const nextSchedule: AttendanceHoursResetSchedule =
      scheduleType === 'none'
        ? {type: 'none'}
        : scheduleType === 'weekly'
          ? {type: 'weekly', weeklyDay}
          : {type: 'monthly', monthlyDay: parsedMonthlyDay};

    setSaving(true);
    try {
      await updateEmployeeAttendanceResetSchedule(userId, nextSchedule);
      Alert.alert(t('done'), t('attendanceResetScheduleSaved'));
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[listCard, styles.card, layoutStyle]}>
      <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
        {t('attendanceResetScheduleHint')}
      </Text>
      {schedule ? (
        <Text style={[styles.currentSummary, textStyle, {color: theme.colors.primary}]}>
          {t('attendanceResetScheduleCurrent')}: {formatScheduleSummary(schedule, t)}
        </Text>
      ) : null}

      <View style={styles.typeRow}>
        {(['none', 'weekly', 'monthly'] as AttendanceResetScheduleType[]).map((type) => {
          const selected = scheduleType === type;
          return (
            <Pressable
              key={type}
              style={[
                styles.typeChip,
                {
                  borderColor: selected ? theme.colors.primary : theme.colors.divider,
                  backgroundColor: selected ? `${theme.colors.primary}18` : theme.colors.surface,
                },
              ]}
              onPress={() => setScheduleType(type)}
            >
              <Text
                style={[
                  styles.typeChipText,
                  textStyle,
                  {color: selected ? theme.colors.primary : theme.typography.primary},
                ]}
              >
                {t(`attendanceResetScheduleType_${type}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {scheduleType === 'weekly' ? (
        <View style={styles.weekdayRow}>
          {WEEKDAY_OPTIONS.map((day) => {
            const selected = weeklyDay === day;
            return (
              <Pressable
                key={day}
                style={[
                  styles.weekdayChip,
                  {
                    borderColor: selected ? theme.colors.primary : theme.colors.divider,
                    backgroundColor: selected ? `${theme.colors.primary}18` : theme.colors.surface,
                  },
                ]}
                onPress={() => setWeeklyDay(day)}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    textStyle,
                    {color: selected ? theme.colors.primary : theme.typography.primary},
                  ]}
                >
                  {t(`weekdayShort${day}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {scheduleType === 'monthly' ? (
        <AppInput
          label={t('attendanceResetScheduleMonthlyDay')}
          value={monthlyDay}
          onChangeText={setMonthlyDay}
          keyboardType="numeric"
          placeholder="15"
        />
      ) : null}

      <AppButton label={t('attendanceResetScheduleSave')} onPress={handleSave} loading={saving} />
    </View>
  );
};

export default AttendanceResetSchedulePanel;
