import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import type {RouteProp} from '@react-navigation/native';
import {useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import MirrorPricingConfirmedOrdersPanel from '@app/components/pricing/MirrorPricingConfirmedOrdersPanel';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useOrdersHomeCardSectionAdmin} from '@app/hooks/useOrdersHomeCardAdmin';
import {useTheme} from '@app/context/ThemeContext';
import type {PricingStackParamList} from '@app/types/navigation';

type ConfirmedOrdersRoute = RouteProp<PricingStackParamList, 'ConfirmedOrders'>;

const ConfirmedOrdersScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {params} = useRoute<ConfirmedOrdersRoute>();
  const {menus, header} = useOrdersHomeCardSectionAdmin({
    ordersHomeCardId: params?.ordersHomeCardId,
    fallbackTitle: t('ordersActiveTitle'),
  });
  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {flex: 1, padding: theme.spacing.md, paddingBottom: theme.spacing.xxl},
      }),
    [theme],
  );

  return (
    <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
      {header}
      <View style={styles.panel}>
        <MirrorPricingConfirmedOrdersPanel
          showTitle={false}
          activeOnly
          focusOrderId={params?.focusOrderId}
          focusToken={params?.focusToken}
        />
      </View>
      {menus}
    </ScreenContainer>
  );
};

export default ConfirmedOrdersScreen;
