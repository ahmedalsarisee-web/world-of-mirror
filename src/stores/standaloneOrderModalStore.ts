import {create} from 'zustand';
import {fetchConfirmedOrderById} from '@app/services/confirmedOrders.service';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';

interface StandaloneOrderModalState {
  order: MirrorPricingConfirmedOrder | null;
  loading: boolean;
  close: () => void;
}

export const useStandaloneOrderModalStore = create<StandaloneOrderModalState>()((set) => ({
  order: null,
  loading: false,
  close: () => set({order: null, loading: false}),
}));

export async function openStandaloneOrderModal(orderId: string): Promise<boolean> {
  const trimmedId = orderId.trim();
  if (!trimmedId) {
    return false;
  }

  const {orders, upsertOrders} = useMirrorPricingConfirmedOrdersStore.getState();
  const liveOrder = orders.find((entry) => entry.id === trimmedId);

  useStandaloneOrderModalStore.setState({
    order: liveOrder ?? null,
    loading: !liveOrder,
  });

  if (liveOrder) {
    upsertOrders([liveOrder]);
    return true;
  }

  const fetched = await fetchConfirmedOrderById(trimmedId);
  if (!fetched) {
    useStandaloneOrderModalStore.setState({order: null, loading: false});
    return false;
  }

  upsertOrders([fetched]);
  useStandaloneOrderModalStore.setState({order: fetched, loading: false});
  return true;
}

export function closeStandaloneOrderModal(): void {
  useStandaloneOrderModalStore.getState().close();
}
