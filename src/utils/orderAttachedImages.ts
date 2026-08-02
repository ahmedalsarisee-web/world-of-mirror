import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {normalizeMirrorCatalogImageIds} from '@app/data/mirrorCatalogImages';

export type OrderAttachedImage =
  | {kind: 'catalog'; id: MirrorCatalogImageId}
  | {kind: 'studio'; url: string};

export function buildOrderAttachedImages(
  catalogImageIds: string[] | undefined,
  studioImageUrls: string[] | undefined,
): OrderAttachedImage[] {
  const catalog = normalizeMirrorCatalogImageIds(catalogImageIds);
  const studio = (studioImageUrls ?? [])
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);

  return [
    ...catalog.map((id) => ({kind: 'catalog' as const, id})),
    ...studio.map((url) => ({kind: 'studio' as const, url})),
  ];
}

export function getOrderAttachedImageKey(image: OrderAttachedImage): string {
  return image.kind === 'catalog' ? image.id : image.url;
}
