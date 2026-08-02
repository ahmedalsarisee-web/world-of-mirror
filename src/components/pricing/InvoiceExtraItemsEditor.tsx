import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {
  createEmptyInvoiceExtraLineDraft,
  type InvoiceExportExtraLineDraft,
} from '@app/types/invoiceExportExtraLine';

interface Props {
  rows: InvoiceExportExtraLineDraft[];
  onChangeRows: (rows: InvoiceExportExtraLineDraft[]) => void;
  disabled?: boolean;
}

function createInvoiceExtraRowId(): string {
  return createEmptyInvoiceExtraLineDraft(`extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).id;
}

const InvoiceExtraItemsEditor: React.FC<Props> = ({rows, onChangeRows, disabled = false}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle} = useDirection();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {gap: theme.spacing.sm, width: '100%', maxWidth: '100%'},
        headerRow: {
          flexDirection: row,
          alignItems: 'flex-end',
          gap: theme.spacing.xs,
          paddingHorizontal: 2,
        },
        headerSpec: {flex: 1.6, minWidth: 0},
        headerQty: {width: 52, flexShrink: 0},
        headerPrice: {width: 76, flexShrink: 0},
        headerRemove: {width: 36},
        headerLabel: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          opacity: 0.7,
        },
        row: {
          flexDirection: row,
          alignItems: 'flex-start',
          gap: theme.spacing.xs,
          width: '100%',
          maxWidth: '100%',
        },
        colSpec: {flex: 1.6, minWidth: 0},
        colQty: {width: 52, flexShrink: 0},
        colPrice: {width: 76, flexShrink: 0},
        removeButton: {
          width: 36,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 18,
        },
        inputDense: {minHeight: 40, paddingVertical: 8},
      }),
    [row, theme],
  );

  const updateRow = (id: string, patch: Partial<InvoiceExportExtraLineDraft>) => {
    onChangeRows(rows.map((entry) => (entry.id === id ? {...entry, ...patch} : entry)));
  };

  const removeRow = (id: string) => {
    const next = rows.filter((entry) => entry.id !== id);
    onChangeRows(next.length > 0 ? next : [createEmptyInvoiceExtraLineDraft(createInvoiceExtraRowId())]);
  };

  const addRow = () => {
    onChangeRows([...rows, createEmptyInvoiceExtraLineDraft(createInvoiceExtraRowId())]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.headerRow, layoutStyle]}>
        <View style={styles.headerSpec}>
          <Text style={[styles.headerLabel, textStyle, {color: theme.typography.secondary}]}>
            {t('mirrorInvoiceExtraItemsSpecLabel')}
          </Text>
        </View>
        <View style={styles.headerQty}>
          <Text style={[styles.headerLabel, textStyle, {color: theme.typography.secondary}]}>
            {t('quantity')}
          </Text>
        </View>
        <View style={styles.headerPrice}>
          <Text style={[styles.headerLabel, textStyle, {color: theme.typography.secondary}]}>
            {t('mirrorInvoiceExtraItemsUnitPriceLabel')}
          </Text>
        </View>
        <View style={styles.headerRemove} />
      </View>

      {rows.map((entry, index) => (
        <View key={entry.id} style={[styles.row, layoutStyle]}>
          <View style={styles.colSpec}>
            <AppInput
              compact
              label={index === 0 ? t('mirrorInvoiceExtraItemsSpecLabel') : ' '}
              value={entry.specification}
              onChangeText={(value) => updateRow(entry.id, {specification: value})}
              placeholder={t('mirrorInvoiceExtraItemsSpecPlaceholder')}
              disabled={disabled}
              style={styles.inputDense}
            />
          </View>
          <View style={styles.colQty}>
            <AppInput
              compact
              label={index === 0 ? t('quantity') : ' '}
              numeric
              preserveZero
              value={entry.quantity}
              onNumberChange={(value) =>
                updateRow(entry.id, {quantity: Math.max(1, Math.round(value))})
              }
              keyboardType="number-pad"
              disabled={disabled}
              style={styles.inputDense}
            />
          </View>
          <View style={styles.colPrice}>
            <AppInput
              compact
              label={index === 0 ? t('mirrorInvoiceExtraItemsUnitPriceLabel') : ' '}
              numeric
              preserveZero
              value={entry.unitPrice}
              onNumberChange={(value) => updateRow(entry.id, {unitPrice: Math.max(0, value)})}
              keyboardType="numeric"
              disabled={disabled}
              style={styles.inputDense}
            />
          </View>
          <Pressable
            style={({pressed}) => [styles.removeButton, {opacity: pressed ? 0.6 : 1}]}
            onPress={() => removeRow(entry.id)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('mirrorInvoiceExtraItemsRemove', {index: index + 1})}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={theme.colors.error} />
          </Pressable>
        </View>
      ))}

      <AppButton
        label={t('mirrorInvoiceExtraItemsAddRow')}
        onPress={addRow}
        disabled={disabled}
        variant="outline"
      />
    </View>
  );
};

export default InvoiceExtraItemsEditor;

export function createInitialInvoiceExtraItemRows(): InvoiceExportExtraLineDraft[] {
  return [createEmptyInvoiceExtraLineDraft(createInvoiceExtraRowId())];
}
