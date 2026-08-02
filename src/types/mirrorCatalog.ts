export type MirrorCatalogImageId = string;

export type MirrorCatalogSection = {
  key: string;
  imageIds: MirrorCatalogImageId[];
};

export type MirrorCatalogItem = {
  id: MirrorCatalogImageId;
  thumbUrl: string;
  displayUrl: string;
  section: string;
  sortOrder: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  /** Hidden from warehouse/picker but kept for existing orders. */
  removedFromWarehouseAt?: string;
};

export function isMirrorCatalogItemVisibleInWarehouse(item: MirrorCatalogItem): boolean {
  return !item.removedFromWarehouseAt;
}

export function normalizeMirrorCatalogDoc(
  docId: string,
  data: Record<string, unknown>,
): MirrorCatalogItem | null {
  const id = String(data.id ?? docId).trim();
  const thumbUrl = String(data.thumbUrl ?? '').trim();
  const displayUrl = String(data.displayUrl ?? '').trim();
  const section = String(data.section ?? 'other').trim() || 'other';
  const sortOrder = Number(data.sortOrder ?? 0);
  const width = Number(data.width ?? 0);
  const height = Number(data.height ?? 0);
  const createdAt = String(data.createdAt ?? '').trim();
  const updatedAt = String(data.updatedAt ?? data.createdAt ?? '').trim();
  const removedFromWarehouseAt = data.removedFromWarehouseAt
    ? String(data.removedFromWarehouseAt).trim()
    : undefined;

  if (!id || !thumbUrl || !displayUrl) {
    return null;
  }

  return {
    id,
    thumbUrl,
    displayUrl,
    section,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : 1000,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : 1000,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || createdAt || new Date().toISOString(),
    ...(removedFromWarehouseAt ? {removedFromWarehouseAt} : {}),
  };
}
