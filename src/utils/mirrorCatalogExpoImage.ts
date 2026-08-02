import type {ImageSource} from 'expo-image';
import {
  getMirrorCatalogDisplayUrl,
  getMirrorCatalogThumbUrl,
} from '@app/data/mirrorCatalogImageAssets';
import {getMirrorCatalogItem, isKnownMirrorCatalogImageId} from '@app/stores/mirrorCatalogStore';
import {materializeLocalImageFile} from '@app/utils/materializeLocalImageFile';

export type MirrorCatalogExpoImageVariant = 'thumb' | 'display';

function getCatalogUrl(
  imageId: string,
  variant: MirrorCatalogExpoImageVariant,
): string | null {
  if (!isKnownMirrorCatalogImageId(imageId)) {
    return null;
  }
  return variant === 'thumb'
    ? getMirrorCatalogThumbUrl(imageId)
    : getMirrorCatalogDisplayUrl(imageId);
}

function materializeCacheKey(
  imageId: string,
  variant: MirrorCatalogExpoImageVariant,
): string {
  return `${variant}:${imageId}`;
}

function catalogFileStem(imageId: string, variant: MirrorCatalogExpoImageVariant): string {
  const safeId = imageId.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'mirror_catalog';
  return `catalog_${variant}_${safeId}`;
}

export function buildMirrorCatalogExpoCacheKey(
  imageId: string,
  variant: MirrorCatalogExpoImageVariant = 'display',
): string {
  return `mirror-catalog:${variant}:${imageId}`;
}

export function getMirrorCatalogBundledExpoSource(
  imageId: string,
  variant: MirrorCatalogExpoImageVariant = 'display',
): ImageSource | null {
  const url = getCatalogUrl(imageId, variant);
  if (!url) {
    return null;
  }

  return {
    uri: url,
    cacheKey: buildMirrorCatalogExpoCacheKey(imageId, variant),
  };
}

export function getMirrorCatalogMaterializedUri(
  imageId: string,
  variant: MirrorCatalogExpoImageVariant = 'display',
): Promise<string> {
  const cacheKey = materializeCacheKey(imageId, variant);
  const cached = materializedUriByKey.get(cacheKey);
  if (cached) {
    return cached;
  }

  const url = getCatalogUrl(imageId, variant);
  if (!url) {
    return Promise.reject(new Error('Catalog image missing'));
  }

  const promise = materializeLocalImageFile({
    uri: url,
    fileStem: catalogFileStem(imageId, variant),
    useStableCache: true,
  });
  materializedUriByKey.set(cacheKey, promise);
  promise.catch(() => {
    materializedUriByKey.delete(cacheKey);
  });
  return promise;
}

export function getMirrorCatalogMaterializedDisplayUri(imageId: string): Promise<string> {
  return getMirrorCatalogMaterializedUri(imageId, 'display');
}

const materializedUriByKey = new Map<string, Promise<string>>();

export function invalidateMirrorCatalogMaterializedUri(
  imageId?: string,
  variant?: MirrorCatalogExpoImageVariant,
): void {
  if (!imageId) {
    materializedUriByKey.clear();
    return;
  }

  if (variant) {
    materializedUriByKey.delete(materializeCacheKey(imageId, variant));
    return;
  }

  for (const key of materializedUriByKey.keys()) {
    if (key === `display:${imageId}` || key === `thumb:${imageId}`) {
      materializedUriByKey.delete(key);
    }
  }
}

export function buildMirrorCatalogExpoImageSource(
  imageId: string,
  variant: MirrorCatalogExpoImageVariant = 'display',
): ImageSource | null {
  return getMirrorCatalogBundledExpoSource(imageId, variant);
}

export function invalidateMirrorCatalogMaterializedDisplayUri(imageId?: string): void {
  invalidateMirrorCatalogMaterializedUri(imageId);
}

export function getMirrorCatalogRemoteNaturalSize(
  imageId: string,
): {width: number; height: number} | null {
  const item = getMirrorCatalogItem(imageId);
  if (!item) {
    return null;
  }
  return {width: item.width, height: item.height};
}
