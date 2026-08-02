import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {FinanceCardOverflowButton} from '@app/components/finance/FinanceCardOverflowMenu';
import FinanceListRow from '@app/components/finance/FinanceListRow';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {AppUser} from '@app/types/models';
import {getFinanceCardFrameStyle} from '@app/utils/financeCardFrame';
import {formatRelativeTime, getNameInitials} from '@app/utils/format';
import {getListCardStyle} from '@shared/theme/themeHelpers';

export interface FinanceAccountListItem {
  account: AppUser;
  balance: number;
  transactionCount: number;
  lastTransactionAt: string | null;
  advanceBalance?: number;
  viewOnly?: boolean;
  title?: string;
  onOpenMenu?: () => void;
}

interface Props {
  accounts: FinanceAccountListItem[];
  currencyLabel: string;
  onSelect: (account: AppUser) => void;
}

const FinanceAccountsList: React.FC<Props> = ({accounts, currencyLabel, onSelect}) => {
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

  if (accounts.length === 0) {
    return null;
  }

  return (
    <View style={styles.list}>
      {accounts.map(({account, balance, transactionCount, lastTransactionAt, advanceBalance, viewOnly, title, onOpenMenu}) => {
        const isAdmin = account.role === 'admin';
        const isArchived = Boolean(account.archivedAt);
        const avatarBackground = isAdmin ? `${theme.colors.primary}18` : theme.colors.successLight;
        const avatarColor = isAdmin ? theme.colors.primary : theme.colors.success;

        const metaParts: string[] = [];
        if (transactionCount > 0) {
          metaParts.push(`${transactionCount} ${t('transactions')}`);
        }
        if (lastTransactionAt) {
          metaParts.push(formatRelativeTime(lastTransactionAt, t));
        }
        if (advanceBalance && advanceBalance > 0) {
          metaParts.push(`${t('advanceBalance')}: ${advanceBalance.toFixed(2)}`);
        }

        return (
          <View key={account.id} style={listCard}>
          <FinanceListRow
            title={title ?? account.name}
            titleColor={isAdmin ? theme.colors.primary : theme.typography.primary}
            subtitle={metaParts.length > 0 ? metaParts.join(' · ') : undefined}
            amount={balance}
            currencyLabel={currencyLabel}
            viewOnly={viewOnly}
            viewOnlyLabel={t('viewOnlyAccount')}
            onPress={() => onSelect(account)}
            leadingBackground={avatarBackground}
            leading={
              <Text style={[styles.avatarText, {color: avatarColor}]} numberOfLines={1}>
                {getNameInitials(account.name)}
              </Text>
            }
            badges={
              <View style={{flexDirection: 'row', gap: 4, flexShrink: 0}}>
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor: isAdmin
                        ? `${theme.colors.primary}18`
                        : theme.colors.surfaceSecondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleText,
                      inlineTextStyle,
                      {color: isAdmin ? theme.colors.primary : theme.typography.secondary},
                    ]}
                  >
                    {isAdmin ? t('adminRole') : t('employeeRole')}
                  </Text>
                </View>
                {isArchived ? (
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
                      {t('archivedEmployeeAccount')}
                    </Text>
                  </View>
                ) : null}
              </View>
            }
            trailingAction={onOpenMenu ? <FinanceCardOverflowButton onPress={onOpenMenu} /> : undefined}
          />
          </View>
        );
      })}
    </View>
  );
};

export default FinanceAccountsList;
