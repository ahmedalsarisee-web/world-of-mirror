import type {TFunction} from 'i18next';
import type {MirrorWarehouseNotificationMetadata} from '@app/types/adminNotificationMetadata';

export type MirrorWarehouseNotificationOperation =
  | 'catalog_upload'
  | 'catalog_delete'
  | 'stock_adjust';

export interface MirrorWarehouseNotificationContent {
  title: string;
  body: string;
  sourceId: string;
  eventAt: number;
  metadata: MirrorWarehouseNotificationMetadata;
}

export function buildMirrorCatalogUploadedNotificationContent(
  count: number,
  actorName: string,
  actorUserId: string | undefined,
  t: TFunction,
): MirrorWarehouseNotificationContent {
  const eventAt = Date.now();
  const sourceId = `catalog_upload:${eventAt}:${count}`;

  return {
    title: t('mirrorWarehouseNotificationUploadTitle'),
    body: t('mirrorWarehouseNotificationUploadBody', {count, actorName}),
    sourceId,
    eventAt,
    metadata: {
      operation: 'catalog_upload',
      count,
      actorUserId,
      actorName,
      eventAt: new Date(eventAt).toISOString(),
    },
  };
}

export function buildMirrorCatalogDeletedNotificationContent(
  imageId: string,
  actorName: string,
  actorUserId: string | undefined,
  t: TFunction,
): MirrorWarehouseNotificationContent {
  const eventAt = Date.now();
  const sourceId = `catalog_delete:${imageId}:${eventAt}`;

  return {
    title: t('mirrorWarehouseNotificationDeleteTitle'),
    body: t('mirrorWarehouseNotificationDeleteBody', {actorName}),
    sourceId,
    eventAt,
    metadata: {
      operation: 'catalog_delete',
      imageId,
      actorUserId,
      actorName,
      eventAt: new Date(eventAt).toISOString(),
    },
  };
}

export function buildMirrorWarehouseStockNotificationContent(
  imageId: string,
  delta: number,
  newCount: number,
  actorName: string,
  actorUserId: string | undefined,
  t: TFunction,
): MirrorWarehouseNotificationContent {
  const eventAt = Date.now();
  const sourceId = `stock:${imageId}:${eventAt}:${delta}`;

  return {
    title: t('mirrorWarehouseNotificationStockTitle'),
    body:
      delta > 0
        ? t('mirrorWarehouseNotificationStockIncreaseBody', {count: newCount, actorName})
        : t('mirrorWarehouseNotificationStockDecreaseBody', {count: newCount, actorName}),
    sourceId,
    eventAt,
    metadata: {
      operation: 'stock_adjust',
      imageId,
      delta,
      newCount,
      actorUserId,
      actorName,
      eventAt: new Date(eventAt).toISOString(),
    },
  };
}
