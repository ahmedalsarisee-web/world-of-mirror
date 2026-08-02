import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {useTranslation} from 'react-i18next';
import {z} from 'zod';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import BottomSheet from '@app/components/common/BottomSheet';
import FinanceLedgerVisibilityPicker from '@app/components/finance/FinanceLedgerVisibilityPicker';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {AppUser} from '@app/types/models';

const ledgerNameSchema = z.object({
  name: z.string().trim().min(1, 'financeLedgerNameRequired'),
});

type LedgerNameFormValues = z.infer<typeof ledgerNameSchema>;

interface Props {
  visible: boolean;
  mode: 'add' | 'rename';
  initialName?: string;
  saving?: boolean;
  visibilityUsers?: AppUser[];
  showVisibilityPicker?: boolean;
  onClose: () => void;
  onSave: (name: string, visibleToUserIds?: string[]) => void | Promise<void>;
}

const AddFinanceLedgerSheet: React.FC<Props> = ({
  visible,
  mode,
  initialName = '',
  saving = false,
  visibilityUsers = [],
  showVisibilityPicker = true,
  onClose,
  onSave,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const [selectedViewerIds, setSelectedViewerIds] = useState<string[]>([]);
  const {control, handleSubmit, reset, formState: {errors}} = useForm<LedgerNameFormValues>({
    resolver: zodResolver(ledgerNameSchema),
    defaultValues: {name: initialName},
  });

  useEffect(() => {
    if (visible) {
      reset({name: initialName});
      setSelectedViewerIds([]);
    }
  }, [initialName, reset, visible]);

  const title = mode === 'add' ? t('addFinanceLedger') : t('renameFinanceLedger');

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} formFields={['name']}>
      <Controller
        control={control}
        name="name"
        render={({field: {onChange, onBlur, value}}) => (
          <AppInput
            fieldKey="name"
            label={t('financeLedgerName')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.name?.message ? t('financeLedgerNameRequired') : undefined}
            autoFocus
          />
        )}
      />
      {mode === 'add' && showVisibilityPicker ? (
        <FinanceLedgerVisibilityPicker
          users={visibilityUsers}
          selectedIds={selectedViewerIds}
          onChange={setSelectedViewerIds}
        />
      ) : null}
      <AppButton
        label={t('saveChanges')}
        onPress={handleSubmit((values) =>
          onSave(values.name.trim(), mode === 'add' ? selectedViewerIds : undefined),
        )}
        loading={saving}
        disabled={saving}
      />
      <Pressable onPress={onClose} style={styles.cancel}>
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('cancel')}</Text>
      </Pressable>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  cancel: {alignItems: 'center', marginTop: 12, padding: 12},
});

export default AddFinanceLedgerSheet;
