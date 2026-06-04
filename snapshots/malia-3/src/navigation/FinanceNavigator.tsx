import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useLanguage} from '@app/context/LangContext';
import {useTheme} from '@app/context/ThemeContext';
import {getStackScreenOptions} from '@app/navigation/stackScreenOptions';
import FinanceHomeScreen from '@app/screens/finance/FinanceHomeScreen';
import EmployeeFinanceHubScreen from '@app/screens/finance/EmployeeFinanceHubScreen';
import EmployeeAccountScreen from '@app/screens/finance/EmployeeAccountScreen';
import EmployeeAdvanceScreen from '@app/screens/finance/EmployeeAdvanceScreen';
import EmployeeCustomLedgerScreen from '@app/screens/finance/EmployeeCustomLedgerScreen';
import type {FinanceStackParamList} from '@app/types/navigation';

const Stack = createNativeStackNavigator<FinanceStackParamList>();

const FinanceNavigator: React.FC = () => {
  const {theme} = useTheme();
  const {language} = useLanguage();
  return (
    <Stack.Navigator screenOptions={getStackScreenOptions(theme, language)}>
      <Stack.Screen name="FinanceHome" component={FinanceHomeScreen} options={{headerShown: false}} />
      <Stack.Screen
        name="EmployeeFinanceHub"
        component={EmployeeFinanceHubScreen}
        options={({route}) => ({title: route.params.userName})}
      />
      <Stack.Screen name="EmployeeAccount" component={EmployeeAccountScreen} />
      <Stack.Screen name="EmployeeAdvance" component={EmployeeAdvanceScreen} />
      <Stack.Screen name="EmployeeCustomLedger" component={EmployeeCustomLedgerScreen} />
    </Stack.Navigator>
  );
};

export default FinanceNavigator;
