import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AmountText from '@app/components/common/AmountText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {Transaction} from '@app/types/models';
import {formatDate, formatTime} from '@app/utils/format';
import {shouldShowEditableWindowBadge, shouldShowPinnedBadge} from '@app/utils/financePermissions';
import {getTransactionTypeLabel, isAdvanceTransactionType, isCustomLedgerTransactionType} from '@app/utils/transactionLabels';

const ADVANCE_BLUE = '#2563EB';

interface Props {
  transaction: Transaction;
  canEdit?: boolean;
  now?: number;
  invertAmountColors?: boolean;
  accentColor?: string;
  onPress?: () => void;
  style?: import('react-native').ViewStyle;
}

const FinanceTransactionRow: React.FC<Props> = ({
  transaction,
  canEdit = false,
  now = Date.now(),
  invertAmountColors = false,
  accentColor,
  onPress,
  style,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, alignEnd} = useDirection();
  const editWindowActive = shouldShowEditableWindowBadge(transaction, now);
  const isLockedPinned = shouldShowPinnedBadge(transaction, now);
  const isLedgerType = isCustomLedgerTransactionType(transaction.type);
  const rowAccent = accentColor ?? (isLedgerType ? theme.colors.primary : ADVANCE_BLUE);

  const borderColor = useMemo(() => {
    if (transaction.type === 'advance_repayment' || transaction.type === 'ledger_credit') {
      return theme.components.transactionCard.positiveBorder;
    }
    if (transaction.type === 'advance' || transaction.type === 'ledger_debit') {
      return isLedgerType ? rowAccent : ADVANCE_BLUE;
    }
    return transaction.amount >= 0
      ? theme.components.transactionCard.positiveBorder
      : theme.components.transactionCard.negativeBorder;
  }, [isLedgerType, rowAccent, theme, transaction.amount, transaction.type]);

  const typeColor = useMemo(() => {
    if (transaction.type === 'advance_repayment' || transaction.type === 'ledger_credit') {
      return theme.colors.success;
    }
    if (transaction.type === 'advance' || transaction.type === 'ledger_debit') {
      return isLedgerType ? rowAccent : ADVANCE_BLUE;
    }
    return undefined;
  }, [isLedgerType, rowAccent, theme, transaction.type]);

  const content = (
    <>
      <View style={{flex: 1}}>
        <View style={[styles.metaRow, {flexDirection: row}]}>
          {isAdvanceTransactionType(transaction.type) || isLedgerType ? (
            <Text style={[styles.txType, textStyle, typeColor ? {color: typeColor} : undefined]}>
              {getTransactionTypeLabel(transaction.type, t)}
            </Text>
          ) : null}
          {editWindowActive ? (
            <View style={[styles.pinBadge, {flexDirection: row, backgroundColor: `${theme.colors.primary}18`}]}>
              <MaterialCommunityIcons name="clock-outline" size={11} color={theme.colors.primary} />
              <Text style={[styles.pinText, textStyle, {color: theme.colors.primary}]}>
                {t('transactionEditableWindow')}
              </Text>
            </View>
          ) : null}
          {isLockedPinned ? (
            <View style={[styles.pinBadge, {flexDirection: row, backgroundColor: theme.colors.surfaceSecondary}]}>
              <MaterialCommunityIcons name="pin" size={11} color={theme.typography.secondary} />
              <Text style={[styles.pinText, textStyle, {color: theme.typography.secondary}]}>
                {t('transactionPinned')}
              </Text>
            </View>
          ) : null}
        </View>
        <AmountText
          amount={transaction.amount}
          size="sm"
          currencyLabel={t('currencyLabel')}
          invertSignColors={invertAmountColors}
        />
        {transaction.note ? (
          <Text style={[styles.note, textStyle, {color: theme.typography.secondary}]}>{transaction.note}</Text>
        ) : null}
      </View>
      <View style={[styles.trailingCol, {alignItems: alignEnd}]}>
        {canEdit ? (
          <MaterialCommunityIcons
            name="pencil-outline"
            size={16}
            color={theme.colors.primary}
            style={styles.editIcon}
          />
        ) : null}
        <Text style={[styles.date, textStyle, {color: theme.typography.secondary}]}>
          {formatDate(transaction.createdAt)}
        </Text>
        <Text style={[styles.date, textStyle, {color: theme.typography.secondary}]}>
          {formatTime(transaction.createdAt)}
        </Text>
      </View>
    </>
  );

  if (!canEdit || !onPress) {
    return (
      <View
        style={[
          styles.txRow,
          {
            flexDirection: row,
            borderColor: theme.colors.divider,
            borderStartWidth: 3,
            borderStartColor: borderColor,
          },
          style,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.txRow,
        {
          flexDirection: row,
          borderColor: theme.colors.divider,
          borderStartWidth: 3,
          borderStartColor: borderColor,
          opacity: pressed ? 0.72 : 1,
        },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  txRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  metaRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  txType: {
    fontSize: 12,
    fontWeight: '600',
  },
  pinBadge: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pinText: {
    fontSize: 10,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    marginTop: 2,
  },
  trailingCol: {
    minWidth: 72,
  },
  editIcon: {
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
  },
});

export default React.memo(FinanceTransactionRow);
