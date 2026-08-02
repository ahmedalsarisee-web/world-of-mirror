import React, {useEffect} from 'react';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {useTranslation} from 'react-i18next';
import {z} from 'zod';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import BottomSheet from '@app/components/common/BottomSheet';

const cardFormSchema = z.object({
  name: z.string().trim().min(1, 'ordersHomeCardNameRequired'),
});

type CardFormValues = z.infer<typeof cardFormSchema>;

interface Props {
  visible: boolean;
  mode: 'add' | 'rename';
  initialName?: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (values: {name: string}) => void | Promise<void>;
}

const EditOrdersHomeCardSheet: React.FC<Props> = ({
  visible,
  mode,
  initialName = '',
  saving = false,
  onClose,
  onSave,
}) => {
  const {t} = useTranslation();
  const {control, handleSubmit, reset, formState: {errors}} = useForm<CardFormValues>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: {name: initialName},
  });

  useEffect(() => {
    if (visible) {
      reset({name: initialName});
    }
  }, [initialName, reset, visible]);

  const title = mode === 'add' ? t('addOrdersHomeCard') : t('renameOrdersHomeCard');

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} formFields={['name']}>
      <Controller
        control={control}
        name="name"
        render={({field: {onChange, onBlur, value}}) => (
          <AppInput
            fieldKey="name"
            label={t('ordersHomeCardName')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.name?.message ? t('ordersHomeCardNameRequired') : undefined}
            autoFocus
          />
        )}
      />
      <AppButton
        label={t('save')}
        onPress={handleSubmit((values) => onSave(values))}
        loading={saving}
      />
    </BottomSheet>
  );
};

export default EditOrdersHomeCardSheet;
