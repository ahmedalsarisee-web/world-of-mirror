import React, {useEffect, useMemo} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import AppTimePickerField from '@app/components/common/AppTimePickerField';
import BottomSheet from '@app/components/common/BottomSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {AttendanceDaySummary} from '@app/utils/attendanceReport';
import {
  computeDaySessionDurationSeconds,
  extractDaySessionRecords,
  formatAttendanceDuration,
  splitAttendanceDateTime,
} from '@app/utils/attendanceReport';
import {formatDate} from '@app/utils/format';
import {attendanceDayEditSchema, type AttendanceDayEditFormValues} from '@app/utils/validation';

interface Props {
  day: AttendanceDaySummary | null;
  visible: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (values: AttendanceDayEditFormValues) => void | Promise<void>;
  onClearDay?: () => void | Promise<void>;
}

const EditAttendanceDaySheet: React.FC<Props> = ({
  day,
  visible,
  saving = false,
  onClose,
  onSave,
  onClearDay,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, centeredTextStyle} = useDirection();
  const {control, handleSubmit, reset, watch, formState: {errors}} = useForm<AttendanceDayEditFormValues>({
    resolver: zodResolver(attendanceDayEditSchema),
    defaultValues: {date: '', checkInTime: '', checkOutTime: '', note: ''},
  });

  const dateValue = watch('date');
  const checkInTimeValue = watch('checkInTime');
  const checkOutTimeValue = watch('checkOutTime');

  useEffect(() => {
    if (!day || !visible) {
      return;
    }

    const {checkIn, checkOut} = extractDaySessionRecords(day);
    reset({
      date: day.dateKey,
      checkInTime: checkIn ? splitAttendanceDateTime(checkIn.createdAt).time : '',
      checkOutTime: checkOut ? splitAttendanceDateTime(checkOut.createdAt).time : '',
      note: checkIn?.note ?? checkOut?.note ?? '',
    });
  }, [day, reset, visible]);

  const previewSeconds = useMemo(() => {
    if (!dateValue || !checkInTimeValue || !checkOutTimeValue) {
      return null;
    }
    const seconds = computeDaySessionDurationSeconds(dateValue, checkInTimeValue, checkOutTimeValue);
    return seconds > 0 ? seconds : null;
  }, [checkInTimeValue, checkOutTimeValue, dateValue]);

  const handleClearPress = () => {
    if (!onClearDay || saving) {
      return;
    }
    Alert.alert(t('clearAttendanceDay'), t('clearAttendanceDayConfirm'), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          void onClearDay();
        },
      },
    ]);
  };

  return (
    <BottomSheet
      visible={visible && day !== null}
      title={t('editAttendanceDay')}
      onClose={onClose}
      formFields={['date', 'checkInTime', 'checkOutTime', 'note']}
    >
      {day ? (
        <Text style={[styles.dayHint, textStyle, {color: theme.typography.secondary}]}>
          {formatDate(`${day.dateKey}T12:00:00`)}
        </Text>
      ) : null}

      <Text style={[styles.fieldHint, textStyle, {color: theme.typography.secondary}]}>
        {t('editAttendanceDayHint')}
      </Text>

      <Controller
        control={control}
        name="checkInTime"
        render={({field: {onChange, onBlur, value}}) => (
          <AppTimePickerField
            label={t('checkIn')}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            referenceDate={dateValue || day?.dateKey}
            error={errors.checkInTime?.message ? t(errors.checkInTime.message) : undefined}
          />
        )}
      />
      <Controller
        control={control}
        name="checkOutTime"
        render={({field: {onChange, onBlur, value}}) => (
          <AppTimePickerField
            label={t('checkOut')}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            referenceDate={dateValue || day?.dateKey}
            optional
            placeholder={t('checkOutOptional')}
            error={errors.checkOutTime?.message ? t(errors.checkOutTime.message) : undefined}
          />
        )}
      />

      <View style={[styles.previewCard, {backgroundColor: theme.colors.surfaceSecondary}]}>
        <Text style={[styles.previewLabel, textStyle, {color: theme.typography.secondary}]}>
          {t('attendanceDayTotalPreview')}
        </Text>
        <Text style={[styles.previewValue, centeredTextStyle, textStyle, {color: theme.colors.primary}]}>
          {previewSeconds !== null
            ? formatAttendanceDuration(previewSeconds)
            : t('attendanceDayTotalPending')}
        </Text>
      </View>

      <Controller
        control={control}
        name="note"
        render={({field: {onChange, onBlur, value}}) => (
          <AppInput
            fieldKey="note"
            label={t('noteOptional')}
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
          />
        )}
      />

      <AppButton
        label={t('saveChanges')}
        onPress={handleSubmit(onSave)}
        loading={saving}
        disabled={saving}
      />

      {onClearDay ? (
        <AppButton
          label={t('clearAttendanceDay')}
          variant="danger"
          onPress={handleClearPress}
          disabled={saving}
          style={styles.clearBtn}
        />
      ) : null}

      <Pressable onPress={onClose} style={styles.cancel}>
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('cancel')}</Text>
      </Pressable>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  dayHint: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  previewCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  cancel: {
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
  },
  clearBtn: {
    marginTop: 8,
  },
});

export default EditAttendanceDaySheet;
