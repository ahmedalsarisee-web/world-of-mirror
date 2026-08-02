import React, {useMemo} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MirrorPricingCalculatorPanel from '@app/components/pricing/MirrorPricingCalculatorPanel';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useTheme} from '@app/context/ThemeContext';
import {getTabBarHeight} from '@app/utils/tabBarInsets';

const MirrorPricingPriceListScreen: React.FC = () => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();

  const scrollBottomPadding = useMemo(
    () => getTabBarHeight(insets) + theme.spacing.lg,
    [insets, theme.spacing.lg],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          padding: theme.spacing.md,
          paddingBottom: scrollBottomPadding,
        },
      }),
    [scrollBottomPadding, theme.spacing.md],
  );

  return (
    <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <MirrorPricingCalculatorPanel />
      </ScrollView>
    </ScreenContainer>
  );
};

export default MirrorPricingPriceListScreen;
