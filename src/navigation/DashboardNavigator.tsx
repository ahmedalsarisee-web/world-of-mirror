import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useLanguage} from '@app/context/LangContext';
import {useTheme} from '@app/context/ThemeContext';
import {getStackScreenOptions} from '@app/navigation/stackScreenOptions';
import HomeScreenRouter from '@app/screens/dashboard/HomeScreenRouter';
import type {DashboardStackParamList} from '@app/types/navigation';

const Stack = createNativeStackNavigator<DashboardStackParamList>();

const DashboardNavigator: React.FC = () => {
  const {theme} = useTheme();
  const {language} = useLanguage();

  return (
    <Stack.Navigator screenOptions={getStackScreenOptions(theme, language)}>
      <Stack.Screen name="DashboardHome" component={HomeScreenRouter} options={{headerShown: false}} />
    </Stack.Navigator>
  );
};

export default DashboardNavigator;
