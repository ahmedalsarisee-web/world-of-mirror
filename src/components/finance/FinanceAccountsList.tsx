import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import FinanceGroupedListCard from '@app/components/finance/FinanceGroupedListCard';
import FinanceListRow from '@app/components/finance/FinanceListRow';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {AppUser} from '@app/types/models';
import {formatRelativeTime, getNameInitials} from '@app/utils/format';

export interface FinanceAccountListItem {
  account: AppUser;
  balance: number;
  transactionCount: number;
  lastTransactionAt: string | null;
  advanceBalance?: number;
  viewOnly?: boolean;
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
    <FinanceGroupedListCard>
      {accounts.map(({account, balance, transactionCount, lastTransactionAt, advanceBalance, viewOnly}, index) => {
        const isAdmin = account.role === 'admin';
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
          <FinanceListRow
            key={account.id}
            showDivider={index > 0}
            title={account.name}
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
            }
          />
        );
      })}
    </FinanceGroupedListCard>
  );
};

export default FinanceAccountsList;
