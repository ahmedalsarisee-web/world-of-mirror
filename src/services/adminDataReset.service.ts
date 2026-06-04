import {isMockMode} from '@app/config/appMode';
import {useMockDb} from '@app/mock/mockDb';
import {loadUserProfile} from '@app/services/auth.service';
import type {AppUser} from '@app/types/models';
import {isPrimaryAdmin} from '@app/utils/adminPermissions';
import {deleteAllAttendanceRecords} from '@app/services/attendance.service';
import {deleteAllConfirmedOrders} from '@app/services/confirmedOrders.service';
import {deleteAllTransactions} from '@app/services/transactions.service';
import {resetAllUsersBusinessData} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import {useMirrorPricingCartStore} from '@app/stores/mirrorPricingCartStore';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';

function clearLocalMirrorPricingData(): void {
  useMirrorPricingCartStore.getState().clearCart();
  useMirrorPricingConfirmedOrdersStore.getState().clearAllOrders();
}

export async function clearAllBusinessData(
  actor: AppUser | null,
  authEmail: string | null,
): Promise<void> {
  if (!isPrimaryAdmin(actor, authEmail)) {
    throw new Error('FORBIDDEN');
  }

  if (isMockMode) {
    useMockDb.getState().clearAllBusinessRecords();
  } else {
    await deleteAllTransactions();
    await deleteAllAttendanceRecords();
    await deleteAllConfirmedOrders();
    await resetAllUsersBusinessData();
  }

  clearLocalMirrorPricingData();
  await refreshSignedInUserProfile();
}

async function refreshSignedInUserProfile(): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) {
    return;
  }

  if (isMockMode) {
    const refreshed = useMockDb.getState().users.find((user) => user.id === userId) ?? null;
    useAuthStore.setState({user: refreshed});
    return;
  }

  const profile = await loadUserProfile(userId);
  useAuthStore.setState({user: profile});
}
