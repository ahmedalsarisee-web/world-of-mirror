import React, {useEffect, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {ComponentProps} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {useAdminNotificationStore, type AdminNotificationKind} from '@app/stores/adminNotificationStore';

const AUTO_DISMISS_MS = 6000;

function iconForKind(kind: AdminNotificationKind): ComponentProps<typeof MaterialCommunityIcons>['name'] {
  switch (kind) {
    case 'attendance':
      return 'calendar-check';
    case 'confirmed_order':
      return 'clipboard-check-outline';
    default:
      return 'cash-multiple';
  }
}

const AdminInAppNotificationBanner: React.FC = () => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const {textStyle, layoutStyle} = useDirection();
  const notification = useAdminNotificationStore((state) => state.notification);
  const dismiss = useAdminNotificationStore((state) => state.dismiss);
  const iconName = useMemo(
    () => (notification ? iconForKind(notification.kind) : 'bell-outline'),
    [notification],
  );

  useEffect(() => {
    if (!notification) {
      return;
    }

    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dismiss, notification]);

  if (!notification) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, {top: insets.top + 8, paddingHorizontal: 12}]}
    >
      <Pressable
        onPress={dismiss}
        style={[
          styles.banner,
          layoutStyle,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.cardBorder,
            ...theme.shadow.card,
          },
        ]}
      >
        <View style={[styles.iconWrap, {backgroundColor: theme.colors.primary + '18'}]}>
          <MaterialCommunityIcons name={iconName} size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, textStyle, {color: theme.typography.primary}]} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={[styles.body, textStyle, {color: theme.typography.secondary}]} numberOfLines={2}>
            {notification.body}
          </Text>
        </View>
        <MaterialCommunityIcons name="close" size={18} color={theme.colors.icon} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    fontSize: 12,
    lineHeight: 16,
  },
});

export default AdminInAppNotificationBanner;
