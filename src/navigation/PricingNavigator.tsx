import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useLanguage} from '@app/context/LangContext';
import {useTheme} from '@app/context/ThemeContext';
import {getStackScreenOptions} from '@app/navigation/stackScreenOptions';
import ConfirmedOrdersScreen from '@app/screens/pricing/ConfirmedOrdersScreen';
import MirrorPricingScreen from '@app/screens/pricing/MirrorPricingScreen';
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
        name="MirrorPricing"
        component={MirrorPricingScreen}
        options={{title: t('mirrorPricing')}}
      />
      <Stack.Screen
        name="ConfirmedOrders"
        component={ConfirmedOrdersScreen}
        options={{title: t('mirrorOrdersConfirmed')}}
      />
    </Stack.Navigator>
  );
};

export default PricingNavigator;
