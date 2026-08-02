import type {LangCode} from '@app/types/language';

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

export interface CatalogImageTextLayer {
  id: string;
  text: string;
  nx: number;
  ny: number;
  color: string;
  fontSize: number;
  withBackground: boolean;
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

export function getSkiaFontAsset(language: LangCode): number {
  return language === 'ar'
    ? require('../../assets/fonts/Cairo.ttf')
    : require('../../assets/fonts/Akt.ttf');
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
