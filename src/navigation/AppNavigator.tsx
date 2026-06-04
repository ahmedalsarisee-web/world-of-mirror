import React, {useMemo} from 'react';
import {ActivityIndicator, I18nManager, StyleSheet, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {navigationRef} from '@app/RootNavigation';
import AuthNavigator from '@app/navigation/AuthNavigator';
import MainTabNavigator from '@app/navigation/MainTabNavigator';
import {buildNavigationTheme} from '@app/navigation/navigationTheme';
import {useLanguage} from '@app/context/LangContext';
import {useTheme} from '@app/context/ThemeContext';
import {useAuthStore} from '@app/stores/authStore';
import AdminNotificationsBridge from '@app/components/notifications/AdminNotificationsBridge';
import {useSyncAuthUserProfile} from '@app/hooks/useSyncAuthUserProfile';
import type {RootStackParamList} from '@app/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const {user, isInitialized} = useAuthStore();
  const {language} = useLanguage();
  const navigationDirection = I18nManager.isRTL ? 'rtl' : 'ltr';
  const {theme, themeType} = useTheme();
  const navigationTheme = useMemo(
    () => buildNavigationTheme(theme, themeType, language),
    [language, theme, themeType],
  );

  useSyncAuthUserProfile();

  if (!isInitialized) {
    return (
      <View style={[styles.loading, {backgroundColor: theme.backgrounds.background}]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} direction={navigationDirection} theme={navigationTheme}>
      <AdminNotificationsBridge />
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loading: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

export default AppNavigator;
