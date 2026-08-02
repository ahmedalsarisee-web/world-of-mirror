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
  onClose: () => void;
  onSave: (note: string) => void | Promise<void>;
}

const OrderCardNoteSheet: React.FC<Props> = ({
  visible,
  initialNote = '',
  saving = false,
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
  }, [visible]);

  const handleSave = () => {
    const trimmed = note.trim();
    if (!trimmed) {
      setError(t('mirrorOrdersCardNoteRequired'));
      return;
    }
    void onSave(trimmed);
  };

  const handleClear = () => {
    void onSave('');
  };

  return (
    <BottomSheet
      visible={visible}
      title={t('mirrorOrdersCardNoteTitle')}
      onClose={onClose}
      keyboardInsetMode="scroll"
    >
      <Text style={[textStyle, {color: theme.typography.secondary, marginBottom: 12}]}>
        {t('mirrorOrdersCardNoteHint')}
      </Text>
      <AppInput
        label={t('mirrorOrdersCardNoteLabel')}
        value={note}
        onChangeText={(value) => {
          setNote(value);
          if (error) {
            setError(null);
          }
        }}
        placeholder={t('mirrorOrdersCardNotePlaceholder')}
        multiline
        numberOfLines={4}
        error={error ?? undefined}
      />
      <AppButton
        label={t('mirrorOrdersCardNoteSave')}
        onPress={handleSave}
        loading={saving}
        disabled={saving}
      />
      {initialNote.trim() ? (
        <AppButton
          label={t('mirrorOrdersCardNoteClear')}
          variant="outline"
          onPress={handleClear}
          disabled={saving}
        />
      ) : null}
    </BottomSheet>
  );
};

export default React.memo(OrderCardNoteSheet);
