import {useEffect, useState} from 'react';
import {InteractionManager} from 'react-native';
import {isMockMode} from '@app/config/appMode';
import {
  ensureConfirmedOrdersIndexMigrated,
  subscribeToConfirmedOrders,
} from '@app/services/confirmedOrders.service';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import {
  isOrdersBackgroundSyncEnabled,
  subscribeOrdersBackgroundSyncEnabled,
} from '@app/utils/ordersSyncGate';

export function useConfirmedOrdersSync(active: boolean): void {
  const [backgroundSyncEnabled, setBackgroundSyncEnabled] = useState(isOrdersBackgroundSyncEnabled);

  useEffect(() => {
    return subscribeOrdersBackgroundSyncEnabled(() => {
      setBackgroundSyncEnabled(true);
    });
  }, []);

  useEffect(() => {
    if (!active || !backgroundSyncEnabled || isMockMode) {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const migrationTask = InteractionManager.runAfterInteractions(() => {
      void ensureConfirmedOrdersIndexMigrated().catch(() => undefined);
    });

    const startTask = InteractionManager.runAfterInteractions(() => {
      if (cancelled) {
        return;
      }

      unsubscribe = subscribeToConfirmedOrders((orders) => {
        const store = useMirrorPricingConfirmedOrdersStore.getState();
        const snapshotIds = new Set(orders.map((entry) => entry.id));
        for (const pendingId of store.pendingDeletedOrderIds) {
          if (!snapshotIds.has(pendingId)) {
            store.acknowledgePendingDeletedOrder(pendingId);
          }
        }
        store.upsertOrders(orders);
      });
    });

    return () => {
      cancelled = true;
      migrationTask.cancel();
      startTask.cancel();
      unsubscribe?.();
    };
  }, [active, backgroundSyncEnabled]);
}
