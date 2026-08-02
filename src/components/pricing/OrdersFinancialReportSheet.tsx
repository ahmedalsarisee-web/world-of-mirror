import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import BottomSheet from '@app/components/common/BottomSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  visible: boolean;
  saving?: boolean;
  onClose: () => void;
  onExport: () => void | Promise<void>;
}

const OrdersFinancialReportSheet: React.FC<Props> = ({visible, saving = false, onClose, onExport}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();

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

  return (
    <BottomSheet
      visible={visible}
      title={t('ordersFinancialReportSheetTitle')}
      onClose={onClose}
    >
      <View style={styles.sheet}>
        <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
          {t('ordersFinancialReportSheetHint')}
        </Text>

        <AppButton
          label={t('ordersFinancialReportExportButton')}
          onPress={() => {
            void onExport();
          }}
          loading={saving}
          disabled={saving}
        />
        <AppButton label={t('cancel')} variant="outline" onPress={onClose} disabled={saving} />
      </View>
    </BottomSheet>
  );
};

export default OrdersFinancialReportSheet;
