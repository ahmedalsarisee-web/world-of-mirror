import {useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {isMockMode} from '@app/config/appMode';
import {subscribeToAllAttendance} from '@app/services/attendance.service';
import {subscribeToConfirmedOrders} from '@app/services/confirmedOrders.service';
import {subscribeToAllTransactions} from '@app/services/transactions.service';
import {subscribeToUsers} from '@app/services/users.service';
import {
  ensureNotificationPermissions,
  notifyAdminAttendanceEvent,
  notifyAdminConfirmedOrder,
  notifyAdminFinanceTransaction,
} from '@app/services/notifications.service';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import type {AppUser, AttendanceRecord, Transaction} from '@app/types/models';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';

/** Firestore-driven admin alerts (works with Firebase while the admin app is running). */
export function useAdminEventNotifications(enabled: boolean): void {
  const {t} = useTranslation();
  const usersRef = useRef<AppUser[]>([]);
  const seenTransactionIdsRef = useRef<Set<string>>(new Set());
  const seenAttendanceIdsRef = useRef<Set<string>>(new Set());
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const primedTransactionsRef = useRef(false);
  const primedAttendanceRef = useRef(false);
  const primedOrdersRef = useRef(false);
  const deliveryOptions = {showNative: true};

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void ensureNotificationPermissions().catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const unsubUsers = subscribeToUsers((users) => {
      usersRef.current = users;
    });

    const notifyTransactions = (transactions: Transaction[]) => {
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
        void notifyAdminFinanceTransaction(transaction, accountName, t, deliveryOptions);
      }
    };

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

    const unsubTransactions = subscribeToAllTransactions(notifyTransactions);
    const unsubAttendance = subscribeToAllAttendance(notifyAttendance);

    return () => {
      unsubUsers();
      unsubTransactions();
      unsubAttendance();
      primedTransactionsRef.current = false;
      primedAttendanceRef.current = false;
      seenTransactionIdsRef.current = new Set();
      seenAttendanceIdsRef.current = new Set();
    };
  }, [enabled, t]);

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
        void notifyAdminConfirmedOrder(order, t, deliveryOptions);
      }
    };

    if (isMockMode) {
      notifyOrders(useMirrorPricingConfirmedOrdersStore.getState().orders);
      return useMirrorPricingConfirmedOrdersStore.subscribe((state) => {
        notifyOrders(state.orders);
      });
    }

    return subscribeToConfirmedOrders(notifyOrders);
  }, [enabled, t]);
}
