import {useEffect, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {subscribeToTodayAttendance} from '@app/services/attendance.service';
import {getFinanceAccounts} from '@app/services/users.service';
import {useUsersDirectory} from '@app/hooks/useUsersDirectory';
import {useFinanceAccountTransactions} from '@app/hooks/useFinanceAccountTransactions';
import {
  ensureNotificationPermissions,
  notifyAdminAttendanceEvent,
  notifyAdminConfirmedOrder,
  notifyAdminFinanceTransaction,
} from '@app/services/notifications.service';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, AttendanceRecord, Transaction} from '@app/types/models';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {getAuthSessionUserId} from '@app/utils/authSession';
import {resolveFinanceTransactionActorName} from '@app/utils/financeNotificationMessage';

/** Firestore-driven admin alerts (works with Firebase while the admin app is running). */
export function useAdminEventNotifications(enabled: boolean): void {
  const {t} = useTranslation();
  const currentUser = useAuthStore((state) => state.user);
  const canSubscribeTodayAttendance = currentUser?.role === 'admin';
  const {users} = useUsersDirectory('all', enabled);
  const financeAccountUserIds = useMemo(
    () => getFinanceAccounts(users).map((user) => user.id),
    [users],
  );
  const {transactions} = useFinanceAccountTransactions(financeAccountUserIds, enabled);
  const usersRef = useRef<AppUser[]>([]);
  const seenTransactionIdsRef = useRef<Set<string>>(new Set());
  const seenAttendanceIdsRef = useRef<Set<string>>(new Set());
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const primedTransactionsRef = useRef(false);
  const primedAttendanceRef = useRef(false);
  const primedOrdersRef = useRef(false);
  const deliveryOptions = {showNative: false};

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void ensureNotificationPermissions().catch(() => undefined);
  }, [enabled]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    if (!enabled) {
      primedTransactionsRef.current = false;
      seenTransactionIdsRef.current = new Set();
      return;
    }

    if (!primedTransactionsRef.current) {
      transactions.forEach((transaction) => seenTransactionIdsRef.current.add(transaction.id));
      primedTransactionsRef.current = true;
      return;
    }

    for (const transaction of transactions) {
      if (seenTransactionIdsRef.current.has(transaction.id)) {
        continue;
      }

      seenTransactionIdsRef.current.add(transaction.id);
      const accountName =
        usersRef.current.find((user) => user.id === transaction.userId)?.name ?? transaction.userId;
      const actorName = resolveFinanceTransactionActorName(
        transaction,
        usersRef.current,
        accountName,
        t,
      );
      void notifyAdminFinanceTransaction(transaction, accountName, actorName, t, deliveryOptions);
    }
  }, [enabled, t, transactions]);

  useEffect(() => {
    if (!enabled || !canSubscribeTodayAttendance) {
      primedAttendanceRef.current = false;
      seenAttendanceIdsRef.current = new Set();
      return;
    }

    const notifyAttendance = (records: AttendanceRecord[]) => {
      if (!primedAttendanceRef.current) {
        records.forEach((record) => seenAttendanceIdsRef.current.add(record.id));
        primedAttendanceRef.current = true;
        return;
      }

      for (const record of records) {
        if (record.type !== 'check_in' && record.type !== 'check_out') {
          continue;
        }

        if (seenAttendanceIdsRef.current.has(record.id)) {
          continue;
        }

        seenAttendanceIdsRef.current.add(record.id);
        const employeeName =
          usersRef.current.find((user) => user.id === record.userId)?.name ?? record.userId;
        void notifyAdminAttendanceEvent(record, employeeName, t, deliveryOptions);
      }
    };

    const unsubAttendance = subscribeToTodayAttendance(notifyAttendance);

    return () => {
      unsubAttendance();
      primedAttendanceRef.current = false;
      seenAttendanceIdsRef.current = new Set();
    };
  }, [canSubscribeTodayAttendance, enabled, t]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const notifyOrders = (orders: MirrorPricingConfirmedOrder[]) => {
      if (!primedOrdersRef.current) {
        orders.forEach((order) => seenOrderIdsRef.current.add(order.id));
        primedOrdersRef.current = true;
        return;
      }

      for (const order of orders) {
        if (seenOrderIdsRef.current.has(order.id)) {
          continue;
        }

        seenOrderIdsRef.current.add(order.id);
        const currentUserId = getAuthSessionUserId();
        if (order.confirmedByUserId && order.confirmedByUserId === currentUserId) {
          continue;
        }
        void notifyAdminConfirmedOrder(order, t, deliveryOptions);
      }
    };

    notifyOrders(useMirrorPricingConfirmedOrdersStore.getState().orders);
    return useMirrorPricingConfirmedOrdersStore.subscribe((state) => {
      notifyOrders(state.orders);
    });
  }, [enabled, t]);
}
