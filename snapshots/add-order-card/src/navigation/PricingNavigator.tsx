import React, {useEffect} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useLanguage} from '@app/context/LangContext';
import {useTheme} from '@app/context/ThemeContext';
import {getStackScreenOptions} from '@app/navigation/stackScreenOptions';
import ConfirmedOrdersScreen from '@app/screens/pricing/ConfirmedOrdersScreen';
import MirrorPricingAddToCartScreen from '@app/screens/pricing/MirrorPricingAddToCartScreen';
import MirrorPricingPriceListScreen from '@app/screens/pricing/MirrorPricingPriceListScreen';
import MirrorPricingScreen from '@app/screens/pricing/MirrorPricingScreen';
import OrdersByStatusScreen from '@app/screens/pricing/OrdersByStatusScreen';
import OrdersHomeScreen from '@app/screens/pricing/OrdersHomeScreen';
import {getMirrorPricingOrderStatusTitleKey} from '@app/types/mirrorPricingOrderStatus';
import {useOrdersHomeUiStore} from '@app/stores/ordersHomeUiStore';
import type {PricingStackParamList} from '@app/types/navigation';

const Stack = createNativeStackNavigator<PricingStackParamList>();

const PricingNavigator: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {language} = useLanguage();
  const stackNavigation = useNavigation();

  useEffect(() => {
    const tabNavigation = stackNavigation.getParent();
    if (!tabNavigation) {
      return;
    }

    let leftOrdersTab = false;

    const resetToOrdersHome = () => {
      useOrdersHomeUiStore.getState().requestSearchReset();
      stackNavigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{name: 'OrdersHome'}],
        }),
      );
    };

    const unsubscribeFocus = tabNavigation.addListener('focus', () => {
      if (leftOrdersTab) {
        resetToOrdersHome();
        leftOrdersTab = false;
      }
    });

    const unsubscribeBlur = tabNavigation.addListener('blur', () => {
      leftOrdersTab = true;
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [stackNavigation]);

  return (
    <Stack.Navigator screenOptions={getStackScreenOptions(theme, language)}>
      <Stack.Screen name="OrdersHome" component={OrdersHomeScreen} options={{headerShown: false}} />
      <Stack.Screen
        name="MirrorPricing"
        component={MirrorPricingScreen}
        options={{title: t('mirrorPricing')}}
      />
      <Stack.Screen
        name="MirrorPricingAddToCart"
        component={MirrorPricingAddToCartScreen}
        options={{title: t('mirrorCartAddSection')}}
      />
      <Stack.Screen
        name="MirrorPricingPriceList"
        component={MirrorPricingPriceListScreen}
        options={{title: t('mirrorPricingPriceList')}}
      />
      <Stack.Screen
        name="ConfirmedOrders"
        component={ConfirmedOrdersScreen}
        options={{title: t('mirrorOrdersConfirmed')}}
      />
      <Stack.Screen
        name="OrdersByStatus"
        component={OrdersByStatusScreen}
        options={({route}) => ({
          title: route.params.outstandingOnly
            ? t('mirrorOrdersCompletedOutstanding')
            : t(getMirrorPricingOrderStatusTitleKey(route.params.status)),
        })}
      />
    </Stack.Navigator>
  );
};

export default PricingNavigator;
