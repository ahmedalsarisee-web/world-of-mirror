import {useMemo} from 'react';
import type {ImageSource} from 'expo-image';
import {useMirrorCatalogStore} from '@app/stores/mirrorCatalogStore';
import {
  getMirrorCatalogBundledExpoSource,
  type MirrorCatalogExpoImageVariant,
} from '@app/utils/mirrorCatalogExpoImage';

export function useMirrorCatalogExpoImage(
  imageId: string | null | undefined,
  variant: MirrorCatalogExpoImageVariant = 'display',
): {source: ImageSource | null; loading: boolean} {
  const catalogItem = useMirrorCatalogStore((state) =>
    imageId ? state.itemsById[imageId] : undefined,
  );
  const isHydrated = useMirrorCatalogStore((state) => state.isHydrated);

  const source = useMemo(() => {
    if (!imageId || !catalogItem) {
      return null;
    }
    return getMirrorCatalogBundledExpoSource(imageId, variant);
  }, [catalogItem, imageId, variant]);

  return {source, loading: Boolean(imageId) && !isHydrated && !source};
}
