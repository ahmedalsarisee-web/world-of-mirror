import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import ScreenContainer from '@app/components/common/ScreenContainer';
import ScreenHeader from '@app/components/common/ScreenHeader';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {getMirrorPricingCartCount, useMirrorPricingCartStore} from '@app/stores/mirrorPricingCartStore';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import type {PricingStackParamList} from '@app/types/navigation';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type Nav = NativeStackNavigationProp<PricingStackParamList, 'OrdersHome'>;

const OrdersHomeScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, layoutStyle, chevronForward, ltrTextStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const cartItems = useMirrorPricingCartStore((state) => state.items);
  const cartCount = useMemo(() => getMirrorPricingCartCount(cartItems), [cartItems]);
  const confirmedCount = useMirrorPricingConfirmedOrdersStore((state) => state.orders.length);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {padding: theme.spacing.md, gap: theme.spacing.md},
        card: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
        },
        iconWrap: {
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
        },
        cardBody: {flex: 1, minWidth: 0, gap: 4},
        cardTitle: {fontSize: theme.typographyScale.size.md, fontWeight: '700'},
        cardSubtitle: {fontSize: theme.typographyScale.size.sm, lineHeight: 20},
        badge: {
          minWidth: 22,
          height: 22,
          borderRadius: 11,
          paddingHorizontal: 6,
          alignItems: 'center',
          justifyContent: 'center',
        },
        badgeText: {fontSize: 11, fontWeight: '700'},
      }),
    [row, theme],
  );

  const cards = [
    {
      key: 'calculator',
      icon: 'mirror' as const,
      iconColor: theme.colors.primary,
      iconBackground: `${theme.colors.primary}18`,
      title: t('mirrorPricing'),
      subtitle: t('ordersHomeCalculatorHint'),
      badge: cartCount > 0 ? cartCount : undefined,
      onPress: () => navigation.navigate('MirrorPricing'),
    },
    {
      key: 'confirmed',
      icon: 'clipboard-check-outline' as const,
      iconColor: theme.status.success,
      iconBackground: `${theme.status.success}18`,
      title: t('mirrorOrdersConfirmed'),
      subtitle: t('ordersHomeConfirmedHint'),
      badge: confirmedCount > 0 ? confirmedCount : undefined,
      onPress: () => navigation.navigate('ConfirmedOrders'),
    },
  ];

  return (
    <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
      <ScreenHeader title={t('orders')} />

      <View style={[styles.content, layoutStyle]}>
        {cards.map((card) => (
          <Pressable
            key={card.key}
            style={({pressed}) => [styles.card, listCard, {opacity: pressed ? 0.75 : 1}]}
            onPress={card.onPress}
            accessibilityRole="button"
          >
            <View style={[styles.iconWrap, {backgroundColor: card.iconBackground}]}>
              <MaterialCommunityIcons name={card.icon} size={26} color={card.iconColor} />
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, textStyle, {color: theme.typography.primary}]}>
                {card.title}
              </Text>
              <Text style={[styles.cardSubtitle, inlineTextStyle, {color: theme.typography.secondary}]}>
                {card.subtitle}
              </Text>
            </View>
            {card.badge ? (
              <View style={[styles.badge, {backgroundColor: theme.colors.primary}]}>
                <Text style={[styles.badgeText, ltrTextStyle, {color: theme.colors.onPrimary}]}>
                  {card.badge}
                </Text>
              </View>
            ) : (
              <MaterialCommunityIcons name={chevronForward} size={24} color={theme.colors.icon} />
            )}
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
};

export default OrdersHomeScreen;
