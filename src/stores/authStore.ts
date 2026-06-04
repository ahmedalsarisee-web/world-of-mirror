import {create} from 'zustand';
import type {AppUser} from '@app/types/models';
import {isMockMode} from '@app/config/appMode';
import {isFirebaseConfigured} from '@app/config/firebase';
import {StorageKeys} from '@app/constants/StorageKeys';
import {useMockDb} from '@app/mock/mockDb';
import {loadUserProfile, signIn, signOut, subscribeToAuth} from '@app/services/auth.service';
import {syncPrimaryAdminProfile} from '@app/services/users.service';
import {storage} from '@app/utils/storage';

interface AuthState {
  user: AppUser | null;
  authEmail: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  initialize: () => () => void;
  login: (email: string, password: string) => Promise<void>;
  loginAsMock: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  authEmail: null,
  isLoading: false,
  isInitialized: false,
  error: null,

  initialize: () => {
    if (isMockMode) {
      void (async () => {
        const savedId = await storage.getString(StorageKeys.MOCK_SESSION);
        const user = savedId
          ? useMockDb.getState().users.find((u) => u.id === savedId) ?? null
          : null;
        set({user, authEmail: user?.email ?? null, isInitialized: true, isLoading: false});
      })();
      return () => undefined;
    }

    void storage.delete(StorageKeys.MOCK_SESSION);

    if (!isFirebaseConfigured) {
      set({isInitialized: true, isLoading: false, user: null, authEmail: null});
      return () => undefined;
    }

    const unsubscribe = subscribeToAuth(async (firebaseUser) => {
      if (firebaseUser) {
        await syncPrimaryAdminProfile(firebaseUser.uid, firebaseUser.email);
        const profile = await loadUserProfile(firebaseUser.uid);
        if (!profile) {
          await signOut();
          set({user: null, authEmail: null, isInitialized: true, isLoading: false});
          return;
        }
        set({
          user: profile,
          authEmail: firebaseUser.email ?? profile.email ?? null,
          isInitialized: true,
          isLoading: false,
        });
      } else {
        set({user: null, authEmail: null, isInitialized: true, isLoading: false});
      }
    });
    return unsubscribe;
  },

  login: async (email, password) => {
    if (isMockMode) {
      set({error: 'Use demo login buttons in mock mode.', isLoading: false});
      return;
    }
    set({isLoading: true, error: null});
    try {
      const profile = await signIn(email, password);
      set({user: profile, authEmail: email.trim().toLowerCase(), isLoading: false});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({error: message, isLoading: false});
      throw err;
    }
  },

  loginAsMock: async (userId) => {
    set({isLoading: true, error: null});
    const profile = useMockDb.getState().users.find((u) => u.id === userId);
    if (!profile) {
      set({error: 'Demo user not found', isLoading: false});
      return;
    }
    await storage.set(StorageKeys.MOCK_SESSION, userId);
    set({user: {...profile}, authEmail: profile.email ?? null, isLoading: false});
  },

  logout: async () => {
    set({isLoading: true});
    if (isMockMode) {
      await storage.delete(StorageKeys.MOCK_SESSION);
      set({user: null, authEmail: null, isLoading: false});
      return;
    }
    await signOut();
    set({user: null, authEmail: null, isLoading: false});
  },

  clearError: () => set({error: null}),
}));
