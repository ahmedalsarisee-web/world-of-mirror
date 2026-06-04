import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';

interface MirrorPricingConfirmedOrdersState {
  orders: MirrorPricingConfirmedOrder[];
  addOrder: (order: Omit<MirrorPricingConfirmedOrder, 'id' | 'confirmedAt'>) => void;
  removeOrder: (id: string) => void;
  clearAllOrders: () => void;
}

function createConfirmedOrderId(): string {
  return `confirmed-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useMirrorPricingConfirmedOrdersStore = create<MirrorPricingConfirmedOrdersState>()(
  persist(
    (set) => ({
      orders: [],

      addOrder: (order) =>
        set((state) => ({
          orders: [
            {
              ...order,
              id: createConfirmedOrderId(),
              confirmedAt: new Date().toISOString(),
            },
            ...state.orders,
          ],
        })),

      removeOrder: (id) =>
        set((state) => ({
          orders: state.orders.filter((entry) => entry.id !== id),
        })),

      clearAllOrders: () => set({orders: []}),
    }),
    {
      name: 'mirror-pricing-confirmed-orders',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({orders: state.orders}),
    },
  ),
);
