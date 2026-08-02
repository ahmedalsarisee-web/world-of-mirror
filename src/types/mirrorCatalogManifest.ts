import type {MirrorCatalogItem} from '@app/types/mirrorCatalog';

export type MirrorCatalogManifest = {
  version: number;
  updatedAt: string;
  items: MirrorCatalogItem[];
};

export function normalizeMirrorCatalogManifest(
  data: Record<string, unknown> | undefined,
): MirrorCatalogManifest | null {
  if (!data) {
    return null;
  }

  const version = Number(data.version ?? 0);
  const updatedAt = String(data.updatedAt ?? '').trim();
  const rawItems = Array.isArray(data.items) ? data.items : [];

  const items: MirrorCatalogItem[] = [];
  for (const entry of rawItems) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const row = entry as Record<string, unknown>;
    const id = String(row.id ?? '').trim();
    const thumbUrl = String(row.thumbUrl ?? '').trim();
    const displayUrl = String(row.displayUrl ?? '').trim();
    if (!id || !thumbUrl || !displayUrl) {
      continue;
    }
    const createdAt = String(row.createdAt ?? updatedAt ?? new Date().toISOString());
    const removedFromWarehouseAt = row.removedFromWarehouseAt
      ? String(row.removedFromWarehouseAt).trim()
      : undefined;
    items.push({
      id,
      thumbUrl,
      displayUrl,
      section: String(row.section ?? 'other').trim() || 'other',
      sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : 0,
      width: Number.isFinite(Number(row.width)) && Number(row.width) > 0 ? Math.round(Number(row.width)) : 1000,
      height: Number.isFinite(Number(row.height)) && Number(row.height) > 0 ? Math.round(Number(row.height)) : 1000,
      createdAt,
      updatedAt: String(row.updatedAt ?? row.createdAt ?? updatedAt ?? new Date().toISOString()),
      ...(removedFromWarehouseAt ? {removedFromWarehouseAt} : {}),
    });
  }

  return {
    version: Number.isFinite(version) && version > 0 ? Math.floor(version) : 1,
    updatedAt: updatedAt || new Date().toISOString(),
    items,
  };
}

export function buildEmptyMirrorCatalogManifest(): MirrorCatalogManifest {
  const now = new Date().toISOString();
  return {
    version: 1,
    updatedAt: now,
    items: [],
  };
}
