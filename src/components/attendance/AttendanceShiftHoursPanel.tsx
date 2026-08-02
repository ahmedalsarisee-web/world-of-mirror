import React, {useEffect, useMemo, useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {updateEmployeeAttendanceShiftHours} from '@app/services/users.service';
import {
  ATTENDANCE_SHIFT_HOURS_MAX,
  ATTENDANCE_SHIFT_HOURS_MIN,
  formatAttendanceShiftHoursSummary,
  formatAttendanceShiftHoursValue,
  parseAttendanceShiftHoursInput,
} from '@app/utils/attendanceShiftHours';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  userId: string;
  shiftHours?: number;
}

const AttendanceShiftHoursPanel: React.FC<Props> = ({userId, shiftHours}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, layoutStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const [hoursInput, setHoursInput] = useState(formatAttendanceShiftHoursValue(shiftHours));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHoursInput(formatAttendanceShiftHoursValue(shiftHours));
  }, [shiftHours]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          padding: theme.spacing.md,
          marginBottom: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        hint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
        },
        currentSummary: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
        },
        clearBtn: {
          marginTop: theme.spacing.xs,
        },
      }),
    [theme],
  );

  const handleSave = async () => {
    const parsed = parseAttendanceShiftHoursInput(hoursInput);
    if (parsed === 'invalid') {
      Alert.alert(
        t('error'),
        t('attendanceShiftHoursInvalid', {
          min: ATTENDANCE_SHIFT_HOURS_MIN,
          max: ATTENDANCE_SHIFT_HOURS_MAX,
        }),
      );
      return;
    }

    setSaving(true);
    try {
      await updateEmployeeAttendanceShiftHours(userId, parsed);
      Alert.alert(t('done'), t('attendanceShiftHoursSaved'));
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await updateEmployeeAttendanceShiftHours(userId, null);
      setHoursInput('');
      Alert.alert(t('done'), t('attendanceShiftHoursCleared'));
    } catch {
      Alert.alert(t('error'), t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[listCard, styles.card, layoutStyle]}>
      <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
        {t('attendanceShiftHoursHint')}
      </Text>

      <Text style={[styles.currentSummary, textStyle, {color: theme.typography.primary}]}>
        {t('attendanceShiftHoursCurrent', {value: formatAttendanceShiftHoursSummary(shiftHours, t)})}
      </Text>

      <AppInput
        label={t('attendanceShiftHoursInputLabel')}
        value={hoursInput}
        onChangeText={setHoursInput}
        keyboardType="decimal-pad"
        placeholder={t('attendanceShiftHoursInputPlaceholder')}
      />

      <AppButton label={t('attendanceShiftHoursSave')} onPress={handleSave} loading={saving} />

      {shiftHours ? (
        <AppButton
          label={t('attendanceShiftHoursClear')}
          variant="outline"
          onPress={handleClear}
          disabled={saving}
          style={styles.clearBtn}
        />
      ) : null}
    </View>
  );
};

export default AttendanceShiftHoursPanel;
