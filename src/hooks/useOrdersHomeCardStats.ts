import {useCallback, useEffect, useMemo, useState} from 'react';
import {InteractionManager} from 'react-native';
import {
  filterConfirmedOrdersForListParams,
  getConfirmedOrdersListCount,
  getPaymentFollowUpCountForListBucket,
} from '@app/services/confirmedOrders.service';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import {useOrdersHomeUiStore} from '@app/stores/ordersHomeUiStore';
import type {OrdersHomeCardConfig} from '@app/types/ordersHomeCard';
import type {ConfirmedOrderListBucket} from '@app/utils/confirmedOrderListBucket';
import {resolveConfirmedOrderIndexFields} from '@app/utils/confirmedOrderListBucket';
import type {OrdersHomeCardDisplayStats} from '@app/utils/ordersHomeCardNavigation';
import {resolveOrdersHomeCardListParams} from '@app/utils/ordersHomeCardListParams';

function resolveCardListBucket(card: OrdersHomeCardConfig): ConfirmedOrderListBucket | null {
  const params = resolveOrdersHomeCardListParams(card);
  if (!params) {
    return null;
  }

  if (params.homeCardId) {
    return `card:${params.homeCardId}`;
  }

  return params.statusFilter ?? 'preparation';
}

function buildLocalCardStats(
  cards: OrdersHomeCardConfig[],
): Map<string, OrdersHomeCardDisplayStats> {
  const storeOrders = useMirrorPricingConfirmedOrdersStore.getState().orders;
  const entries = cards.map((card) => {
    const listParams = resolveOrdersHomeCardListParams(card);
    const listBucket = resolveCardListBucket(card);
    if (!listParams || !listBucket) {
      return [card.id, {paymentAlert: false, paymentAlertCount: 0}] as const;
    }

    const matching = filterConfirmedOrdersForListParams(storeOrders, listParams);
    const badge = matching.length;
    const paymentAlertCount = matching.filter(
      (order) =>
        resolveConfirmedOrderIndexFields(order).listBucket === listBucket &&
        order.paymentFollowUpRequired === true,
    ).length;

    return [
      card.id,
      {
        badge: badge > 0 ? badge : undefined,
        paymentAlert: paymentAlertCount > 0,
        paymentAlertCount,
      },
    ] as const;
  });

  return new Map(entries);
}

export function useOrdersHomeCardStats(cards: OrdersHomeCardConfig[], enabled = true) {
  const [statsByCardId, setStatsByCardId] = useState<Map<string, OrdersHomeCardDisplayStats>>(
    () => new Map(),
  );
  const cardsKey = useMemo(() => cards.map((card) => card.id).join('|'), [cards]);
  const cardStatsRevision = useOrdersHomeUiStore((state) => state.cardStatsRevision);

  const refresh = useCallback(async () => {
    if (!enabled || cards.length === 0) {
      setStatsByCardId(new Map());
      return;
    }

    // Immediate local estimate so badges update as soon as the user returns home.
    setStatsByCardId(buildLocalCardStats(cards));

    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });

    try {
      const entries = await Promise.all(
        cards.map(async (card) => {
          const listParams = resolveOrdersHomeCardListParams(card);
          const listBucket = resolveCardListBucket(card);
          if (!listParams || !listBucket) {
            return [card.id, {paymentAlert: false, paymentAlertCount: 0}] as const;
          }

          const [badge, paymentAlertCount] = await Promise.all([
            getConfirmedOrdersListCount(listParams),
            getPaymentFollowUpCountForListBucket(listBucket),
          ]);

          return [
            card.id,
            {
              badge: badge > 0 ? badge : undefined,
              paymentAlert: paymentAlertCount > 0,
              paymentAlertCount,
            },
          ] as const;
        }),
      );

      setStatsByCardId(new Map(entries));
    } catch {
      // keep previous / local stats on failure
    }
  }, [cards, cardsKey, enabled]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void refresh();
    });
    return () => {
      task.cancel();
    };
  }, [refresh, cardStatsRevision]);

  return {statsByCardId, refresh};
}

export function useConfirmedOrdersTabBadge(enabled = true) {
  const [count, setCount] = useState(0);
  const cardStatsRevision = useOrdersHomeUiStore((state) => state.cardStatsRevision);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(() => {
      void getConfirmedOrdersListCount({statusFilter: 'preparation'})
        .then((nextCount) => {
          if (!cancelled) {
            setCount(nextCount);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCount(0);
          }
        });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [cardStatsRevision, enabled]);

  return count;
}
