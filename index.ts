import 'react-native-gesture-handler';
import {registerRootComponent} from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import {getFirebaseAuth, getFirebaseDb, isFirebaseConfigured} from '@app/config/firebase';
import {initializeI18n} from '@app/I18n';

import App from './App';

SplashScreen.setOptions({
  duration: 0,
  fade: false,
});

void initializeI18n();

if (isFirebaseConfigured) {
  getFirebaseAuth();
  getFirebaseDb();
}

registerRootComponent(App);
