import type {MirrorCatalogImageId} from '@app/types/mirrorCatalog';
export type MirrorWarehouseStockCounts = Record<MirrorCatalogImageId, number>;

export function normalizeMirrorWarehouseStockDoc(
  docId: string,
  data: Record<string, unknown>,
): {catalogImageId: MirrorCatalogImageId; count: number} | null {
  const catalogImageId = String(data.catalogImageId ?? docId).trim();
  const count = Number(data.count ?? 0);

  if (!catalogImageId || !Number.isFinite(count) || count < 0) {
    return null;
  }

  return {
    catalogImageId,
    count: Math.floor(count),
  };
}
