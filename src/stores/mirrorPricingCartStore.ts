import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {MirrorPricingCartItem} from '@app/types/mirrorPricingCart';
import {roundMoney} from '@app/utils/format';

interface MirrorPricingCartState {
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  collectedAmount: number;
  /** When set below items subtotal, the difference is shown as a discount. */
  cartTotalOverride: number | null;
  items: MirrorPricingCartItem[];
  addItem: (item: Omit<MirrorPricingCartItem, 'id' | 'createdAt'>) => void;
  removeItem: (id: string) => void;
  updateItemQuantity: (id: string, quantity: number) => void;
  setCustomerName: (value: string) => void;
  setCustomerPhone: (value: string) => void;
  setCustomerLocation: (value: string) => void;
  setCollectedAmount: (value: number) => void;
  setCartTotalOverride: (value: number | null) => void;
  clearCart: () => void;
}

const EMPTY_CART_ORDER = {
  customerName: '',
  customerPhone: '',
  customerLocation: '',
  collectedAmount: 0,
  cartTotalOverride: null as number | null,
};

function createCartItemId(): string {
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getItemsSubtotal(items: MirrorPricingCartItem[]): number {
  const sum = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  return roundMoney(sum);
}

function reconcileCartTotalOverride(
  items: MirrorPricingCartItem[],
  cartTotalOverride: number | null | undefined,
): number | null {
  if (cartTotalOverride == null) {
    return null;
  }

  const subtotal = getItemsSubtotal(items);
  if (subtotal <= 0) {
    return null;
  }

  const clamped = roundMoney(Math.min(subtotal, Math.max(0, cartTotalOverride)));
  if (clamped >= subtotal) {
    return null;
  }

  return clamped;
}

export function normalizeCartTotalOverride(
  value: number,
  subtotal: number,
): number | null {
  if (subtotal <= 0) {
    return null;
  }

  const clamped = roundMoney(Math.min(subtotal, Math.max(0, value)));
  if (clamped >= subtotal) {
    return null;
  }

  return clamped;
}

export const useMirrorPricingCartStore = create<MirrorPricingCartState>()(
  persist(
    (set) => ({
      ...EMPTY_CART_ORDER,
      items: [],

      addItem: (item) =>
        set((state) => {
          const items = [
            {
              ...item,
              id: createCartItemId(),
              createdAt: new Date().toISOString(),
            },
            ...state.items,
          ];

          return {
            items,
            cartTotalOverride: reconcileCartTotalOverride(items, state.cartTotalOverride),
          };
        }),

      removeItem: (id) =>
        set((state) => {
          const items = state.items.filter((entry) => entry.id !== id);
          return {
            items,
            cartTotalOverride: reconcileCartTotalOverride(items, state.cartTotalOverride),
          };
        }),

      updateItemQuantity: (id, quantity) =>
        set((state) => {
          const items = state.items.map((entry) =>
            entry.id === id ? {...entry, quantity: Math.max(1, Math.round(quantity))} : entry,
          );

          return {
            items,
            cartTotalOverride: reconcileCartTotalOverride(items, state.cartTotalOverride),
          };
        }),

      setCustomerName: (customerName) => set({customerName}),
      setCustomerPhone: (customerPhone) => set({customerPhone}),
      setCustomerLocation: (customerLocation) => set({customerLocation}),
      setCollectedAmount: (collectedAmount) =>
        set({collectedAmount: roundMoney(Math.max(0, collectedAmount))}),

      setCartTotalOverride: (cartTotalOverride) =>
        set((state) => ({
          cartTotalOverride: reconcileCartTotalOverride(state.items, cartTotalOverride),
        })),

      clearCart: () => set({...EMPTY_CART_ORDER, items: []}),
    }),
    {
      name: 'mirror-pricing-cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        customerName: state.customerName,
        customerPhone: state.customerPhone,
        customerLocation: state.customerLocation,
        collectedAmount: state.collectedAmount,
        cartTotalOverride: state.cartTotalOverride,
        items: state.items,
      }),
    },
  ),
);

export function getMirrorPricingCartSubtotal(items: MirrorPricingCartItem[]): number {
  return getItemsSubtotal(items);
}

/** @deprecated Use getMirrorPricingCartSubtotal */
export function getMirrorPricingCartTotal(items: MirrorPricingCartItem[]): number {
  return getMirrorPricingCartSubtotal(items);
}

export function getMirrorPricingCartEffectiveTotal(
  items: MirrorPricingCartItem[],
  cartTotalOverride: number | null | undefined,
): number {
  const subtotal = getMirrorPricingCartSubtotal(items);
  if (cartTotalOverride == null) {
    return subtotal;
  }
  return roundMoney(Math.min(subtotal, Math.max(0, cartTotalOverride)));
}

export function getMirrorPricingCartDiscount(
  items: MirrorPricingCartItem[],
  cartTotalOverride: number | null | undefined,
): number {
  const subtotal = getMirrorPricingCartSubtotal(items);
  const effectiveTotal = getMirrorPricingCartEffectiveTotal(items, cartTotalOverride);
  return roundMoney(Math.max(0, subtotal - effectiveTotal));
}

export function getMirrorPricingCartCount(items: MirrorPricingCartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
