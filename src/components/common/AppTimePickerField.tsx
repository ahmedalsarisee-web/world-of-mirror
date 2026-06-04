import React, {useMemo, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import dayjs from 'dayjs';
import {useTranslation} from 'react-i18next';
import AppInput from '@app/components/common/AppInput';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {formatTime} from '@app/utils/format';

interface Props {
  label: string;
  value: string;
  onChange: (time: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  referenceDate?: string;
  optional?: boolean;
}

function resolvePickerDate(value: string, referenceDate?: string): Date {
  const base = referenceDate ? dayjs(`${referenceDate}T12:00:00`) : dayjs();
  if (/^\d{2}:\d{2}$/.test(value)) {
    const [hours, minutes] = value.split(':').map(Number);
    return base.hour(hours).minute(minutes).second(0).millisecond(0).toDate();
  }
  return base.hour(9).minute(0).second(0).millisecond(0).toDate();
}

function dateToTimeValue(date: Date): string {
  return dayjs(date).format('HH:mm');
}

const AppTimePickerField: React.FC<Props> = ({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  referenceDate,
  optional = false,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, ltrTextStyle, appFont} = useDirection();
  const [open, setOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => resolvePickerDate(value, referenceDate));

  const displayValue = useMemo(() => {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) {
      return null;
    }
    const iso = referenceDate
      ? dayjs(`${referenceDate}T${value}:00`).toISOString()
      : dayjs().hour(Number(value.slice(0, 2))).minute(Number(value.slice(3, 5))).second(0).toISOString();
    return formatTime(iso);
  }, [referenceDate, value]);

  const openPicker = () => {
    setPickerDate(resolvePickerDate(value, referenceDate));
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
    onBlur?.();
  };

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'dismissed') {
        onBlur?.();
        return;
      }
    }

    if (!selectedDate) {
      return;
    }

    setPickerDate(selectedDate);
    onChange(dateToTimeValue(selectedDate));
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
    onBlur?.();
  };

  if (Platform.OS === 'web') {
    return (
      <AppInput
        label={label}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder="HH:mm"
        autoCapitalize="none"
        error={error}
      />
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text
        style={[styles.label, textStyle, appFont('semibold'), {color: theme.typography.secondary}]}
        numberOfLines={2}
      >
        {label}
      </Text>

      <Pressable
        onPress={openPicker}
        style={[
          styles.field,
          {
            flexDirection: row,
            borderColor: error ? theme.status.error : theme.colors.inputBorder,
            backgroundColor: theme.colors.inputBackground,
            borderRadius: theme.components.input.radius,
            minHeight: theme.components.input.height,
          },
        ]}
      >
        <MaterialCommunityIcons name="clock-outline" size={20} color={theme.colors.primary} />
        <Text
          style={[
            styles.value,
            ltrTextStyle,
            appFont('medium'),
            {
              color: displayValue ? theme.typography.primary : theme.colors.placeholder,
              flex: 1,
            },
          ]}
        >
          {displayValue ?? placeholder ?? t('selectTime')}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={theme.colors.icon} />
      </Pressable>

      {optional && value ? (
        <Pressable onPress={handleClear} style={styles.clearAction}>
          <Text style={[styles.clearText, textStyle, {color: theme.colors.danger}]}>{t('clearTime')}</Text>
        </Pressable>
      ) : null}

      {open && Platform.OS === 'ios' ? (
        <View style={[styles.iosPickerWrap, {backgroundColor: theme.colors.inputBackground}]}>
          <DateTimePicker
            value={pickerDate}
            mode="time"
            display="spinner"
            onChange={handleChange}
          />
          <Pressable onPress={closePicker} style={styles.iosDone}>
            <Text style={[styles.iosDoneText, textStyle, {color: theme.colors.primary}]}>{t('done')}</Text>
          </Pressable>
        </View>
      ) : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="clock"
          is24Hour={false}
          onChange={handleChange}
        />
      ) : null}

      {error ? (
        <Text style={[styles.error, textStyle, {color: theme.status.error}]}>{error}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {marginBottom: 14},
  label: {fontSize: 13, marginBottom: 6},
  field: {
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  value: {
    fontSize: 16,
  },
  clearAction: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 2,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
  },
  iosPickerWrap: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  iosDone: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  iosDoneText: {
    fontSize: 15,
    fontWeight: '700',
  },
  error: {fontSize: 12, marginTop: 4},
});

export default AppTimePickerField;
