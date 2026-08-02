import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AmountText from '@app/components/common/AmountText';
import BottomSheet from '@app/components/common/BottomSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {formatCurrency} from '@app/utils/format';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {
  resolveInvoiceExtraLineTotal,
  sumInvoiceExportExtraLines,
} from '@app/types/invoiceExportExtraLine';

interface Props {
  order: MirrorPricingConfirmedOrder | null;
  onClose: () => void;
}

const OrderInvoiceDetailsSheet: React.FC<Props> = ({order, onClose}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, layoutStyle} = useDirection();

  const lines = order?.invoiceExtraLines ?? [];
  const subtotal = useMemo(() => sumInvoiceExportExtraLines(lines), [lines]);
  const invoiceNote = order?.invoiceNote?.trim();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {gap: theme.spacing.sm},
        lineRow: {
          flexDirection: row,
          alignItems: 'flex-start',
          gap: theme.spacing.sm,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
          width: '100%',
          maxWidth: '100%',
        },
        lineMain: {flex: 1, minWidth: 0, flexShrink: 1, gap: 2},
        lineAmountWrap: {flexShrink: 0, maxWidth: '38%'},
        lineTitle: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
        lineMeta: {
          fontSize: theme.typographyScale.size.xs,
        },
        noteBox: {
          gap: 4,
          padding: theme.spacing.sm,
          borderRadius: theme.components.input.radius,
          borderWidth: 1,
          borderColor: theme.colors.divider,
          backgroundColor: theme.colors.surfaceSecondary,
        },
        noteLabel: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          opacity: 0.75,
        },
        noteText: {
          fontSize: theme.typographyScale.size.sm,
          lineHeight: 20,
        },
        subtotalRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingTop: theme.spacing.sm,
          marginTop: theme.spacing.xs,
          borderTopWidth: 1,
          borderTopColor: theme.colors.divider,
          width: '100%',
          maxWidth: '100%',
        },
        subtotalLabel: {
          flex: 1,
          minWidth: 0,
          flexShrink: 1,
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        subtotalAmountWrap: {
          flexShrink: 0,
          maxWidth: '42%',
        },
      }),
    [row, theme],
  );

  return (
    <BottomSheet
      visible={order !== null}
      title={t('orderInvoiceDetailsChipLabel')}
      onClose={onClose}
      showsScrollIndicator
    >
      <View style={styles.root}>
        {lines.map((line, index) => {
          const lineTotal = resolveInvoiceExtraLineTotal(line);
          return (
            <View
              key={`${index}-${line.specification}`}
              style={[
                styles.lineRow,
                layoutStyle,
                index === lines.length - 1 && !invoiceNote ? {borderBottomWidth: 0} : null,
              ]}
            >
              <View style={styles.lineMain}>
                <Text style={[styles.lineTitle, inlineTextStyle, {color: theme.typography.primary}]}>
                  {line.specification}
                </Text>
                <Text style={[styles.lineMeta, inlineTextStyle, {color: theme.typography.secondary}]}>
                  {t('quantity')}: {line.quantity} · {t('mirrorInvoiceExtraItemsUnitPriceLabel')}:{' '}
                  {formatCurrency(line.unitPrice, t('currencyLabel'))}
                </Text>
              </View>
              <View style={styles.lineAmountWrap}>
                <AmountText amount={lineTotal} size="sm" currencyLabel={t('currencyLabel')} />
              </View>
            </View>
          );
        })}

        {invoiceNote ? (
          <View style={styles.noteBox}>
            <Text style={[styles.noteLabel, textStyle, {color: theme.typography.secondary}]}>
              {t('mirrorInvoiceExtraItemsNoteLabel')}
            </Text>
            <Text style={[styles.noteText, inlineTextStyle, {color: theme.typography.primary}]}>
              {invoiceNote}
            </Text>
          </View>
        ) : null}

        <View style={[styles.subtotalRow, layoutStyle]}>
          <Text
            style={[styles.subtotalLabel, textStyle, {color: theme.typography.primary}]}
            numberOfLines={2}
          >
            {t('mirrorInvoiceExtraItemsSubtotal')}
          </Text>
          <View style={styles.subtotalAmountWrap}>
            <AmountText amount={subtotal} size="md" currencyLabel={t('currencyLabel')} />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default OrderInvoiceDetailsSheet;
