import React, {useMemo, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import DateTimePicker, {type DateTimePickerEvent} from '@react-native-community/datetimepicker';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import dayjs from 'dayjs';
import {useTranslation} from 'react-i18next';
import AppInput from '@app/components/common/AppInput';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {formatDate} from '@app/utils/format';

interface Props {
  label: string;
  value: string;
  onChange: (dateKey: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
}

function resolvePickerDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return dayjs(`${value}T12:00:00`).toDate();
  }
  return dayjs().startOf('day').toDate();
}

function dateToValue(date: Date): string {
  return dayjs(date).format('YYYY-MM-DD');
}

const AppDatePickerField: React.FC<Props> = ({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  maximumDate,
  minimumDate,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, ltrTextStyle, appFont} = useDirection();
  const [open, setOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => resolvePickerDate(value));

  const displayValue = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }
    return formatDate(`${value}T12:00:00`);
  }, [value]);

  const openPicker = () => {
    setPickerDate(resolvePickerDate(value));
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
    onChange(dateToValue(selectedDate));
  };

  if (Platform.OS === 'web') {
    return (
      <AppInput
        label={label}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder="YYYY-MM-DD"
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
        <MaterialCommunityIcons name="calendar-outline" size={20} color={theme.colors.primary} />
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
          {displayValue ?? placeholder ?? t('selectDate')}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={theme.colors.icon} />
      </Pressable>

      {open && Platform.OS === 'ios' ? (
        <View style={[styles.iosPickerWrap, {backgroundColor: theme.colors.inputBackground}]}>
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="spinner"
            maximumDate={maximumDate}
            minimumDate={minimumDate}
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
          mode="date"
          display="calendar"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
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
  value: {fontSize: 16},
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

export default AppDatePickerField;
