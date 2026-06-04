import {registerRootComponent} from 'expo';
import {getFirebaseAuth, getFirebaseDb, isFirebaseConfigured} from '@app/config/firebase';
import {initializeI18n} from '@app/I18n';

import App from './App';

void initializeI18n();

if (isFirebaseConfigured) {
  getFirebaseAuth();
  getFirebaseDb();
}

registerRootComponent(App);
