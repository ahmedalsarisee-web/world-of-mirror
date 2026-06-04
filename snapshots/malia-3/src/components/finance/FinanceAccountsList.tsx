import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import AmountText from '@app/components/common/AmountText';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {AppUser} from '@app/types/models';
import {formatRelativeTime, getNameInitials} from '@app/utils/format';
import {getListCardStyle} from '@shared/theme/themeHelpers';

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
  const {textStyle, row, layoutStyle, inlineTextStyle, alignEnd} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: {gap: theme.spacing.sm},
        card: {
          overflow: 'hidden',
        },
        rowInner: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
        },
        avatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        avatarText: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        body: {flex: 1, minWidth: 0},
        nameRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.xs,
          marginBottom: 4,
          flexWrap: 'wrap',
        },
        name: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
          flexShrink: 1,
        },
        roleBadge: {
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: 2,
          borderRadius: theme.radius.sm,
          flexShrink: 0,
        },
        roleText: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
        },
        metaRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.md,
          flexWrap: 'wrap',
        },
        metaItem: {
          flexDirection: row,
          alignItems: 'center',
          gap: 4,
        },
        metaText: {
          fontSize: theme.typographyScale.size.xs,
        },
        amountCol: {
          alignItems: alignEnd,
          flexShrink: 0,
          minWidth: 88,
        },
        viewOnlyText: {
          fontSize: theme.typographyScale.size.xs,
          marginTop: 2,
        },
      }),
    [alignEnd, row, theme],
  );

  return (
    <View style={styles.list}>
      {accounts.map(({account, balance, transactionCount, lastTransactionAt, advanceBalance, viewOnly}) => {
        const isAdmin = account.role === 'admin';
        const avatarBackground = isAdmin ? `${theme.colors.primary}18` : theme.colors.successLight;
        const avatarColor = isAdmin ? theme.colors.primary : theme.colors.success;

        return (
          <View key={account.id} style={[listCard, styles.card]}>
            <Pressable
              style={({pressed}) => [styles.rowInner, layoutStyle, pressed && {opacity: 0.72}]}
              onPress={() => onSelect(account)}
            >
              <View style={[styles.avatar, {backgroundColor: avatarBackground}]}>
                <Text style={[styles.avatarText, {color: avatarColor}]} numberOfLines={1}>
                  {getNameInitials(account.name)}
                </Text>
              </View>

              <View style={styles.body}>
                <View style={[styles.nameRow, layoutStyle]}>
                  <Text
                    style={[
                      styles.name,
                      textStyle,
                      {color: isAdmin ? theme.colors.primary : theme.typography.primary},
                    ]}
                    numberOfLines={1}
                  >
                    {account.name}
                  </Text>
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
                </View>
                <View style={[styles.metaRow, layoutStyle]}>
                  <View style={[styles.metaItem, layoutStyle]}>
                    <MaterialCommunityIcons
                      name="swap-horizontal"
                      size={14}
                      color={theme.typography.secondary}
                    />
                    <Text
                      style={[styles.metaText, inlineTextStyle, {color: theme.typography.secondary}]}
                      numberOfLines={1}
                    >
                      {transactionCount}
                    </Text>
                  </View>
                  <View style={[styles.metaItem, layoutStyle]}>
                    <MaterialCommunityIcons
                      name="calendar-clock-outline"
                      size={14}
                      color={theme.typography.secondary}
                    />
                    <Text
                      style={[styles.metaText, inlineTextStyle, {color: theme.typography.secondary}]}
                      numberOfLines={1}
                    >
                      {formatRelativeTime(lastTransactionAt, t)}
                    </Text>
                  </View>
                  {advanceBalance && advanceBalance > 0 ? (
                    <View style={[styles.metaItem, layoutStyle]}>
                      <MaterialCommunityIcons name="hand-coin-outline" size={14} color="#2563EB" />
                      <Text
                        style={[styles.metaText, inlineTextStyle, {color: '#2563EB'}]}
                        numberOfLines={1}
                      >
                        {t('advanceBalance')}: {advanceBalance.toFixed(2)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.amountCol}>
                <AmountText amount={balance} size="sm" currencyLabel={currencyLabel} />
                {viewOnly ? (
                  <Text style={[styles.viewOnlyText, textStyle, {color: theme.typography.secondary}]}>
                    {t('viewOnlyAccount')}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
};

export default FinanceAccountsList;
