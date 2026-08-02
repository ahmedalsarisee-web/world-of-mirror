import React, {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import BottomSheet from '@app/components/common/BottomSheet';
import ScreenContainer from '@app/components/common/ScreenContainer';
import MirrorPricingCartFab from '@app/components/pricing/MirrorPricingCartFab';
import MirrorPricingCartPanel from '@app/components/pricing/MirrorPricingCartPanel';
import MirrorPricingCustomAdditionsSection from '@app/components/pricing/MirrorPricingCustomAdditionsSection';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {
  getMirrorPricingCartBadgeCount,
  useMirrorPricingCartStore,
} from '@app/stores/mirrorPricingCartStore';
import {getCustomAdditionQuantity} from '@app/types/mirrorPricingCart';
import type {PricingStackParamList} from '@app/types/navigation';
import {getTabBarHeight} from '@app/utils/tabBarInsets';
import {getListCardStyle} from '@shared/theme/themeHelpers';

type Nav = NativeStackNavigationProp<PricingStackParamList, 'MirrorPricing'>;

type HubCard = {
  key: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor: string;
  iconBackground: string;
  title: string;
  subtitle: string;
  badge?: number;
  onPress: () => void;
};

const MirrorPricingScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, layoutStyle, chevronForward, ltrTextStyle} = useDirection();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const cartItems = useMirrorPricingCartStore((state) => state.items);
  const customAdditions = useMirrorPricingCartStore((state) => state.customAdditions);
  const cartCount = useMemo(
    () => getMirrorPricingCartBadgeCount(cartItems, customAdditions),
    [cartItems, customAdditions],
  );
  const customAdditionsCount = useMemo(
    () => customAdditions.reduce((sum, entry) => sum + getCustomAdditionQuantity(entry), 0),
    [customAdditions],
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [customAdditionsOpen, setCustomAdditionsOpen] = useState(false);
  const [cartBumpSignal, setCartBumpSignal] = useState(0);

  const scrollBottomPadding = useMemo(
    () => getTabBarHeight(insets) + theme.spacing.md + 72,
    [insets, theme.spacing.md],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          padding: theme.spacing.md,
          paddingBottom: scrollBottomPadding,
          gap: theme.spacing.md,
        },
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

  const cards: HubCard[] = [
    {
      key: 'add-to-cart',
      icon: 'cart-plus',
      iconColor: theme.colors.primary,
      iconBackground: `${theme.colors.primary}18`,
      title: t('mirrorCartAddSection'),
      subtitle: t('mirrorPricingAddToCartHint'),
      onPress: () => navigation.navigate('MirrorPricingAddToCart'),
    },
    {
      key: 'custom-additions',
      icon: 'playlist-plus',
      iconColor: theme.status.success,
      iconBackground: `${theme.status.success}18`,
      title: t('mirrorCartCustomAdditions'),
      subtitle: t('mirrorCartCustomAdditionsPageHint'),
      badge: customAdditionsCount > 0 ? customAdditionsCount : undefined,
      onPress: () => setCustomAdditionsOpen(true),
    },
    {
      key: 'price-list',
      icon: 'table-large',
      iconColor: theme.status.info,
      iconBackground: `${theme.status.info}18`,
      title: t('mirrorPricingPriceList'),
      subtitle: t('mirrorPricingPriceListHint'),
      onPress: () => navigation.navigate('MirrorPricingPriceList'),
    },
  ];

  return (
    <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
      <View style={{flex: 1}}>
        <ScrollView contentContainerStyle={[styles.scroll, layoutStyle]} keyboardShouldPersistTaps="handled">
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
        </ScrollView>

        <MirrorPricingCartFab
          count={cartCount}
          bumpSignal={cartBumpSignal}
          onPress={() => setCartOpen(true)}
        />
      </View>

      <BottomSheet
        visible={customAdditionsOpen}
        title={t('mirrorCartCustomAdditions')}
        onClose={() => setCustomAdditionsOpen(false)}
        sheetStyle={{maxHeight: '92%'}}
      >
        <MirrorPricingCustomAdditionsSection
          embedded
          onAdded={() => setCartBumpSignal((value) => value + 1)}
        />
      </BottomSheet>

      <BottomSheet
        visible={cartOpen}
        title={t('mirrorPricingCartTab')}
        onClose={() => setCartOpen(false)}
        sheetStyle={{maxHeight: '92%'}}
      >
        <MirrorPricingCartPanel
          embedded
          onOrderConfirmed={() => {
            setCartOpen(false);
            navigation.navigate('ConfirmedOrders');
          }}
        />
      </BottomSheet>
    </ScreenContainer>
  );
};

export default MirrorPricingScreen;
