import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useLanguage} from '@app/context/LangContext';
import {useTheme} from '@app/context/ThemeContext';
import {getStackScreenOptions} from '@app/navigation/stackScreenOptions';
import AddOrderScreen from '@app/screens/pricing/AddOrderScreen';
import CompletedOrdersArchiveScreen from '@app/screens/pricing/CompletedOrdersArchiveScreen';
import ConfirmedOrdersScreen from '@app/screens/pricing/ConfirmedOrdersScreen';
import MirrorPricingPriceListScreen from '@app/screens/pricing/MirrorPricingPriceListScreen';
import CustomOrdersCardScreen from '@app/screens/pricing/CustomOrdersCardScreen';
import OrdersByStatusScreen from '@app/screens/pricing/OrdersByStatusScreen';
import MirrorWarehouseScreen from '@app/screens/pricing/MirrorWarehouseScreen';
import OrdersHomeScreen from '@app/screens/pricing/OrdersHomeScreen';
import type {PricingStackParamList} from '@app/types/navigation';

const Stack = createNativeStackNavigator<PricingStackParamList>();

const PricingNavigator: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {language} = useLanguage();

  return (
    <Stack.Navigator screenOptions={getStackScreenOptions(theme, language)}>
      <Stack.Screen name="OrdersHome" component={OrdersHomeScreen} options={{headerShown: false}} />
      <Stack.Screen
        name="AddOrder"
        component={AddOrderScreen}
        options={{title: t('addOrder')}}
      />
      <Stack.Screen
        name="MirrorPricingPriceList"
        component={MirrorPricingPriceListScreen}
        options={{title: t('ordersPricingButtonLabel')}}
      />
      <Stack.Screen
        name="MirrorWarehouse"
        component={MirrorWarehouseScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen name="ConfirmedOrders" component={ConfirmedOrdersScreen} options={{headerShown: false}} />
      <Stack.Screen
        name="CompletedOrdersArchive"
        component={CompletedOrdersArchiveScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen name="OrdersByStatus" component={OrdersByStatusScreen} options={{headerShown: false}} />
      <Stack.Screen name="CustomOrdersCard" component={CustomOrdersCardScreen} options={{headerShown: false}} />
    </Stack.Navigator>
  );
};

export default PricingNavigator;
