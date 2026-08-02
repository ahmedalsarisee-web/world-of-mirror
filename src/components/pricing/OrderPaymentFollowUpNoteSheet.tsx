import React, {useEffect, useState} from 'react';
import {Text} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import BottomSheet from '@app/components/common/BottomSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  visible: boolean;
  initialNote?: string;
  saving?: boolean;
  saveLabel?: string;
  onClose: () => void;
  onSave: (note: string) => void | Promise<void>;
}

const OrderPaymentFollowUpNoteSheet: React.FC<Props> = ({
  visible,
  initialNote = '',
  saving = false,
  saveLabel,
  onClose,
  onSave,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setNote(initialNote);
    setError(null);
  }, [initialNote, visible]);

  const handleSave = () => {
    const trimmed = note.trim();
    if (!trimmed) {
      setError(t('mirrorOrdersPaymentFollowUpNoteRequired'));
      return;
    }
    void onSave(trimmed);
  };

  return (
    <BottomSheet
      visible={visible}
      title={t('mirrorOrdersPaymentFollowUpNoteTitle')}
      onClose={onClose}
      formFields={['paymentFollowUpNote']}
    >
      <Text style={[textStyle, {color: theme.typography.secondary, marginBottom: 12}]}>
        {t('mirrorOrdersPaymentFollowUpNoteHint')}
      </Text>
      <AppInput
        fieldKey="paymentFollowUpNote"
        label={t('mirrorOrdersPaymentFollowUpNoteLabel')}
        value={note}
        onChangeText={(value) => {
          setNote(value);
          if (error) {
            setError(null);
          }
        }}
        placeholder={t('mirrorOrdersPaymentFollowUpNotePlaceholder')}
        multiline
        autoGrow
        error={error ?? undefined}
      />
      <AppButton
        label={saveLabel ?? t('mirrorOrdersPaymentFollowUpNoteSave')}
        onPress={handleSave}
        loading={saving}
        disabled={saving}
      />
    </BottomSheet>
  );
};

export default OrderPaymentFollowUpNoteSheet;
