import {Platform, type TextStyle, type ViewStyle} from 'react-native';
import type {LangCode} from '@app/types/language';

const ARABIC_TEXT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

/** Image overlay coordinates are always LTR — avoids mirrored drag/position in RTL UI. */
export const CATALOG_IMAGE_COORDINATE_LAYER_STYLE: ViewStyle = {direction: 'ltr'};

export const CATALOG_IMAGE_TEXT_COLORS = [
  '#FFFFFF',
  '#000000',
  '#FF3B30',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#007AFF',
  '#5856D6',
  '#AF52DE',
  '#FF2D55',
] as const;

export type CatalogImageTextAlign = 'left' | 'center' | 'right';

export const CATALOG_IMAGE_TEXT_ALIGN_OPTIONS: CatalogImageTextAlign[] = ['left', 'center', 'right'];

export interface CatalogImageTextLayer {
  id: string;
  text: string;
  /** Anchor point on the image (0–1). Meaning depends on textAlign. */
  nx: number;
  ny: number;
  color: string;
  fontSize: number;
  withBackground: boolean;
  textAlign: CatalogImageTextAlign;
}

export interface CatalogImageTextAnnotation {
  textLayers: CatalogImageTextLayer[];
}

export type CatalogMirrorImageAnnotationData = Record<string, CatalogImageTextAnnotation>;

export interface CatalogImageLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
}

export const MIN_CATALOG_TEXT_DISPLAY_SIZE = 1;

export const CATALOG_TEXT_BACKGROUND_COLOR = 'rgba(0,0,0,0.55)';

export function getCatalogTextShadowStyle(displaySize: number): TextStyle {
  const radius = Math.max(1, Math.round(displaySize * 0.12));
  return Platform.select({
    ios: {
      textShadowColor: 'rgba(0,0,0,0.8)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: radius,
    },
    android: {
      textShadowColor: 'rgba(0,0,0,0.8)',
      textShadowOffset: {width: 0, height: 1},
      textShadowRadius: radius,
    },
    default: {},
  }) ?? {};
}

export function getCatalogTextDisplaySize(fontSize: number, scale: number): number {
  const scaled = fontSize * scale;
  if (scaled <= 0) {
    return MIN_CATALOG_TEXT_DISPLAY_SIZE;
  }
  return Math.max(MIN_CATALOG_TEXT_DISPLAY_SIZE, scaled);
}

export function getCatalogTextBubbleMetrics(scale: number) {
  return {
    paddingHorizontal: Math.max(1, Math.round(8 * scale)),
    paddingVertical: Math.max(1, Math.round(4 * scale)),
    borderRadius: Math.max(1, Math.round(8 * scale)),
  };
}

export function isCatalogImageLayoutReady(
  layout: CatalogImageLayout | null | undefined,
): layout is CatalogImageLayout {
  return Boolean(
    layout &&
      layout.scale > 0 &&
      layout.displayWidth > 0 &&
      layout.displayHeight > 0,
  );
}

export function isArabicCatalogText(text: string): boolean {
  return ARABIC_TEXT_RE.test(text);
}

export function isCatalogTextRtl(text: string, language: LangCode): boolean {
  return language === 'ar' || isArabicCatalogText(text);
}

export function normalizeCatalogTextAlign(value: unknown): CatalogImageTextAlign {
  return value === 'center' || value === 'right' ? value : 'left';
}

export function getCatalogTextLayerPosition(
  layer: CatalogImageTextLayer,
  layout: CatalogImageLayout,
  language: LangCode,
): {left: number; top: number; width: number; displaySize: number} {
  const displaySize = getCatalogTextDisplaySize(layer.fontSize, layout.scale);
  const width = estimateCatalogTextHandleWidth(layer.text, displaySize, language);
  const anchorX = layer.nx * layout.displayWidth;
  const align = normalizeCatalogTextAlign(layer.textAlign);
  let left = anchorX;
  if (align === 'center') {
    left -= width / 2;
  } else if (align === 'right') {
    left -= width;
  }
  return {
    left,
    top: layer.ny * layout.displayHeight,
    width,
    displaySize,
  };
}

export function getCatalogTextLayerTextStyle(
  layer: CatalogImageTextLayer,
  layout: CatalogImageLayout,
  language: LangCode,
  fontFamily?: string,
): TextStyle {
  const {displaySize} = getCatalogTextLayerPosition(layer, layout, language);
  const layerRtl = isCatalogTextRtl(layer.text, language);
  return {
    color: layer.color,
    fontSize: displaySize,
    fontFamily,
    writingDirection: layerRtl ? 'rtl' : 'ltr',
    textAlign: normalizeCatalogTextAlign(layer.textAlign),
    fontWeight: '700',
    ...getCatalogTextShadowStyle(displaySize),
  };
}

/** @deprecated Width estimate for legacy callers — prefer measured bubble layout. */
export function estimateCatalogTextHandleWidth(
  text: string,
  displaySize: number,
  language: LangCode,
): number {
  const rtl = isCatalogTextRtl(text, language);
  const charFactor = rtl ? 0.58 : 0.45;
  return Math.max(displaySize + 16, text.length * displaySize * charFactor + 16);
}

export function createCatalogTextLayerId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getCatalogImageLayout(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): CatalogImageLayout {
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return {
      scale: 0,
      offsetX: 0,
      offsetY: 0,
      displayWidth: 0,
      displayHeight: 0,
    };
  }

  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const displayWidth = imageWidth * scale;
  const displayHeight = imageHeight * scale;
  return {
    scale,
    offsetX: (containerWidth - displayWidth) / 2,
    offsetY: (containerHeight - displayHeight) / 2,
    displayWidth,
    displayHeight,
  };
}

export function localPointToNormalized(
  x: number,
  y: number,
  displayWidth: number,
  displayHeight: number,
): {nx: number; ny: number} | null {
  const nx = x / displayWidth;
  const ny = y / displayHeight;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) {
    return null;
  }
  return {nx, ny};
}

export function isEmptyCatalogImageTextAnnotation(
  annotation: CatalogImageTextAnnotation | undefined,
): boolean {
  return !annotation?.textLayers?.length;
}

export function cloneCatalogImageTextAnnotation(
  annotation: CatalogImageTextAnnotation,
): CatalogImageTextAnnotation {
  return {textLayers: annotation.textLayers.map((layer) => ({...layer}))};
}

export function cloneCatalogImageTextLayers(layers: CatalogImageTextLayer[]): CatalogImageTextLayer[] {
  return layers.map((layer) => ({...layer}));
}
