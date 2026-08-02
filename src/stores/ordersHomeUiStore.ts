import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';

export type OrdersHomeCardsLayout = 'list' | 'grid';

/** Bumped when the orders tab returns to OrdersHome so search text is cleared. */
interface OrdersHomeUiState {
  resetVersion: number;
  /** Bumped after order moves/deletes so home card badges refresh immediately. */
  cardStatsRevision: number;
  cardsLayout: OrdersHomeCardsLayout;
  pendingSearchFocusOrder: MirrorPricingConfirmedOrder | null;
  requestSearchReset: () => void;
  bumpCardStatsRevision: () => void;
  setCardsLayout: (layout: OrdersHomeCardsLayout) => void;
  toggleCardsLayout: () => void;
  setPendingSearchFocusOrder: (order: MirrorPricingConfirmedOrder | null) => void;
  clearPendingSearchFocusOrder: () => void;
}

export const useOrdersHomeUiStore = create<OrdersHomeUiState>()(
  persist(
    (set) => ({
      resetVersion: 0,
      cardStatsRevision: 0,
      cardsLayout: 'list',
      pendingSearchFocusOrder: null,
      requestSearchReset: () => set((state) => ({resetVersion: state.resetVersion + 1})),
      bumpCardStatsRevision: () =>
        set((state) => ({cardStatsRevision: state.cardStatsRevision + 1})),
      setCardsLayout: (layout) => set({cardsLayout: layout}),
      toggleCardsLayout: () =>
        set((state) => ({
          cardsLayout: state.cardsLayout === 'list' ? 'grid' : 'list',
        })),
      setPendingSearchFocusOrder: (order) => set({pendingSearchFocusOrder: order}),
      clearPendingSearchFocusOrder: () => set({pendingSearchFocusOrder: null}),
    }),
    {
      name: 'orders-home-ui',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({cardsLayout: state.cardsLayout}),
    },
  ),
);
