import {
  normalizeMirrorCatalogImageIds,
  type MirrorCatalogImageId,
} from '@app/data/mirrorCatalogImages';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {
  pruneOrderImageAnnotationData,
  type CatalogMirrorImageAnnotationData,
} from '@app/utils/catalogImageTextAnnotations';

export function replaceStudioImageUrl(
  studioImageUrls: string[] | undefined,
  oldUrl: string,
  newUrl: string,
): string[] {
  return (studioImageUrls ?? []).map((entry) => (entry === oldUrl ? newUrl : entry));
}

export function migrateStudioImageAnnotationKey(
  annotationData: CatalogMirrorImageAnnotationData | undefined,
  oldUrl: string,
  newUrl: string,
): CatalogMirrorImageAnnotationData | undefined {
  if (!annotationData?.[oldUrl]) {
    return annotationData;
  }

  const next = {...annotationData};
  next[newUrl] = next[oldUrl];
  delete next[oldUrl];
  return next;
}

export function buildCatalogToStudioReplaceUpdates(
  order: Pick<
    MirrorPricingConfirmedOrder,
    'catalogMirrorImages' | 'studioOrderImages' | 'catalogMirrorImageAnnotationData'
  >,
  oldImageId: MirrorCatalogImageId,
  newStudioUrl: string,
): Pick<
  MirrorPricingConfirmedOrder,
  'catalogMirrorImages' | 'studioOrderImages' | 'catalogMirrorImageAnnotationData'
> {
  const catalogIds = normalizeMirrorCatalogImageIds(order.catalogMirrorImages);
  if (!catalogIds.includes(oldImageId)) {
    throw new Error('catalog image not found');
  }

  const nextCatalogIds = catalogIds.filter((entry) => entry !== oldImageId);
  const nextAnnotationData = {...(order.catalogMirrorImageAnnotationData ?? {})};
  delete nextAnnotationData[oldImageId];

  const currentStudio = (order.studioOrderImages ?? [])
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
  const nextStudioImages = [newStudioUrl, ...currentStudio];
  const prunedAnnotationData = pruneOrderImageAnnotationData(
    nextCatalogIds,
    nextStudioImages,
    nextAnnotationData,
  );

  return {
    catalogMirrorImages: nextCatalogIds.length > 0 ? nextCatalogIds : undefined,
    studioOrderImages: nextStudioImages,
    catalogMirrorImageAnnotationData: prunedAnnotationData,
  };
}

export function buildStudioToCatalogReplaceUpdates(
  order: Pick<
    MirrorPricingConfirmedOrder,
    'catalogMirrorImages' | 'studioOrderImages' | 'catalogMirrorImageAnnotationData'
  >,
  oldUrl: string,
  newImageId: MirrorCatalogImageId,
): Pick<
  MirrorPricingConfirmedOrder,
  'catalogMirrorImages' | 'studioOrderImages' | 'catalogMirrorImageAnnotationData'
> {
  const studioUrls = (order.studioOrderImages ?? [])
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
  if (!studioUrls.includes(oldUrl)) {
    throw new Error('studio image not found');
  }

  const catalogIds = normalizeMirrorCatalogImageIds(order.catalogMirrorImages);
  const nextCatalogIds = catalogIds.includes(newImageId) ? catalogIds : [...catalogIds, newImageId];
  const nextStudioUrls = studioUrls.filter((entry) => entry !== oldUrl);
  const nextAnnotationData = {...(order.catalogMirrorImageAnnotationData ?? {})};
  if (nextAnnotationData[oldUrl]) {
    nextAnnotationData[newImageId] = nextAnnotationData[oldUrl];
    delete nextAnnotationData[oldUrl];
  }

  const prunedAnnotationData = pruneOrderImageAnnotationData(
    nextCatalogIds,
    nextStudioUrls,
    nextAnnotationData,
  );

  return {
    catalogMirrorImages: nextCatalogIds.length > 0 ? nextCatalogIds : undefined,
    studioOrderImages: nextStudioUrls.length > 0 ? nextStudioUrls : undefined,
    catalogMirrorImageAnnotationData: prunedAnnotationData,
  };
}

export function applyStudioToCatalogReplaceToDraft(params: {
  catalogImageIds: MirrorCatalogImageId[];
  studioImageUrls: string[];
  annotationData: CatalogMirrorImageAnnotationData;
  oldUrl: string;
  newImageId: MirrorCatalogImageId;
}): {
  catalogImageIds: MirrorCatalogImageId[];
  studioImageUrls: string[];
  annotationData: CatalogMirrorImageAnnotationData;
} {
  const updates = buildStudioToCatalogReplaceUpdates(
    {
      catalogMirrorImages: params.catalogImageIds,
      studioOrderImages: params.studioImageUrls,
      catalogMirrorImageAnnotationData: params.annotationData,
    },
    params.oldUrl,
    params.newImageId,
  );

  return {
    catalogImageIds: normalizeMirrorCatalogImageIds(updates.catalogMirrorImages),
    studioImageUrls: updates.studioOrderImages ?? [],
    annotationData: updates.catalogMirrorImageAnnotationData ?? {},
  };
}

export function buildStudioImageReplaceUpdates(
  order: Pick<
    MirrorPricingConfirmedOrder,
    'catalogMirrorImages' | 'studioOrderImages' | 'catalogMirrorImageAnnotationData'
  >,
  oldUrl: string,
  newUrl: string,
): Pick<MirrorPricingConfirmedOrder, 'studioOrderImages' | 'catalogMirrorImageAnnotationData'> {
  const nextStudioImages = replaceStudioImageUrl(order.studioOrderImages, oldUrl, newUrl);
  const migratedAnnotations = migrateStudioImageAnnotationKey(
    order.catalogMirrorImageAnnotationData,
    oldUrl,
    newUrl,
  );
  const prunedAnnotationData = pruneOrderImageAnnotationData(
    order.catalogMirrorImages,
    nextStudioImages,
    migratedAnnotations,
  );

  return {
    studioOrderImages: nextStudioImages.length > 0 ? nextStudioImages : undefined,
    catalogMirrorImageAnnotationData: prunedAnnotationData,
  };
}

export function applyStudioImageReplaceToDraft(params: {
  catalogImageIds: MirrorCatalogImageId[];
  studioImageUrls: string[];
  annotationData: CatalogMirrorImageAnnotationData;
  oldUrl: string;
  newUrl: string;
}): {
  studioImageUrls: string[];
  annotationData: CatalogMirrorImageAnnotationData;
} {
  const studioImageUrls = replaceStudioImageUrl(params.studioImageUrls, params.oldUrl, params.newUrl);
  const migratedAnnotations =
    migrateStudioImageAnnotationKey(params.annotationData, params.oldUrl, params.newUrl) ?? {};
  const annotationData =
    pruneOrderImageAnnotationData(params.catalogImageIds, studioImageUrls, migratedAnnotations) ?? {};

  return {studioImageUrls, annotationData};
}
