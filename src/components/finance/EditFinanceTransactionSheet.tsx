import React, {useEffect} from 'react';
import {Alert, Pressable, StyleSheet, Text} from 'react-native';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import BottomSheet from '@app/components/common/BottomSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {Transaction} from '@app/types/models';
import {getTransactionTypeLabel} from '@app/utils/transactionLabels';
import {transactionSchema, type TransactionFormValues} from '@app/utils/validation';

interface Props {
  transaction: Transaction | null;
  visible: boolean;
  saving?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onSave: (values: TransactionFormValues) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

const EditFinanceTransactionSheet: React.FC<Props> = ({
  transaction,
  visible,
  saving = false,
  canDelete = false,
  onClose,
  onSave,
  onDelete,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const {control, handleSubmit, reset, formState: {errors}} = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {amount: 0, note: ''},
  });

  useEffect(() => {
    if (!transaction || !visible) {
      return;
    }
    reset({
      amount: Math.abs(transaction.amount),
      note: transaction.note ?? '',
    });
  }, [reset, transaction, visible]);

  const handleDeletePress = () => {
    if (!onDelete || saving) {
      return;
    }
    Alert.alert(t('deleteTransaction'), t('deleteTransactionConfirm'), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          void onDelete();
        },
      },
    ]);
  };

  return (
    <BottomSheet
      visible={visible && transaction !== null}
      title={t('editTransaction')}
      onClose={onClose}
      formFields={['amount', 'note']}
    >
      {transaction ? (
        <Text style={[styles.typeHint, textStyle, {color: theme.typography.secondary}]}>
          {getTransactionTypeLabel(transaction.type, t)}
        </Text>
      ) : null}
      <Controller
        control={control}
        name="amount"
        render={({field: {onChange, onBlur, value}}) => (
          <AppInput
            fieldKey="amount"
            label={t('amount')}
            numeric
            value={value}
            onNumberChange={onChange}
            onBlur={onBlur}
            error={errors.amount?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="note"
        render={({field: {onChange, onBlur, value}}) => (
          <AppInput
            fieldKey="note"
            label={t('noteOptional')}
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
          />
        )}
      />
      <AppButton
        label={t('saveChanges')}
        onPress={handleSubmit(onSave)}
        loading={saving}
        disabled={saving}
      />
      {canDelete && onDelete ? (
        <AppButton
          label={t('deleteTransaction')}
          variant="danger"
          onPress={handleDeletePress}
          disabled={saving}
          style={styles.deleteBtn}
        />
      ) : null}
      <Pressable onPress={onClose} style={styles.cancel}>
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('cancel')}</Text>
      </Pressable>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  typeHint: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  cancel: {
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
  },
  deleteBtn: {
    marginTop: 8,
  },
});

export default EditFinanceTransactionSheet;
