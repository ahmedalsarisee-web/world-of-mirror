import {useEffect} from 'react';
import {InteractionManager} from 'react-native';
import {isMockMode} from '@app/config/appMode';
import {prefetchConfirmedOrdersListPages} from '@app/services/confirmedOrders.service';
import type {OrdersHomeCardConfig} from '@app/types/ordersHomeCard';
import {resolveOrdersHomeCardListParams} from '@app/utils/ordersHomeCardListParams';

export function usePrefetchOrdersHomeLists(cards: OrdersHomeCardConfig[], enabled = true): void {
  useEffect(() => {
    if (!enabled || isMockMode || cards.length === 0) {
      return;
    }

    const params = cards
      .map((card) => resolveOrdersHomeCardListParams(card))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    if (params.length === 0) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      void prefetchConfirmedOrdersListPages(params);
    });

    return () => {
      task.cancel();
    };
  }, [cards, enabled]);
}
