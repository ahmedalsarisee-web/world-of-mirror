import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useLanguage} from '@app/context/LangContext';
import {useTheme} from '@app/context/ThemeContext';
import {getStackScreenOptions} from '@app/navigation/stackScreenOptions';
import AttendanceWorkplaceSettingsScreen from '@app/screens/Settings/AttendanceWorkplaceSettingsScreen';
import SettingsScreen from '@app/screens/Settings/SettingsScreen';
import type {SettingsStackParamList} from '@app/types/navigation';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

const SettingsNavigator: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {language} = useLanguage();

  return (
    <Stack.Navigator screenOptions={getStackScreenOptions(theme, language)}>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} options={{headerShown: false}} />
      <Stack.Screen
        name="AttendanceWorkplaceSettings"
        component={AttendanceWorkplaceSettingsScreen}
        options={{title: t('settingsAttendanceWorkplaceTitle')}}
      />
    </Stack.Navigator>
  );
};

export default SettingsNavigator;
