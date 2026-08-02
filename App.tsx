import React, {useEffect} from 'react';
import * as SplashScreen from 'expo-splash-screen';
import {useFonts} from 'expo-font';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Provider} from 'react-redux';
import {LangProvider} from '@app/context/LangContext';
import {ThemeProvider} from '@app/context/ThemeContext';
import AppNavigator from '@app/navigation/AppNavigator';
import {bootstrapNotificationSystem} from '@app/services/notifications.service';
import {store} from '@app/store/store';
import {useAuthStore} from '@app/stores/authStore';

export default function App() {
  useFonts({
    Akt: require('./assets/fonts/Akt.ttf'),
    Cairo: require('./assets/fonts/Cairo.ttf'),
  });

  useEffect(() => {
    SplashScreen.hide();
    const unsubscribeAuth = useAuthStore.getState().initialize();
    void bootstrapNotificationSystem();
    return unsubscribeAuth;
  }, []);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LangProvider>
            <AppNavigator />
          </LangProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
}
