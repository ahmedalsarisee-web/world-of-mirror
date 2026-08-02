import {create} from 'zustand';
import type {AppUser} from '@app/types/models';
import {isMockMode} from '@app/config/appMode';
import {isFirebaseConfigured} from '@app/config/firebase';
import {StorageKeys} from '@app/constants/StorageKeys';
import {useMockDb} from '@app/mock/mockDb';
import {loadUserProfile, signIn, signOut, subscribeToAuth} from '@app/services/auth.service';
import {unregisterAdminPushNotifications} from '@app/services/pushNotifications.service';
import {isArchivedEmployee, syncUserProfileEmail} from '@app/services/users.service';
import {readCachedAuthProfile, writeCachedAuthProfile} from '@app/utils/authProfileCache';
import {syncAuthSession} from '@app/utils/authSession';
import {storage} from '@app/utils/storage';

let logoutInProgress = false;

async function waitForReactTeardown(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

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
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      if (isMockMode) {
        const savedId = await storage.getString(StorageKeys.MOCK_SESSION);
        const savedUser = savedId
          ? useMockDb.getState().users.find((u) => u.id === savedId) ?? null
          : null;
        if (savedUser && isArchivedEmployee(savedUser)) {
          await storage.delete(StorageKeys.MOCK_SESSION);
          set({user: null, authEmail: null, isInitialized: true, isLoading: false});
          return;
        }
        set({user: savedUser, authEmail: savedUser?.email ?? null, isInitialized: true, isLoading: false});
        return;
      }

      void storage.delete(StorageKeys.MOCK_SESSION);

      if (!isFirebaseConfigured) {
        set({isInitialized: true, isLoading: false, user: null, authEmail: null});
        return;
      }

      const cachedProfile = await readCachedAuthProfile();
      if (cachedProfile && !isArchivedEmployee(cachedProfile)) {
        set({
          user: cachedProfile,
          authEmail: cachedProfile.email ?? null,
          isInitialized: true,
          isLoading: false,
        });
      }

      unsubscribe = subscribeToAuth((firebaseUser) => {
        void (async () => {
          try {
            if (!firebaseUser) {
              await writeCachedAuthProfile(null).catch(() => undefined);
              set({user: null, authEmail: null, isInitialized: true, isLoading: false});
              return;
            }

            if (logoutInProgress) {
              return;
            }

            void syncUserProfileEmail(firebaseUser.uid, firebaseUser.email).catch(() => undefined);
            const profile = await loadUserProfile(firebaseUser.uid);
            if (logoutInProgress) {
              return;
            }

            if (profile && isArchivedEmployee(profile)) {
              await signOut().catch(() => undefined);
              await writeCachedAuthProfile(null).catch(() => undefined);
              set({user: null, authEmail: null, isInitialized: true, isLoading: false});
              return;
            }

            if (profile) {
              await writeCachedAuthProfile(profile).catch(() => undefined);
              set({
                user: profile,
                authEmail: firebaseUser.email ?? profile.email ?? null,
                isInitialized: true,
                isLoading: false,
              });
              return;
            }

            const cachedProfile = await readCachedAuthProfile();
            const currentUser = useAuthStore.getState().user;
            const fallbackProfile =
              cachedProfile?.id === firebaseUser.uid
                ? cachedProfile
                : currentUser?.id === firebaseUser.uid
                  ? currentUser
                  : null;

            if (fallbackProfile && !isArchivedEmployee(fallbackProfile)) {
              console.warn('[authStore] profile unavailable, keeping signed-in session');
              set({
                user: fallbackProfile,
                authEmail: firebaseUser.email ?? fallbackProfile.email ?? null,
                isInitialized: true,
                isLoading: false,
              });
              return;
            }

            console.warn('[authStore] signed in but profile missing; keeping Firebase session');
            set((state) => ({
              isInitialized: true,
              isLoading: false,
              authEmail: firebaseUser.email ?? state.authEmail,
            }));
          } catch (error) {
            console.warn('[authStore] profile sync failed', error);
            if (!firebaseUser || logoutInProgress) {
              set({isInitialized: true, isLoading: false});
              return;
            }

            const cachedProfile = await readCachedAuthProfile().catch(() => null);
            const currentUser = useAuthStore.getState().user;
            const fallbackProfile =
              cachedProfile?.id === firebaseUser.uid
                ? cachedProfile
                : currentUser?.id === firebaseUser.uid
                  ? currentUser
                  : null;

            if (fallbackProfile && !isArchivedEmployee(fallbackProfile)) {
              set({
                user: fallbackProfile,
                authEmail: firebaseUser.email ?? fallbackProfile.email ?? null,
                isInitialized: true,
                isLoading: false,
              });
              return;
            }

            set((state) => ({
              isInitialized: true,
              isLoading: false,
              authEmail: firebaseUser.email ?? state.authEmail,
            }));
          }
        })();
      });
    })();

    return () => {
      unsubscribe?.();
    };
  },

  login: async (email, password) => {
    if (isMockMode) {
      set({error: 'Use demo login buttons in mock mode.', isLoading: false});
      return;
    }
    set({isLoading: true, error: null});
    try {
      const profile = await signIn(email, password);
      await writeCachedAuthProfile(profile);
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
    if (!profile || isArchivedEmployee(profile)) {
      set({error: 'Demo user not found', isLoading: false});
      return;
    }
    await storage.set(StorageKeys.MOCK_SESSION, userId);
    set({user: {...profile}, authEmail: profile.email ?? null, isLoading: false});
  },

  logout: async () => {
    if (logoutInProgress) {
      return;
    }

    logoutInProgress = true;
    set({isLoading: true});

    const userId = useAuthStore.getState().user?.id;

    try {
      if (isMockMode) {
        await storage.delete(StorageKeys.MOCK_SESSION);
        set({user: null, authEmail: null, isLoading: false});
        return;
      }

      if (userId) {
        await unregisterAdminPushNotifications(userId).catch(() => undefined);
      }

      set({user: null, authEmail: null});
      await writeCachedAuthProfile(null).catch(() => undefined);
      await waitForReactTeardown();
      await signOut();
      await writeCachedAuthProfile(null).catch(() => undefined);
    } catch (error) {
      console.warn('[authStore] logout failed', error);
      await signOut().catch(() => undefined);
      await writeCachedAuthProfile(null).catch(() => undefined);
      set({user: null, authEmail: null});
    } finally {
      set({isLoading: false});
      logoutInProgress = false;
    }
  },

  clearError: () => set({error: null}),
}));

syncAuthSession(useAuthStore.getState().user);
useAuthStore.subscribe((state) => {
  syncAuthSession(state.user);
});
