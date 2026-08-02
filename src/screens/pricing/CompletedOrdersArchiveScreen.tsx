import React, {useEffect} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useTheme} from '@app/context/ThemeContext';
import type {PricingStackParamList} from '@app/types/navigation';

type CompletedOrdersArchiveRoute = RouteProp<PricingStackParamList, 'CompletedOrdersArchive'>;
type PricingNav = NativeStackNavigationProp<PricingStackParamList>;

/** Legacy route — redirects to the unified status list screen. */
const CompletedOrdersArchiveScreen: React.FC = () => {
  const {theme} = useTheme();
  const navigation = useNavigation<PricingNav>();
  const {params} = useRoute<CompletedOrdersArchiveRoute>();

  useEffect(() => {
    navigation.replace('OrdersByStatus', {
      status: 'completed',
      outstandingOnly: params?.outstandingOnly,
      focusOrderId: params?.focusOrderId,
      focusToken: params?.focusToken,
      ordersHomeCardId: params?.ordersHomeCardId,
    });
  }, [
    navigation,
    params?.focusOrderId,
    params?.focusToken,
    params?.ordersHomeCardId,
    params?.outstandingOnly,
  ]);

  return (
    <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
      <View style={[styles.loader, {backgroundColor: theme.colors.background}]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CompletedOrdersArchiveScreen;
