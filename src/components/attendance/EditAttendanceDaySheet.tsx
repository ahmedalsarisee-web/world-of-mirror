import React, {useEffect, useMemo} from 'react';
import {Alert, Pressable, StyleSheet, Switch, Text, View} from 'react-native';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppDatePickerField from '@app/components/common/AppDatePickerField';
import AppInput from '@app/components/common/AppInput';
import AppTimePickerField from '@app/components/common/AppTimePickerField';
import BottomSheet from '@app/components/common/BottomSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {AttendanceDaySummary} from '@app/utils/attendanceReport';
import {
  computeDaySessionDurationSeconds,
  dayIsAbsent,
  extractAbsentDayRecord,
  extractDaySessionRecords,
  formatAttendanceDuration,
  splitAttendanceDateTime,
} from '@app/utils/attendanceReport';
import {formatDate} from '@app/utils/format';
import {attendanceDayEditSchema, type AttendanceDayEditFormValues} from '@app/utils/validation';
import dayjs from 'dayjs';

interface Props {
  day: AttendanceDaySummary | null;
  visible: boolean;
  mode?: 'edit' | 'add-absent';
  saving?: boolean;
  onClose: () => void;
  onSave: (values: AttendanceDayEditFormValues) => void | Promise<void>;
  onClearDay?: () => void | Promise<void>;
}

const EditAttendanceDaySheet: React.FC<Props> = ({
  day,
  visible,
  mode = 'edit',
  saving = false,
  onClose,
  onSave,
  onClearDay,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, centeredTextStyle, row} = useDirection();
  const isAddAbsent = mode === 'add-absent';
  const {control, handleSubmit, reset, watch, setValue, formState: {errors}} = useForm<AttendanceDayEditFormValues>({
    resolver: zodResolver(attendanceDayEditSchema),
    defaultValues: {
      date: dayjs().format('YYYY-MM-DD'),
      isAbsent: false,
      checkInTime: '',
      checkOutTime: '',
      note: '',
    },
  });

  const dateValue = watch('date');
  const checkInTimeValue = watch('checkInTime');
  const checkOutTimeValue = watch('checkOutTime');
  const isAbsent = watch('isAbsent') || isAddAbsent;

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (isAddAbsent) {
      reset({
        date: dayjs().format('YYYY-MM-DD'),
        isAbsent: true,
        checkInTime: '',
        checkOutTime: '',
        note: t('attendanceAbsentDefaultNote'),
      });
      return;
    }

    if (!day) {
      return;
    }

    const {checkIn, checkOut} = extractDaySessionRecords(day);
    const absentRecord = extractAbsentDayRecord(day);
    const absent = dayIsAbsent(day);
    reset({
      date: day.dateKey,
      isAbsent: absent,
      checkInTime: checkIn ? splitAttendanceDateTime(checkIn.createdAt).time : '',
      checkOutTime: checkOut ? splitAttendanceDateTime(checkOut.createdAt).time : '',
      note: absentRecord?.note ?? checkIn?.note ?? checkOut?.note ?? '',
    });
  }, [day, isAddAbsent, reset, t, visible]);

  const previewSeconds = useMemo(() => {
    if (isAbsent || !dateValue || !checkInTimeValue || !checkOutTimeValue) {
      return null;
    }
    const seconds = computeDaySessionDurationSeconds(dateValue, checkInTimeValue, checkOutTimeValue);
    return seconds > 0 ? seconds : null;
  }, [checkInTimeValue, checkOutTimeValue, dateValue, isAbsent]);

  const handleAbsentToggle = (next: boolean) => {
    setValue('isAbsent', next, {shouldValidate: true});
    if (next && !watch('note')?.trim()) {
      setValue('note', t('attendanceAbsentDefaultNote'));
    }
  };

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

  const title = isAddAbsent ? t('addAbsentDay') : t('editAttendanceDay');

  return (
    <BottomSheet
      visible={visible && (isAddAbsent || day !== null)}
      title={title}
      onClose={onClose}
      formFields={isAbsent ? ['date', 'note'] : ['date', 'checkInTime', 'checkOutTime', 'note']}
    >
      {isAddAbsent ? (
        <Controller
          control={control}
          name="date"
          render={({field: {onChange, onBlur, value}}) => (
            <AppDatePickerField
              label={t('attendanceAbsentDate')}
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              maximumDate={dayjs().endOf('day').toDate()}
              error={errors.date?.message ? t(errors.date.message) : undefined}
            />
          )}
        />
      ) : day ? (
        <Text style={[styles.dayHint, textStyle, {color: theme.typography.secondary}]}>
          {formatDate(`${day.dateKey}T12:00:00`)}
        </Text>
      ) : null}

      {!isAddAbsent ? (
        <View style={[styles.absentRow, {flexDirection: row}]}>
          <Text style={[styles.absentLabel, textStyle, {color: theme.typography.primary}]}>
            {t('markAttendanceAbsent')}
          </Text>
          <Switch
            value={Boolean(isAbsent)}
            onValueChange={handleAbsentToggle}
            trackColor={{false: theme.colors.inputBorder, true: theme.colors.primaryLight}}
            thumbColor={isAbsent ? theme.colors.primary : theme.colors.surface}
          />
        </View>
      ) : null}

      {isAbsent ? (
        <Text style={[styles.fieldHint, textStyle, {color: theme.typography.secondary}]}>
          {t('attendanceAbsentDayHint')}
        </Text>
      ) : (
        <Text style={[styles.fieldHint, textStyle, {color: theme.typography.secondary}]}>
          {t('editAttendanceDayHint')}
        </Text>
      )}

      {!isAbsent ? (
        <>
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
        </>
      ) : null}

      <Controller
        control={control}
        name="note"
        render={({field: {onChange, onBlur, value}}) => (
          <AppInput
            fieldKey="note"
            label={isAbsent ? t('attendanceAbsentNote') : t('noteOptional')}
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            multiline
            error={errors.note?.message ? t(errors.note.message) : undefined}
          />
        )}
      />

      <AppButton
        label={t('saveChanges')}
        onPress={handleSubmit(onSave)}
        loading={saving}
        disabled={saving}
      />

      {onClearDay && !isAddAbsent ? (
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
  absentRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  absentLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
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
