import React, {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {AppUser} from '@app/types/models';
import {getNameInitials} from '@app/utils/format';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  users: AppUser[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

const FinanceLedgerVisibilityPicker: React.FC<Props> = ({users, selectedIds, onChange}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, inlineTextStyle, ltrTextStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginTop: theme.spacing.md,
          marginBottom: theme.spacing.sm,
        },
        label: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
          marginBottom: theme.spacing.xs,
        },
        hint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
          marginBottom: theme.spacing.sm,
        },
        toolbar: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        selectedCount: {
          fontSize: theme.typographyScale.size.xs,
          flex: 1,
        },
        toolbarActions: {
          flexDirection: row,
          gap: theme.spacing.md,
        },
        toolbarLink: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
        },
        list: {
          maxHeight: 240,
        },
        row: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.xs,
          overflow: 'hidden',
        },
        avatar: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        avatarText: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
        },
        rowLabel: {
          flex: 1,
          flexShrink: 1,
          minWidth: 0,
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
        },
        nameRow: {
          flex: 1,
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.xs,
          minWidth: 0,
          overflow: 'hidden',
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
        emptyText: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
          paddingVertical: theme.spacing.sm,
        },
      }),
    [row, theme],
  );

  const toggleUser = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
      return;
    }
    onChange([...selectedIds, userId]);
  };

  const selectAll = () => {
    onChange(users.map((user) => user.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, textStyle, {color: theme.typography.primary}]}>
        {t('financeLedgerVisibility')}
      </Text>
      <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
        {t('financeLedgerVisibilityHint')}
      </Text>

      {users.length === 0 ? (
        <Text style={[styles.emptyText, textStyle, {color: theme.typography.secondary}]}>
          {t('financeLedgerVisibilityEmpty')}
        </Text>
      ) : (
        <>
          <View style={[styles.toolbar, layoutStyle]}>
            <Text style={[styles.selectedCount, textStyle, {color: theme.typography.secondary}]}>
              {t('financeLedgerVisibilitySelected', {count: selectedIds.length})}
            </Text>
            <View style={[styles.toolbarActions, layoutStyle]}>
              <Pressable onPress={selectAll}>
                <Text style={[styles.toolbarLink, textStyle, {color: theme.colors.primary}]}>
                  {t('selectAllEmployees')}
                </Text>
              </Pressable>
              <Pressable onPress={clearAll}>
                <Text style={[styles.toolbarLink, textStyle, {color: theme.typography.secondary}]}>
                  {t('clearSelection')}
                </Text>
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {users.map((user) => {
              const selected = selectedIds.includes(user.id);
              const isAdmin = user.role === 'admin';
              const avatarBackground = isAdmin ? `${theme.colors.primary}18` : theme.colors.successLight;
              const avatarColor = isAdmin ? theme.colors.primary : theme.colors.success;

              return (
                <Pressable
                  key={user.id}
                  style={[styles.row, listCard, layoutStyle]}
                  onPress={() => toggleUser(user.id)}
                >
                  <MaterialCommunityIcons
                    name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={selected ? theme.colors.primary : theme.colors.icon}
                  />
                  <View style={[styles.avatar, {backgroundColor: avatarBackground}]}>
                    <Text style={[styles.avatarText, ltrTextStyle, {color: avatarColor}]}>
                      {getNameInitials(user.name)}
                    </Text>
                  </View>
                  <View style={styles.nameRow}>
                    <Text
                      style={[
                        styles.rowLabel,
                        ltrTextStyle,
                        {color: isAdmin ? theme.colors.primary : theme.typography.primary},
                      ]}
                      numberOfLines={1}
                    >
                      {user.name}
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
                        numberOfLines={1}
                      >
                        {isAdmin ? t('adminRole') : t('employeeRole')}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
};

export default FinanceLedgerVisibilityPicker;
