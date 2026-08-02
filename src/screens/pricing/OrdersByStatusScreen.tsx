import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import type {RouteProp} from '@react-navigation/native';
import {useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import MirrorPricingConfirmedOrdersPanel from '@app/components/pricing/MirrorPricingConfirmedOrdersPanel';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useOrdersHomeCardSectionAdmin} from '@app/hooks/useOrdersHomeCardAdmin';
import {useOrdersHomeCards} from '@app/hooks/useOrdersHomeCards';
import {useTheme} from '@app/context/ThemeContext';
import {resolveOrdersHomeCards} from '@app/types/ordersHomeCard';
import {
  resolveBuiltinOrdersHomeCardLabel,
  resolveMirrorPricingOrderStatusLabel,
} from '@app/utils/ordersHomeCardLabels';
import type {PricingStackParamList} from '@app/types/navigation';

type OrdersByStatusRoute = RouteProp<PricingStackParamList, 'OrdersByStatus'>;

const OrdersByStatusScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {params} = useRoute<OrdersByStatusRoute>();
  const {cards: storedHomeCards} = useOrdersHomeCards();
  const homeCards = useMemo(() => resolveOrdersHomeCards(storedHomeCards, t), [storedHomeCards, t]);
  const fallbackTitle = params.outstandingOnly
    ? resolveBuiltinOrdersHomeCardLabel('completed_outstanding', homeCards, t)
    : resolveMirrorPricingOrderStatusLabel(params.status, homeCards, t);
  const {menus, header} = useOrdersHomeCardSectionAdmin({
    ordersHomeCardId: params.ordersHomeCardId,
    fallbackTitle,
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
          statusFilter={params.status}
          focusOrderId={params.focusOrderId}
          focusToken={params.focusToken}
          outstandingOnly={params.outstandingOnly}
        />
      </View>
      {menus}
    </ScreenContainer>
  );
};

export default OrdersByStatusScreen;
