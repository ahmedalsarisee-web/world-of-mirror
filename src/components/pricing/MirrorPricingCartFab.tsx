import React, {useEffect, useRef} from 'react';
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {getTabBarHeight} from '@app/utils/tabBarInsets';

interface Props {
  count: number;
  onPress: () => void;
  bumpSignal?: number;
}

const MirrorPricingCartFab: React.FC<Props> = ({count, onPress, bumpSignal = 0}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {isRTL, ltrTextStyle} = useDirection();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const previousCountRef = useRef(count);
  const previousBumpRef = useRef(bumpSignal);

  const bottomOffset = getTabBarHeight(insets) + theme.spacing.md;

  useEffect(() => {
    pulseLoopRef.current?.stop();

    if (count > 0) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.06,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoopRef.current.start();
    } else {
      pulse.setValue(1);
    }

    return () => {
      pulseLoopRef.current?.stop();
    };
  }, [count, pulse]);

  useEffect(() => {
    const countIncreased = count > previousCountRef.current;
    const bumpTriggered = bumpSignal !== previousBumpRef.current;

    previousCountRef.current = count;
    previousBumpRef.current = bumpSignal;

    if (!countIncreased && !bumpTriggered) {
      return;
    }

    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.18,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bumpSignal, count, scale]);

  const combinedScale = Animated.multiply(scale, pulse);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          bottom: bottomOffset,
          ...(isRTL ? {left: theme.spacing.md} : {right: theme.spacing.md}),
          transform: [{scale: combinedScale}],
        },
      ]}
    >
      <Pressable
        style={({pressed}) => [
          styles.button,
          {
            backgroundColor: theme.colors.primary,
            opacity: pressed ? 0.88 : 1,
            ...theme.shadow.card,
          },
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('mirrorCartOpenFab')}
      >
        <MaterialCommunityIcons name="cart-outline" size={26} color={theme.colors.onPrimary} />
        {count > 0 ? (
          <View style={[styles.badge, {backgroundColor: theme.status.error, borderColor: theme.colors.surface}]}>
            <Text style={[styles.badgeText, ltrTextStyle, {color: theme.colors.onPrimary}]} numberOfLines={1}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 20,
  },
  button: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

export default MirrorPricingCartFab;
