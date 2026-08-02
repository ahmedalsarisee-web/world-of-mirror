import React, {useCallback, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import MirrorPricingAddOrderPanel from '@app/components/pricing/MirrorPricingAddOrderPanel';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useMirrorCatalogSync} from '@app/hooks/useMirrorCatalogSync';
import {useOrdersHomeCardSectionAdmin} from '@app/hooks/useOrdersHomeCardAdmin';
import {useTheme} from '@app/context/ThemeContext';
import type {PricingStackParamList} from '@app/types/navigation';
import {buildNewOrderDestinationFields} from '@app/utils/orderMoveDestinations';

type Nav = NativeStackNavigationProp<PricingStackParamList, 'AddOrder'>;
type AddOrderRoute = RouteProp<PricingStackParamList, 'AddOrder'>;

const AddOrderScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<AddOrderRoute>();
  useMirrorCatalogSync(true);
  const {menus} = useOrdersHomeCardSectionAdmin({
    ordersHomeCardId: params?.ordersHomeCardId,
    fallbackTitle: t('addOrder'),
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          flex: 1,
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.xs,
          paddingBottom: theme.spacing.sm,
        },
      }),
    [theme],
  );

  const handleOrderConfirmed = useCallback(
    (destinationKey: string, orderId?: string) => {
      try {
        const destination = buildNewOrderDestinationFields(destinationKey);
        const focusParams = orderId
          ? {focusOrderId: orderId, focusToken: Date.now()}
          : undefined;

        if (destination.homeCardId) {
          navigation.replace('CustomOrdersCard', {
            ordersHomeCardId: destination.homeCardId,
            ...focusParams,
          });
          return;
        }

        if (destination.status === 'completed' && destinationKey === 'completed_outstanding') {
          navigation.replace('OrdersByStatus', {
            status: 'completed',
            outstandingOnly: true,
            ...focusParams,
          });
          return;
        }

        // Same destination cards as the orders home screen (including preparation).
        navigation.replace('OrdersByStatus', {
          status: destination.status,
          ...focusParams,
        });
      } catch (error) {
        console.warn('[AddOrderScreen] navigation after confirm failed', error);
      }
    },
    [navigation],
  );

  return (
    <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
      <View style={styles.body}>
        <MirrorPricingAddOrderPanel onOrderConfirmed={handleOrderConfirmed} />
      </View>
      {menus}
    </ScreenContainer>
  );
};

export default AddOrderScreen;
