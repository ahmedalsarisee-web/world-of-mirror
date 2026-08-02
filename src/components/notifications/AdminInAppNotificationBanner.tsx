import React, {useCallback, useEffect} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {useAdminNotificationStore} from '@app/stores/adminNotificationStore';
import {getAdminNotificationPresentation} from '@app/utils/adminNotificationPresentation';
import {formatAdminNotificationTimestamp} from '@app/utils/formatAdminNotificationTimestamp';

const AUTO_DISMISS_MS = 7000;
const DISMISS_ANIMATION_MS = 220;

const AdminInAppNotificationBanner: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const {textStyle, layoutStyle, inlineTextStyle} = useDirection();
  const notification = useAdminNotificationStore((state) => state.notification);
  const dismiss = useAdminNotificationStore((state) => state.dismiss);

  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  const animateOut = useCallback(
    (onComplete?: () => void) => {
      translateY.value = withTiming(-120, {
        duration: DISMISS_ANIMATION_MS,
        easing: Easing.in(Easing.cubic),
      });
      opacity.value = withTiming(
        0,
        {duration: DISMISS_ANIMATION_MS, easing: Easing.in(Easing.cubic)},
        (finished) => {
          if (finished && onComplete) {
            runOnJS(onComplete)();
          }
        },
      );
    },
    [opacity, translateY],
  );

  const handleDismiss = useCallback(() => {
    animateOut(dismiss);
  }, [animateOut, dismiss]);

  useEffect(() => {
    if (!notification) {
      translateY.value = -120;
      opacity.value = 0;
      return;
    }

    translateY.value = withSpring(0, {damping: 20, stiffness: 240, mass: 0.75});
    opacity.value = withTiming(1, {duration: 220, easing: Easing.out(Easing.cubic)});

    const timer = setTimeout(() => {
      animateOut(dismiss);
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [animateOut, dismiss, notification, opacity, translateY]);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{translateY: translateY.value}],
  }));

  if (!notification) {
    return null;
  }

  const presentation = getAdminNotificationPresentation(notification.kind, theme);
  const displayTimestamp = notification.eventAt ?? notification.receivedAt;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, {top: insets.top + 8, paddingHorizontal: 12}]}
    >
      <Animated.View style={bannerStyle}>
        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('notificationDismiss')}
          style={[
            styles.banner,
            layoutStyle,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.cardBorder,
            },
          ]}
        >
          <View style={[styles.iconWrap, {backgroundColor: presentation.accentBackground}]}>
            <MaterialCommunityIcons
              name={presentation.icon}
              size={18}
              color={presentation.accentColor}
            />
          </View>

          <View style={styles.textWrap}>
            <Text style={[styles.title, textStyle, {color: theme.typography.primary}]} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={[styles.body, textStyle, {color: theme.typography.secondary}]} numberOfLines={2}>
              {notification.body}
            </Text>
            <Text style={[styles.time, inlineTextStyle, {color: theme.typography.muted}]}>
              {formatAdminNotificationTimestamp(displayTimestamp, t)}
            </Text>
          </View>

          <Pressable
            onPress={handleDismiss}
            hitSlop={10}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t('notificationDismiss')}
          >
            <MaterialCommunityIcons name="close" size={16} color={theme.colors.icon} />
          </Pressable>
        </Pressable>
      </Animated.View>
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
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  textWrap: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
  },
  time: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  closeButton: {
    padding: 2,
    marginTop: 1,
  },
});

export default AdminInAppNotificationBanner;
