import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {AppUser} from '@app/types/models';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface Props {
  user: AppUser;
  onPress?: () => void;
}

const SettingsProfileCard: React.FC<Props> = ({user, onPress}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, layoutStyle, chevronForward} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const isAdmin = user.role === 'admin';
  const isPressable = Boolean(onPress);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
        },
        avatarWrap: {
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
        },
        name: {
          fontSize: theme.typographyScale.size.md,
          fontWeight: '700',
          marginBottom: 4,
        },
        roleBadge: {
          alignSelf: 'flex-start',
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 3,
          borderRadius: theme.radius.sm,
        },
        roleText: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
        },
      }),
    [row, theme],
  );

  const content = (
    <>
      <View
        style={[
          styles.avatarWrap,
          {backgroundColor: isAdmin ? `${theme.colors.primary}18` : theme.colors.surfaceSecondary},
        ]}
      >
        <MaterialCommunityIcons
          name={isAdmin ? 'shield-account-outline' : 'account-outline'}
          size={28}
          color={isAdmin ? theme.colors.primary : theme.colors.icon}
        />
      </View>
      <View style={{flex: 1, minWidth: 0}}>
        <Text style={[styles.name, textStyle, {color: theme.typography.primary}]} numberOfLines={1}>
          {user.name}
        </Text>
        <View
          style={[
            styles.roleBadge,
            {backgroundColor: isAdmin ? theme.colors.successLight : theme.colors.surfaceSecondary},
          ]}
        >
          <Text
            style={[
              styles.roleText,
              inlineTextStyle,
              {color: isAdmin ? theme.colors.success : theme.typography.secondary},
            ]}
          >
            {isAdmin ? t('adminRole') : t('employeeRole')}
          </Text>
        </View>
      </View>
      {isPressable ? (
        <MaterialCommunityIcons name={chevronForward as any} size={20} color={theme.colors.icon} />
      ) : null}
    </>
  );

  if (isPressable) {
    return (
      <Pressable
        style={[styles.card, listCard, layoutStyle, {flexDirection: row}]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('settingsAccountSection')}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, listCard, layoutStyle, {flexDirection: row}]}>{content}</View>
  );
};

export default SettingsProfileCard;
