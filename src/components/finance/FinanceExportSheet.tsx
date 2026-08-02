import React, {useEffect, useMemo, useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import dayjs from 'dayjs';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppDatePickerField from '@app/components/common/AppDatePickerField';
import BottomSheet from '@app/components/common/BottomSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  visible: boolean;
  saving?: boolean;
  onClose: () => void;
  onExport: (startDate: string, endDate: string) => void | Promise<void>;
}

const FinanceExportSheet: React.FC<Props> = ({visible, saving = false, onClose, onExport}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const todayKey = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const monthStartKey = useMemo(() => dayjs().startOf('month').format('YYYY-MM-DD'), []);

  const [startDate, setStartDate] = useState(monthStartKey);
  const [endDate, setEndDate] = useState(todayKey);
  const [rangeError, setRangeError] = useState<string | undefined>();

  useEffect(() => {
    if (!visible) {
      return;
    }
    setStartDate(monthStartKey);
    setEndDate(todayKey);
    setRangeError(undefined);
  }, [monthStartKey, todayKey, visible]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        sheet: {gap: theme.spacing.md, paddingBottom: theme.spacing.sm},
        hint: {
          fontSize: theme.typographyScale.size.sm,
          lineHeight: 20,
        },
      }),
    [theme],
  );

  const validateRange = (): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      setRangeError(t('financeExportInvalidRange'));
      return false;
    }
    if (dayjs(startDate).isAfter(dayjs(endDate), 'day')) {
      setRangeError(t('financeExportInvalidRange'));
      return false;
    }
    setRangeError(undefined);
    return true;
  };

  const handleExport = () => {
    if (!validateRange()) {
      Alert.alert(t('error'), t('financeExportInvalidRange'));
      return;
    }
    void onExport(startDate, endDate);
  };

  return (
    <BottomSheet
      visible={visible}
      title={t('financeExportSheetTitle')}
      onClose={onClose}
      formFields={['financeExportStartDate', 'financeExportEndDate']}
    >
      <View style={styles.sheet}>
        <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
          {t('financeExportSheetHint')}
        </Text>

        <AppDatePickerField
          label={t('financeExportStartDate')}
          value={startDate}
          onChange={(value) => {
            setStartDate(value);
            setRangeError(undefined);
          }}
          maximumDate={dayjs(endDate).isValid() ? dayjs(endDate).toDate() : undefined}
        />

        <AppDatePickerField
          label={t('financeExportEndDate')}
          value={endDate}
          onChange={(value) => {
            setEndDate(value);
            setRangeError(undefined);
          }}
          minimumDate={dayjs(startDate).isValid() ? dayjs(startDate).toDate() : undefined}
          maximumDate={dayjs().toDate()}
          error={rangeError}
        />

        <AppButton
          label={t('financeExportExportButton')}
          onPress={handleExport}
          loading={saving}
          disabled={saving}
        />
        <AppButton label={t('cancel')} variant="outline" onPress={onClose} disabled={saving} />
      </View>
    </BottomSheet>
  );
};

export default FinanceExportSheet;
