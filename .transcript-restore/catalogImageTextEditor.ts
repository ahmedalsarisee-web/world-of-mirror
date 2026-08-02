import type {LangCode} from '@app/types/language';

export type CatalogImageTextAlign = 'left' | 'center' | 'right';

export interface CatalogImageTextLayer {
  id: string;
  text: string;
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
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  imageLeft: number;
  imageTop: number;
}

export const CATALOG_IMAGE_TEXT_COLORS = [
  '#FFFFFF',
  '#000000',
  '#FACC15',
  '#EF4444',
  '#22C55E',
  '#3B82F6',
] as const;

export const MIN_CATALOG_TEXT_FONT_SIZE = 14;
export const MAX_CATALOG_TEXT_FONT_SIZE = 72;

export function normalizeCatalogTextAlign(value: unknown): CatalogImageTextAlign {
  if (value === 'center' || value === 'right') {
    return value;
  }
  return 'left';
}

export function isEmptyCatalogImageTextAnnotation(
  annotation?: CatalogImageTextAnnotation | null,
): boolean {
  return !annotation?.textLayers?.some((layer) => layer.text.trim().length > 0);
}

export function cloneCatalogImageTextLayers(
  layers: CatalogImageTextLayer[],
): CatalogImageTextLayer[] {
  return layers.map((layer) => ({...layer}));
}

export function cloneCatalogImageTextAnnotation(
  annotation: CatalogImageTextAnnotation,
): CatalogImageTextAnnotation {
  return {textLayers: cloneCatalogImageTextLayers(annotation.textLayers)};
}

export function createCatalogImageTextLayerId(): string {
  return `txt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function computeContainLayout(
  containerWidth: number,
  containerHeight: number,
  intrinsicWidth: number,
  intrinsicHeight: number,
): CatalogImageLayout {
  if (containerWidth <= 0 || containerHeight <= 0 || intrinsicWidth <= 0 || intrinsicHeight <= 0) {
    return {
      width: containerWidth,
      height: containerHeight,
      imageWidth: containerWidth,
      imageHeight: containerHeight,
      imageLeft: 0,
      imageTop: 0,
    };
  }

  const scale = Math.min(containerWidth / intrinsicWidth, containerHeight / intrinsicHeight);
  const imageWidth = intrinsicWidth * scale;
  const imageHeight = intrinsicHeight * scale;
  const imageLeft = (containerWidth - imageWidth) / 2;
  const imageTop = (containerHeight - imageHeight) / 2;

  return {
    width: containerWidth,
    height: containerHeight,
    imageWidth,
    imageHeight,
    imageLeft,
    imageTop,
  };
}

export function isCatalogImageLayoutReady(layout?: CatalogImageLayout | null): boolean {
  return Boolean(layout && layout.imageWidth > 0 && layout.imageHeight > 0);
}

export function layerToPixelPosition(
  layer: CatalogImageTextLayer,
  layout: CatalogImageLayout,
): {left: number; top: number} {
  return {
    left: layout.imageLeft + layer.nx * layout.imageWidth,
    top: layout.imageTop + layer.ny * layout.imageHeight,
  };
}

export function pixelToNormalized(
  x: number,
  y: number,
  layout: CatalogImageLayout,
): {nx: number; ny: number} {
  if (layout.imageWidth <= 0 || layout.imageHeight <= 0) {
    return {nx: 0, ny: 0};
  }

  const nx = (x - layout.imageLeft) / layout.imageWidth;
  const ny = (y - layout.imageTop) / layout.imageHeight;
  return {
    nx: Math.min(1, Math.max(0, nx)),
    ny: Math.min(1, Math.max(0, ny)),
  };
}

export function scaleCatalogTextFontSize(fontSize: number, layout: CatalogImageLayout): number {
  const reference = Math.min(layout.imageWidth, layout.imageHeight);
  const scale = reference > 0 ? reference / 320 : 1;
  return Math.max(10, fontSize * scale);
}

export function getCatalogImageTextWritingDirection(language: LangCode): 'rtl' | 'ltr' {
  return language === 'ar' ? 'rtl' : 'ltr';
}
