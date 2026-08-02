import type {ImageSourcePropType} from 'react-native';
import {getMirrorCatalogItem} from '@app/stores/mirrorCatalogStore';

export function getMirrorCatalogThumbUrl(imageId: string): string | null {
  return getMirrorCatalogItem(imageId)?.thumbUrl ?? null;
}

export function getMirrorCatalogDisplayUrl(imageId: string): string | null {
  return getMirrorCatalogItem(imageId)?.displayUrl ?? null;
}

export function getMirrorCatalogThumbSource(imageId: string): ImageSourcePropType | null {
  const url = getMirrorCatalogThumbUrl(imageId);
  return url ? {uri: url} : null;
}

export function getMirrorCatalogDisplaySource(imageId: string): ImageSourcePropType | null {
  const url = getMirrorCatalogDisplayUrl(imageId);
  return url ? {uri: url} : null;
}

export function resolveMirrorCatalogDisplayUri(imageId: string): string | null {
  return getMirrorCatalogDisplayUrl(imageId);
}

export function resolveMirrorCatalogDisplaySize(
  imageId: string,
): {width: number; height: number} | null {
  const item = getMirrorCatalogItem(imageId);
  if (!item) {
    return null;
  }
  return {width: item.width, height: item.height};
}
