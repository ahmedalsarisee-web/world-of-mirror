import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {FinanceCardOverflowButton} from '@app/components/finance/FinanceCardOverflowMenu';
import FinanceListRow from '@app/components/finance/FinanceListRow';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {getFinanceCardFrameStyle} from '@app/utils/financeCardFrame';
import {formatRelativeTime, getNameInitials} from '@app/utils/format';
import {getListCardStyle} from '@shared/theme/themeHelpers';

export interface FinanceCustomLedgerListItem {
  id: string;
  name: string;
  balance: number;
  transactionCount: number;
  lastTransactionAt: string | null;
  accentColor: string;
  ownerName?: string;
  ownerRole?: 'admin' | 'employee';
  viewOnly?: boolean;
  badgeLabel?: string;
  onOpenMenu?: () => void;
}

interface Props {
  items: FinanceCustomLedgerListItem[];
  currencyLabel: string;
  onSelect: (item: FinanceCustomLedgerListItem) => void;
}

const FinanceCustomLedgersList: React.FC<Props> = ({items, currencyLabel, onSelect}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {inlineTextStyle} = useDirection();
  const listCard = useMemo(
    () => ({...getListCardStyle(theme), ...getFinanceCardFrameStyle(theme)}),
    [theme],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: {
          gap: theme.spacing.sm,
        },
        roleBadge: {
          paddingHorizontal: 6,
          paddingVertical: 1,
          borderRadius: theme.radius.sm,
          flexShrink: 0,
        },
        roleText: {
          fontSize: 10,
          fontWeight: '700',
        },
        avatarText: {
          fontSize: 12,
          fontWeight: '700',
        },
      }),
    [theme],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.list}>
      {items.map((item) => {
        const isOwnerAdmin = item.ownerRole === 'admin';
        const avatarBackground = item.ownerRole
          ? isOwnerAdmin
            ? `${theme.colors.primary}18`
            : theme.colors.successLight
          : `${item.accentColor}18`;
        const avatarColor = item.ownerRole
          ? isOwnerAdmin
            ? theme.colors.primary
            : theme.colors.success
          : item.accentColor;

        const metaParts: string[] = [];
        if (item.transactionCount > 0) {
          metaParts.push(`${item.transactionCount} ${t('transactions')}`);
        }
        if (item.lastTransactionAt) {
          metaParts.push(formatRelativeTime(item.lastTransactionAt, t));
        }
        if (item.ownerName) {
          metaParts.push(item.ownerName);
        }

        return (
          <View key={item.id} style={listCard}>
          <FinanceListRow
            title={item.name}
            titleColor={theme.typography.primary}
            subtitle={metaParts.length > 0 ? metaParts.join(' · ') : undefined}
            amount={item.balance}
            currencyLabel={currencyLabel}
            viewOnly={item.viewOnly}
            viewOnlyLabel={t('viewOnlyAccount')}
            onPress={() => onSelect(item)}
            leadingBackground={avatarBackground}
            leading={
              <Text style={[styles.avatarText, {color: avatarColor}]} numberOfLines={1}>
                {getNameInitials(item.name)}
              </Text>
            }
            badges={
              <>
                {item.badgeLabel ? (
                  <View
                    style={[
                      styles.roleBadge,
                      {backgroundColor: theme.colors.surfaceSecondary},
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        inlineTextStyle,
                        {color: theme.typography.secondary},
                      ]}
                    >
                      {item.badgeLabel}
                    </Text>
                  </View>
                ) : null}
                {item.ownerRole ? (
                  <View
                    style={[
                      styles.roleBadge,
                      {
                        backgroundColor: isOwnerAdmin
                          ? `${theme.colors.primary}18`
                          : theme.colors.surfaceSecondary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        inlineTextStyle,
                        {
                          color: isOwnerAdmin ? theme.colors.primary : theme.typography.secondary,
                        },
                      ]}
                    >
                      {isOwnerAdmin ? t('adminRole') : t('employeeRole')}
                    </Text>
                  </View>
                ) : null}
              </>
            }
            trailingAction={
              item.onOpenMenu ? <FinanceCardOverflowButton onPress={item.onOpenMenu} /> : undefined
            }
          />
          </View>
        );
      })}
    </View>
  );
};

export default FinanceCustomLedgersList;
