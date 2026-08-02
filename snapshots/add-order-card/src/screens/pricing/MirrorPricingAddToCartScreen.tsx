import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import BottomSheet from '@app/components/common/BottomSheet';
import MirrorPricingCalculatorPanel from '@app/components/pricing/MirrorPricingCalculatorPanel';
import MirrorPricingCartFab from '@app/components/pricing/MirrorPricingCartFab';
import MirrorPricingCartPanel from '@app/components/pricing/MirrorPricingCartPanel';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useTheme} from '@app/context/ThemeContext';
import {getMirrorPricingCartBadgeCount, useMirrorPricingCartStore} from '@app/stores/mirrorPricingCartStore';
import type {PricingStackParamList} from '@app/types/navigation';
import {getTabBarHeight} from '@app/utils/tabBarInsets';

type Nav = NativeStackNavigationProp<PricingStackParamList, 'MirrorPricingAddToCart'>;

const MirrorPricingAddToCartScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const cartItems = useMirrorPricingCartStore((state) => state.items);
  const customAdditions = useMirrorPricingCartStore((state) => state.customAdditions);
  const cartCount = useMemo(
    () => getMirrorPricingCartBadgeCount(cartItems, customAdditions),
    [cartItems, customAdditions],
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [cartBumpSignal, setCartBumpSignal] = useState(0);

  const scrollBottomPadding = useMemo(
    () => getTabBarHeight(insets) + theme.spacing.md + 72,
    [insets, theme.spacing.md],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          padding: theme.spacing.sm,
          paddingBottom: scrollBottomPadding,
        },
      }),
    [scrollBottomPadding, theme.spacing.md],
  );

  const handleAddedToCart = () => {
    setCartBumpSignal((value) => value + 1);
  };

  return (
    <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
      <View style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <MirrorPricingCalculatorPanel variant="cart" onAddedToCart={handleAddedToCart} />
        </ScrollView>

        <MirrorPricingCartFab
          count={cartCount}
          bumpSignal={cartBumpSignal}
          onPress={() => setCartOpen(true)}
        />
      </View>

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

export default MirrorPricingAddToCartScreen;
