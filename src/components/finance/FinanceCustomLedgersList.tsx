import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import FinanceGroupedListCard from '@app/components/finance/FinanceGroupedListCard';
import FinanceListRow from '@app/components/finance/FinanceListRow';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {formatRelativeTime, getNameInitials} from '@app/utils/format';

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
  onRename?: () => void;
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
        renameBtn: {
          padding: 2,
          flexShrink: 0,
        },
      }),
    [theme],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <FinanceGroupedListCard>
      {items.map((item, index) => {
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
          <FinanceListRow
            key={item.id}
            showDivider={index > 0}
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
                {item.onRename ? (
                  <Pressable
                    style={styles.renameBtn}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      item.onRename?.();
                    }}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={14} color={theme.typography.secondary} />
                  </Pressable>
                ) : null}
              </>
            }
          />
        );
      })}
    </FinanceGroupedListCard>
  );
};

export default FinanceCustomLedgersList;
