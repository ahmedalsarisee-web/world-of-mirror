import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {useFonts} from 'expo-font';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Provider} from 'react-redux';
import {initializeI18n} from '@app/I18n';
import {LangProvider} from '@app/context/LangContext';
import {ThemeProvider} from '@app/context/ThemeContext';
import AppNavigator from '@app/navigation/AppNavigator';
import {store} from '@app/store/store';
import {useAuthStore} from '@app/stores/authStore';

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Akt: require('./assets/fonts/Akt.ttf'),
    Cairo: require('./assets/fonts/Cairo.ttf'),
  });

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
    const unsubscribeAuth = useAuthStore.getState().initialize();
    void initializeI18n().finally(() => setI18nReady(true));
    return unsubscribeAuth;
  }, []);

  if (!fontsLoaded || !i18nReady) {
    return <View style={styles.boot} />;
  }

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

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
