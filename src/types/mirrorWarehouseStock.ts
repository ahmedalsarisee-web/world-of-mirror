import type {MirrorCatalogImageId} from '@app/types/mirrorCatalog';

export type MirrorWarehouseStockCounts = Record<MirrorCatalogImageId, number>;

export type MirrorWarehouseStockManifest = {
  version: number;
  updatedAt: string;
  counts: MirrorWarehouseStockCounts;
};

export function normalizeMirrorWarehouseStockManifest(
  data: Record<string, unknown> | undefined,
): MirrorWarehouseStockManifest | null {
  if (!data) {
    return null;
  }

  const version = Number(data.version ?? 0);
  const updatedAt = String(data.updatedAt ?? '').trim();
  const rawCounts = data.counts;
  const counts: MirrorWarehouseStockCounts = {};

  if (rawCounts && typeof rawCounts === 'object' && !Array.isArray(rawCounts)) {
    for (const [key, value] of Object.entries(rawCounts)) {
      const count = Number(value ?? 0);
      if (key && Number.isFinite(count) && count > 0) {
        counts[key] = Math.floor(count);
      }
    }
  }

  return {
    version: Number.isFinite(version) && version > 0 ? Math.floor(version) : 1,
    updatedAt: updatedAt || new Date().toISOString(),
    counts,
  };
}

export function buildEmptyMirrorWarehouseStockManifest(): MirrorWarehouseStockManifest {
  const now = new Date().toISOString();
  return {
    version: 1,
    updatedAt: now,
    counts: {},
  };
}
