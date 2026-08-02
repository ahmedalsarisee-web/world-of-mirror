import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useLanguage} from '@app/context/LangContext';
import {useTheme} from '@app/context/ThemeContext';
import {getStackScreenOptions} from '@app/navigation/stackScreenOptions';
import EmployeeAttendanceViewScreen from '@app/screens/attendance/EmployeeAttendanceViewScreen';
import MyAttendanceScreen from '@app/screens/attendance/MyAttendanceScreen';
import TeamAttendanceListScreen from '@app/screens/attendance/TeamAttendanceListScreen';
import type {AttendanceStackParamList} from '@app/types/navigation';

const Stack = createNativeStackNavigator<AttendanceStackParamList>();

const AttendanceNavigator: React.FC = () => {
  const {theme} = useTheme();
  const {language} = useLanguage();

  return (
    <Stack.Navigator screenOptions={getStackScreenOptions(theme, language)}>
      <Stack.Screen name="MyAttendance" component={MyAttendanceScreen} options={{headerShown: false}} />
      <Stack.Screen name="TeamAttendanceList" component={TeamAttendanceListScreen} options={{headerShown: false}} />
      <Stack.Screen
        name="EmployeeAttendanceView"
        component={EmployeeAttendanceViewScreen}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
};

export default AttendanceNavigator;
