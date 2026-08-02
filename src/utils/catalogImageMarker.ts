import {NativeModules, Platform} from 'react-native';
import Marker, {
  ImageFormat,
  TextBackgroundType,
  type TextOptions,
} from 'react-native-image-marker';
import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {getMirrorCatalogImageNaturalSize} from '@app/data/mirrorCatalogImages';
import {getMirrorCatalogDisplayUrl} from '@app/data/mirrorCatalogImageAssets';
import {catalogImageToPickedImage} from '@app/utils/catalogImageTextAnnotations';
import {materializeLocalImageFile} from '@app/utils/materializeLocalImageFile';
import {
  CATALOG_TEXT_BACKGROUND_COLOR,
  estimateCatalogTextHandleWidth,
  isCatalogTextRtl,
  isEmptyCatalogImageTextAnnotation,
  normalizeCatalogTextAlign,
  type CatalogImageTextAnnotation,
  type CatalogImageTextLayer,
} from '@app/utils/catalogImageTextEditor';
import type {LangCode} from '@app/types/language';
import type {CatalogMirrorImageAnnotationData} from '@app/utils/catalogImageTextAnnotations';

const MARKER_CACHE = new Map<string, string>();
const MARKER_IN_FLIGHT = new Map<string, Promise<string>>();

export function isImageMarkerAvailable(): boolean {
  return Boolean(NativeModules.ImageMarker);
}

function buildCacheKey(imageKey: string, annotation: CatalogImageTextAnnotation): string {
  return `${imageKey}::${JSON.stringify(annotation)}`;
}

function normalizeMarkedUri(result: string): string {
  if (result.startsWith('file://') || result.startsWith('http') || result.startsWith('content://')) {
    return result;
  }
  if (result.startsWith('/')) {
    return `file://${result}`;
  }
  return result;
}

function safeFilenameStem(value: string): string {
  const base = value.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_');
  return (base.length >= 3 ? base : 'mirror_catalog').slice(0, 80);
}

function layerToWatermarkText(
  layer: CatalogImageTextLayer,
  imageWidth: number,
  imageHeight: number,
  language: LangCode,
): TextOptions {
  const align = normalizeCatalogTextAlign(layer.textAlign);
  const layerRtl = isCatalogTextRtl(layer.text, language);
  const scale = Math.max(0.5, imageWidth / 1280);
  const fontSize = Math.max(12, Math.round(layer.fontSize * scale));
  const shadowRadius = Math.max(2, Math.round(fontSize * 0.12));
  const padding = Math.max(4, Math.round(8 * scale));
  const textWidth = estimateCatalogTextHandleWidth(layer.text, fontSize, language);
  const anchorX = layer.nx * imageWidth;
  const anchorY = layer.ny * imageHeight;
  let leftX = anchorX;
  if (align === 'center') {
    leftX -= textWidth / 2;
  } else if (align === 'right') {
    leftX -= textWidth;
  }
  const xPercent = Math.max(0, Math.min(100, (leftX / imageWidth) * 100));
  const yPercent = Math.max(0, Math.min(100, (anchorY / imageHeight) * 100));

  const style: NonNullable<TextOptions['style']> = {
    color: layer.color,
    fontSize,
    fontName: Platform.OS === 'ios' ? 'Cairo-Bold' : 'Cairo',
    bold: true,
    textAlign: layerRtl ? 'right' : 'left',
    shadowStyle: {
      dx: 0,
      dy: 1,
      radius: shadowRadius,
      color: 'rgba(0,0,0,0.8)',
    },
    textBackgroundStyle: layer.withBackground
      ? ({
          paddingX: padding,
          paddingY: Math.max(2, Math.round(padding / 2)),
          type: TextBackgroundType.stretchX,
          color: CATALOG_TEXT_BACKGROUND_COLOR,
        } as NonNullable<TextOptions['style']>['textBackgroundStyle'])
      : ({
          type: TextBackgroundType.none,
        } as NonNullable<TextOptions['style']>['textBackgroundStyle']),
  };

  return {
    text: layer.text,
    position: {
      X: `${Math.round(xPercent * 100) / 100}%`,
      Y: `${Math.round(yPercent * 100) / 100}%`,
    },
    style,
  };
}

export async function markImageUriWithText(params: {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  annotation: CatalogImageTextAnnotation;
  language: LangCode;
  filenameStem: string;
}): Promise<string> {
  if (!isImageMarkerAvailable()) {
    throw new Error('Image marker native module is not available');
  }

  if (isEmptyCatalogImageTextAnnotation(params.annotation)) {
    return params.imageUri;
  }

  const watermarkTexts = params.annotation.textLayers.map((layer) =>
    layerToWatermarkText(layer, params.imageWidth, params.imageHeight, params.language),
  );

  const result = await Marker.markText({
    backgroundImage: {
      src: {uri: params.imageUri},
      scale: 1,
    },
    watermarkTexts,
    quality: 92,
    filename: safeFilenameStem(params.filenameStem),
    saveFormat: ImageFormat.jpg,
    maxSize: 2048,
  });

  return normalizeMarkedUri(result);
}

export async function markRemoteImageWithText(params: {
  imageKey: string;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  annotation: CatalogImageTextAnnotation;
  language: LangCode;
  filenameStem?: string;
}): Promise<string> {
  if (isEmptyCatalogImageTextAnnotation(params.annotation)) {
    return params.imageUri;
  }

  const cacheKey = buildCacheKey(params.imageKey, params.annotation);
  const cached = MARKER_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inflight = MARKER_IN_FLIGHT.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const promise = (async () => {
    const imageUri = await materializeLocalImageFile({
      uri: params.imageUri,
      fileStem: params.filenameStem ?? params.imageKey,
    });
    return markImageUriWithText({
      imageUri,
      imageWidth: params.imageWidth,
      imageHeight: params.imageHeight,
      annotation: params.annotation,
      language: params.language,
      filenameStem: params.filenameStem ?? params.imageKey,
    });
  })().then((uri) => {
    MARKER_CACHE.set(cacheKey, uri);
    return uri;
  });

  MARKER_IN_FLIGHT.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    MARKER_IN_FLIGHT.delete(cacheKey);
  }
}

export async function markCatalogImageWithText(params: {
  imageId: MirrorCatalogImageId;
  annotation: CatalogImageTextAnnotation;
  language: LangCode;
  filenameStem?: string;
}): Promise<string> {
  const picked = await catalogImageToPickedImage(params.imageId);
  if (!picked?.uri) {
    throw new Error('Catalog image missing');
  }

  if (isEmptyCatalogImageTextAnnotation(params.annotation)) {
    return picked.uri;
  }

  const cacheKey = buildCacheKey(params.imageId, params.annotation);
  const cached = MARKER_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inflight = MARKER_IN_FLIGHT.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const natural = getMirrorCatalogImageNaturalSize(params.imageId);
  const displayUrl = getMirrorCatalogDisplayUrl(params.imageId);
  if (!displayUrl) {
    throw new Error('Catalog image missing');
  }
  const materializedUri = await materializeLocalImageFile({
    uri: displayUrl,
    fileStem: params.filenameStem ?? params.imageId,
  });
  const promise = markImageUriWithText({
    imageUri: materializedUri,
    imageWidth: natural?.width ?? 1280,
    imageHeight: natural?.height ?? 1280,
    annotation: params.annotation,
    language: params.language,
    filenameStem: params.filenameStem ?? params.imageId,
  }).then((uri) => {
    MARKER_CACHE.set(cacheKey, uri);
    return uri;
  });

  MARKER_IN_FLIGHT.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    MARKER_IN_FLIGHT.delete(cacheKey);
  }
}

export function invalidateCatalogImageMarkerCache(imageKey?: string): void {
  if (!imageKey) {
    MARKER_CACHE.clear();
    return;
  }
  for (const key of MARKER_CACHE.keys()) {
    if (key.startsWith(`${imageKey}::`)) {
      MARKER_CACHE.delete(key);
    }
  }
}

export function invalidateOrderImageAnnotationCache(
  data?: CatalogMirrorImageAnnotationData,
): void {
  if (!data) {
    return;
  }
  for (const key of Object.keys(data)) {
    invalidateCatalogImageMarkerCache(key);
  }
}
