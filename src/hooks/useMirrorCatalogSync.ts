import {useEffect} from 'react';
import {startMirrorCatalogSubscription} from '@app/stores/mirrorCatalogStore';

export function useMirrorCatalogSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return startMirrorCatalogSubscription();
  }, [enabled]);
}
