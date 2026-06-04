import {isFirebaseConfigured} from '@app/config/firebase';

const useMockDataFlag = process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true';

/**
 * Demo / mock data is development-only. Release APKs must use Firebase email/password auth.
 * Previously, missing Firebase keys in the release bundle enabled mock mode and could restore
 * a saved demo admin session without login.
 */
export const isMockMode =
  __DEV__ && (useMockDataFlag || !isFirebaseConfigured);
