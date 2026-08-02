import {Image} from 'react-native';
import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {normalizeMirrorCatalogImageIds} from '@app/data/mirrorCatalogImages';
import {getMirrorCatalogDisplayUrl} from '@app/data/mirrorCatalogImageAssets';
import {materializeLocalImageFile} from '@app/utils/materializeLocalImageFile';
import type {PickedImage} from '@app/utils/imagePicker';
import {
  cloneCatalogImageTextAnnotation,
  DEFAULT_CATALOG_TEXT_ALIGN,
  DEFAULT_CATALOG_TEXT_COLOR,
  DEFAULT_CATALOG_TEXT_FONT_SIZE,
  isEmptyCatalogImageTextAnnotation,
  MAX_CATALOG_TEXT_FONT_SIZE,
  normalizeCatalogTextAlign,
  type CatalogImageTextAnnotation,
  type CatalogImageTextLayer,
  type CatalogMirrorImageAnnotationData,
} from '@app/utils/catalogImageTextEditor';

export type {CatalogMirrorImageAnnotationData};

function normalizeTextLayer(value: unknown): CatalogImageTextLayer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const text = String(entry.text ?? '').trim();
  if (!text) {
    return null;
  }
  return {
    id: String(entry.id ?? ''),
    text,
    nx: Number(entry.nx ?? 0.5),
    ny: Number(entry.ny ?? 0.5),
    color: String(entry.color ?? DEFAULT_CATALOG_TEXT_COLOR),
    fontSize: Math.min(
      MAX_CATALOG_TEXT_FONT_SIZE,
      Math.max(8, Number(entry.fontSize ?? DEFAULT_CATALOG_TEXT_FONT_SIZE)),
    ),
    withBackground: entry.withBackground !== false,
    textAlign:
      entry.textAlign == null
        ? DEFAULT_CATALOG_TEXT_ALIGN
        : normalizeCatalogTextAlign(entry.textAlign),
  };
}

function normalizeAnnotation(value: unknown): CatalogImageTextAnnotation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const textLayers = Array.isArray(entry.textLayers)
    ? entry.textLayers
        .map((layer) => normalizeTextLayer(layer))
        .filter((layer): layer is CatalogImageTextLayer => layer !== null)
    : [];
  const annotation = {textLayers};
  return isEmptyCatalogImageTextAnnotation(annotation) ? null : annotation;
}

export function normalizeCatalogMirrorImageAnnotationData(
  value: unknown,
): CatalogMirrorImageAnnotationData | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const result: CatalogMirrorImageAnnotationData = {};
  for (const [key, entry] of Object.entries(value)) {
    const annotation = normalizeAnnotation(entry);
    if (annotation) {
      result[key] = annotation;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function pruneCatalogAnnotationData(
  imageIds: string[],
  annotationData: CatalogMirrorImageAnnotationData | undefined,
): CatalogMirrorImageAnnotationData | undefined {
  if (!annotationData) {
    return undefined;
  }

  const allowed = new Set(imageIds);
  const pruned: CatalogMirrorImageAnnotationData = {};
  for (const [id, annotation] of Object.entries(annotationData)) {
    if (allowed.has(id) && !isEmptyCatalogImageTextAnnotation(annotation)) {
      pruned[id] = cloneCatalogImageTextAnnotation(annotation);
    }
  }

  return Object.keys(pruned).length > 0 ? pruned : undefined;
}

export function getOrderAttachedImageAnnotationKeys(
  catalogImageIds: string[] | undefined,
  studioImageUrls: string[] | undefined,
): string[] {
  const catalog = normalizeMirrorCatalogImageIds(catalogImageIds);
  const studio = (studioImageUrls ?? [])
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
  return [...catalog, ...studio];
}

export function pruneOrderImageAnnotationData(
  catalogImageIds: string[] | undefined,
  studioImageUrls: string[] | undefined,
  annotationData: CatalogMirrorImageAnnotationData | undefined,
): CatalogMirrorImageAnnotationData | undefined {
  return pruneCatalogAnnotationData(
    getOrderAttachedImageAnnotationKeys(catalogImageIds, studioImageUrls),
    annotationData,
  );
}

export function countOrderImageTextAnnotations(
  catalogImageIds: string[] | undefined,
  studioImageUrls: string[] | undefined,
  annotationData?: CatalogMirrorImageAnnotationData,
): number {
  return countCatalogImageTextAnnotations(
    getOrderAttachedImageAnnotationKeys(catalogImageIds, studioImageUrls),
    annotationData,
  );
}

const remoteNaturalSizeCache = new Map<string, {width: number; height: number}>();

export function getRemoteImageNaturalSize(
  uri: string,
): Promise<{width: number; height: number}> {
  const cached = remoteNaturalSizeCache.get(uri);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => {
        const size = {width, height};
        remoteNaturalSizeCache.set(uri, size);
        resolve(size);
      },
      reject,
    );
  });
}

export function hasCatalogImageTextAnnotation(
  imageId: string,
  annotationData?: CatalogMirrorImageAnnotationData,
): boolean {
  return !isEmptyCatalogImageTextAnnotation(annotationData?.[imageId]);
}

export function countCatalogImageTextAnnotations(
  imageIds: string[],
  annotationData?: CatalogMirrorImageAnnotationData,
): number {
  return imageIds.filter((imageId) => hasCatalogImageTextAnnotation(imageId, annotationData)).length;
}

export async function catalogImageToPickedImage(
  imageId: MirrorCatalogImageId,
): Promise<PickedImage | null> {
  const displayUrl = getMirrorCatalogDisplayUrl(imageId);
  if (!displayUrl) {
    return null;
  }

  const uri = await materializeLocalImageFile({
    uri: displayUrl,
    fileStem: imageId,
    useStableCache: true,
  });
  return {uri};
}
