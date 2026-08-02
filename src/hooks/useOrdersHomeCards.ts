import {useCallback, useEffect, useRef, useSyncExternalStore} from 'react';
import {subscribeToOrdersHomeCards} from '@app/services/ordersHomeCards.service';
import type {OrdersHomeCardConfig} from '@app/types/ordersHomeCard';

const EMPTY_CARDS: OrdersHomeCardConfig[] = [];

interface Runtime {
  cards: OrdersHomeCardConfig[];
  refs: number;
  ready: boolean;
  unsubscribe?: () => void;
}

let runtime: Runtime = {cards: EMPTY_CARDS, refs: 0, ready: false};
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function acquire(): void {
  runtime.refs += 1;
  if (runtime.refs !== 1) {
    return;
  }

  runtime.unsubscribe = subscribeToOrdersHomeCards((cards) => {
    runtime.cards = cards;
    runtime.ready = true;
    notify();
  });
}

function release(): void {
  runtime.refs = Math.max(0, runtime.refs - 1);
  if (runtime.refs !== 0) {
    return;
  }

  runtime.unsubscribe?.();
  runtime.unsubscribe = undefined;
  runtime.cards = EMPTY_CARDS;
  runtime.ready = false;
  notify();
}

function getCardsSnapshot(): OrdersHomeCardConfig[] {
  return runtime.cards;
}

export function getOrdersHomeCardsSnapshot(): OrdersHomeCardConfig[] {
  return getCardsSnapshot();
}

function getEmptySnapshot(): OrdersHomeCardConfig[] {
  return EMPTY_CARDS;
}

/** Shared orders-home cards document listener (refcounted). */
export function useOrdersHomeCards(enabled = true): {
  cards: OrdersHomeCardConfig[];
  isLoading: boolean;
} {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const getSnapshot = useCallback(() => {
    return enabledRef.current ? getCardsSnapshot() : getEmptySnapshot();
  }, []);

  const cards = useSyncExternalStore(subscribe, getSnapshot, getEmptySnapshot);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    acquire();
    return () => release();
  }, [enabled]);

  const isLoading = enabled && !runtime.ready;

  return {cards, isLoading};
}
