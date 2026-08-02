import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AppInput from '@app/components/common/AppInput';
import AmountText from '@app/components/common/AmountText';
import InvoiceExtraItemsEditor, {
  createInitialInvoiceExtraItemRows,
} from '@app/components/pricing/InvoiceExtraItemsEditor';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {
  normalizeInvoiceExportExtraLines,
  sumInvoiceExtraLineDrafts,
  type InvoiceExportExtraLineDraft,
} from '@app/types/invoiceExportExtraLine';

interface Props {
  rows: InvoiceExportExtraLineDraft[];
  onChangeRows: (rows: InvoiceExportExtraLineDraft[]) => void;
  invoiceNote: string;
  onInvoiceNoteChange: (value: string) => void;
  disabled?: boolean;
}

const AddOrderInvoiceDetailsSection: React.FC<Props> = ({
  rows,
  onChangeRows,
  invoiceNote,
  onInvoiceNoteChange,
  disabled = false,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, chevronForward, layoutStyle} = useDirection();
  const [expanded, setExpanded] = useState(false);

  const subtotal = useMemo(() => sumInvoiceExtraLineDrafts(rows), [rows]);
  const filledItemCount = useMemo(() => normalizeInvoiceExportExtraLines(rows).length, [rows]);

  const toggleLabel = useMemo(() => {
    if (filledItemCount > 0) {
      return t('addOrderInvoiceDetailsWithCount', {count: filledItemCount});
    }
    return t('addOrderInvoiceDetailsTitle');
  }, [filledItemCount, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          marginTop: theme.spacing.xs,
        },
        card: {
          borderRadius: theme.components.input.radius,
          borderWidth: 1,
          overflow: 'hidden',
        },
        pickerRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          minHeight: 48,
        },
        pickerIconWrap: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        pickerValue: {
          flex: 1,
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
        expandedBody: {
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          borderTopWidth: 1,
          width: '100%',
          maxWidth: '100%',
        },
        hint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
          paddingTop: theme.spacing.xs,
        },
        subtotalRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.xs,
          paddingTop: theme.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: theme.colors.inputBorder,
          width: '100%',
          maxWidth: '100%',
        },
        subtotalLabel: {
          flex: 1,
          minWidth: 0,
          flexShrink: 1,
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
        subtotalAmountWrap: {
          flexShrink: 0,
          maxWidth: '42%',
        },
      }),
    [row, theme],
  );

  const cardColors = {
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.inputBackground,
  };

  return (
    <View style={styles.section}>
      <View style={[styles.card, cardColors]}>
        <Pressable
          style={({pressed}) => [styles.pickerRow, {opacity: pressed || disabled ? 0.88 : 1}]}
          onPress={() => setExpanded((current) => !current)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{expanded}}
          accessibilityLabel={toggleLabel}
        >
          <View style={[styles.pickerIconWrap, {backgroundColor: theme.colors.surfaceSecondary}]}>
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={18}
              color={theme.colors.primary}
            />
          </View>
          <Text style={[styles.pickerValue, textStyle, {color: theme.typography.primary}]} numberOfLines={2}>
            {toggleLabel}
          </Text>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : chevronForward}
            size={18}
            color={theme.colors.icon}
          />
        </Pressable>

        {expanded ? (
          <View style={[styles.expandedBody, {borderTopColor: theme.colors.inputBorder}]}>
            <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
              {t('mirrorInvoiceExtraItemsHint')}
            </Text>

            <InvoiceExtraItemsEditor rows={rows} onChangeRows={onChangeRows} disabled={disabled} />

            <AppInput
              compact
              label={t('mirrorInvoiceExtraItemsNoteLabel')}
              value={invoiceNote}
              onChangeText={onInvoiceNoteChange}
              placeholder={t('mirrorInvoiceExtraItemsNotePlaceholder')}
              multiline
              autoGrow
              disabled={disabled}
            />

            {subtotal > 0 ? (
              <View style={[styles.subtotalRow, layoutStyle]}>
                <Text
                  style={[styles.subtotalLabel, textStyle, {color: theme.typography.secondary}]}
                  numberOfLines={2}
                >
                  {t('mirrorInvoiceExtraItemsSubtotal')}
                </Text>
                <View style={styles.subtotalAmountWrap}>
                  <AmountText amount={subtotal} size="sm" currencyLabel={t('currencyLabel')} />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default AddOrderInvoiceDetailsSection;

export {createInitialInvoiceExtraItemRows};
