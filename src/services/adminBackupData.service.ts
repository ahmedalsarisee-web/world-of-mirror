import Constants from 'expo-constants';
import {getAllTransactions} from '@app/services/transactions.service';
import {getAllUsers} from '@app/services/users.service';
import {subscribeToAllAttendance} from '@app/services/attendance.service';
import {subscribeToOrdersHomeCards} from '@app/services/ordersHomeCards.service';
import {subscribeToAttendanceWorkplace} from '@app/services/attendanceWorkplace.service';
import {getAllConfirmedOrders} from '@app/services/confirmedOrders.service';
import type {AppUser, AttendanceRecord, AttendanceWorkplace, Transaction} from '@app/types/models';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import type {OrdersHomeCardConfig} from '@app/types/ordersHomeCard';
import {getAttendanceWorkplace} from '@app/utils/attendanceWorkplace';
import {subscribeOnce} from '@app/utils/firestoreSubscriptionOnce';

export interface AdminBackupSnapshot {
  exportedAt: string;
  exportedByName: string;
  exportedByEmail: string | null;
  appVersion: string;
  users: AppUser[];
  transactions: Transaction[];
  attendance: AttendanceRecord[];
  orders: MirrorPricingConfirmedOrder[];
  ordersHomeCards: OrdersHomeCardConfig[];
  attendanceWorkplace: AttendanceWorkplace;
}

export async function collectAdminBackupData(
  actor: AppUser | null,
  authEmail: string | null,
): Promise<AdminBackupSnapshot> {
  if (!actor || actor.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }

  const users = await getAllUsers();
  const [transactions, attendance, orders, ordersHomeCards] = await Promise.all([
    getAllTransactions(users),
    subscribeOnce(subscribeToAllAttendance),
    getAllConfirmedOrders(),
    subscribeOnce(subscribeToOrdersHomeCards),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    exportedByName: actor.name,
    exportedByEmail: actor.email ?? authEmail,
    appVersion: Constants.expoConfig?.version ?? '1.0.0',
    users,
    transactions,
    attendance,
    orders,
    ordersHomeCards,
    attendanceWorkplace: getAttendanceWorkplace(),
  };
}
