import {useEffect} from 'react';
import {isMockMode} from '@app/config/appMode';
import {subscribeToConfirmedOrders} from '@app/services/confirmedOrders.service';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';

export function useConfirmedOrdersSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || isMockMode) {
      return;
    }

    return subscribeToConfirmedOrders((orders) => {
      useMirrorPricingConfirmedOrdersStore.setState({orders});
    });
  }, [enabled]);
}
