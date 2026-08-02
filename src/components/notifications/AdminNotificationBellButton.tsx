import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@app/context/ThemeContext';
import {
  selectAdminUnreadNotificationCount,
  useAdminNotificationStore,
} from '@app/stores/adminNotificationStore';

interface Props {
  onPress: () => void;
}

const AdminNotificationBellButton: React.FC<Props> = ({onPress}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const unreadCount = useAdminNotificationStore(selectAdminUnreadNotificationCount);

  const badgeLabel = useMemo(() => {
    if (unreadCount <= 0) {
      return null;
    }
    return unreadCount > 99 ? '99+' : String(unreadCount);
  }, [unreadCount]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 20,
        },
        badge: {
          position: 'absolute',
          top: 2,
          end: 2,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 4,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: theme.colors.surface,
        },
        badgeText: {
          color: theme.colors.onPrimary,
          fontSize: 10,
          fontWeight: '700',
          lineHeight: 12,
        },
      }),
    [theme.colors.onPrimary, theme.colors.surface, theme.status.error],
  );

  return (
    <Pressable
      style={({pressed}) => [styles.button, {opacity: pressed ? 0.7 : 1}]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0
          ? t('adminNotificationBellAccessibility', {count: unreadCount})
          : t('adminNotificationsTitle')
      }
    >
      <MaterialCommunityIcons name="bell-outline" size={24} color={theme.colors.icon} />
      {badgeLabel ? (
        <View style={[styles.badge, {backgroundColor: theme.status.error}]}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
};

export default AdminNotificationBellButton;
