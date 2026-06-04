import React from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import EmployeeFinanceHubPanel from '@app/components/finance/EmployeeFinanceHubPanel';
import type {FinanceStackParamList} from '@app/types/navigation';

type Route = RouteProp<FinanceStackParamList, 'EmployeeFinanceHub'>;
type Nav = NativeStackNavigationProp<FinanceStackParamList, 'EmployeeFinanceHub'>;

const EmployeeFinanceHubScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId, userName} = route.params;

  return (
    <EmployeeFinanceHubPanel
      userId={userId}
      userName={userName}
      onOpenCashAccount={() => navigation.navigate('EmployeeAccount', {userId, userName})}
      onOpenSalaryAdvance={() => navigation.navigate('EmployeeAdvance', {userId, userName})}
      onOpenCustomLedger={(ledgerId, ledgerName, ledgerColor) =>
        navigation.navigate('EmployeeCustomLedger', {userId, userName, ledgerId, ledgerName, ledgerColor})
      }
    />
  );
};

export default EmployeeFinanceHubScreen;
