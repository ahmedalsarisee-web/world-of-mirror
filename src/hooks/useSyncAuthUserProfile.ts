import {useEffect} from 'react';
import {subscribeToUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';

/** Keeps auth store profile in sync (permissions, balance, etc.) while the user is signed in. */
export function useSyncAuthUserProfile(): void {
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (!userId) {
      return;
    }

    return subscribeToUser(userId, (profile) => {
      if (!profile) {
        return;
      }
      useAuthStore.setState((state) => {
        const current = state.user;
        if (!current || current.id !== profile.id) {
          return state;
        }

        const permissionsUnchanged =
          JSON.stringify(current.permissions ?? null) === JSON.stringify(profile.permissions ?? null);
        const adminPermissionsUnchanged =
          JSON.stringify(current.adminPermissions ?? null) ===
          JSON.stringify(profile.adminPermissions ?? null);
        const attendanceMetaUnchanged =
          current.attendanceLastResetBoundary === profile.attendanceLastResetBoundary &&
          JSON.stringify(current.attendanceResetSchedule ?? null) ===
            JSON.stringify(profile.attendanceResetSchedule ?? null) &&
          current.balance === profile.balance &&
          current.name === profile.name;

        if (permissionsUnchanged && adminPermissionsUnchanged && attendanceMetaUnchanged) {
          return state;
        }

        return {user: profile};
      });
    });
  }, [userId]);
}
