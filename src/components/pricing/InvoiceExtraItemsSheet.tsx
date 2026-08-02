import React, {useEffect, useMemo, useState} from 'react';
import {Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import AmountText from '@app/components/common/AmountText';
import BottomSheet from '@app/components/common/BottomSheet';
import InvoiceExtraItemsEditor, {
  createInitialInvoiceExtraItemRows,
} from '@app/components/pricing/InvoiceExtraItemsEditor';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {
  normalizeInvoiceExportExtraLines,
  sumInvoiceExtraLineDrafts,
  type InvoiceExportExtraLine,
  type InvoiceExportExtraLineDraft,
} from '@app/types/invoiceExportExtraLine';

interface Props {
  visible: boolean;
  exporting?: boolean;
  onClose: () => void;
  onConfirm: (lines: InvoiceExportExtraLine[], invoiceNote?: string) => void;
}

const InvoiceExtraItemsSheet: React.FC<Props> = ({
  visible,
  exporting = false,
  onClose,
  onConfirm,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const [rows, setRows] = useState<InvoiceExportExtraLineDraft[]>(createInitialInvoiceExtraItemRows);
  const [invoiceNote, setInvoiceNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setRows(createInitialInvoiceExtraItemRows());
    setInvoiceNote('');
    setError(null);
  }, [visible]);

  const subtotal = useMemo(() => sumInvoiceExtraLineDrafts(rows), [rows]);

  const handleConfirm = () => {
    const lines = normalizeInvoiceExportExtraLines(rows);
    if (!lines.length) {
      setError(t('mirrorInvoiceExtraItemsRequired'));
      return;
    }
    onConfirm(lines, invoiceNote.trim() || undefined);
  };

  return (
    <BottomSheet
      visible={visible}
      title={t('mirrorInvoiceAddItemsTitle')}
      onClose={onClose}
      showsScrollIndicator
      keyboardInsetMode="scroll"
    >
      <Text style={[textStyle, {color: theme.typography.secondary, marginBottom: 12, lineHeight: 20}]}>
        {t('mirrorInvoiceExtraItemsHint')}
      </Text>

      <InvoiceExtraItemsEditor rows={rows} onChangeRows={setRows} disabled={exporting} />

      <AppInput
        label={t('mirrorInvoiceExtraItemsNoteLabel')}
        value={invoiceNote}
        onChangeText={setInvoiceNote}
        placeholder={t('mirrorInvoiceExtraItemsNotePlaceholder')}
        multiline
        numberOfLines={3}
        autoGrow
        disabled={exporting}
        containerStyle={{marginTop: 12}}
      />

      {error ? (
        <Text style={[textStyle, {color: theme.colors.error, marginTop: 8}]}>{error}</Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 16,
          marginBottom: 8,
        }}
      >
        <Text style={[textStyle, {color: theme.typography.secondary, fontWeight: '600'}]}>
          {t('mirrorInvoiceExtraItemsSubtotal')}
        </Text>
        <AmountText amount={subtotal} size="md" currencyLabel={t('currencyLabel')} />
      </View>

      <AppButton
        label={t('mirrorInvoiceExtraItemsConfirm')}
        onPress={handleConfirm}
        loading={exporting}
        disabled={exporting}
      />
    </BottomSheet>
  );
};

export default InvoiceExtraItemsSheet;
