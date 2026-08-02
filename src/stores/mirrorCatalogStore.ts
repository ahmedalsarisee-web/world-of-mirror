import {create} from 'zustand';
import {subscribeToMirrorCatalog} from '@app/services/mirrorCatalog.service';
import type {MirrorCatalogItem, MirrorCatalogSection} from '@app/types/mirrorCatalog';
import {isMirrorCatalogItemVisibleInWarehouse} from '@app/types/mirrorCatalog';
import {
  buildMirrorCatalogImageIds,
  buildMirrorCatalogSections,
} from '@app/utils/mirrorCatalogSections';

interface MirrorCatalogState {
  items: MirrorCatalogItem[];
  itemsById: Record<string, MirrorCatalogItem>;
  imageIds: string[];
  sections: MirrorCatalogSection[];
  isLoading: boolean;
  isHydrated: boolean;
  setItems: (items: MirrorCatalogItem[]) => void;
  setLoading: (loading: boolean) => void;
}

function buildCatalogIndexes(items: MirrorCatalogItem[]): {
  itemsById: Record<string, MirrorCatalogItem>;
  imageIds: string[];
  sections: MirrorCatalogSection[];
} {
  const itemsById: Record<string, MirrorCatalogItem> = {};
  for (const item of items) {
    itemsById[item.id] = item;
  }
  const visibleItems = items.filter(isMirrorCatalogItemVisibleInWarehouse);

  return {
    itemsById,
    imageIds: buildMirrorCatalogImageIds(visibleItems),
    sections: buildMirrorCatalogSections(visibleItems),
  };
}

export const useMirrorCatalogStore = create<MirrorCatalogState>((set) => ({
  items: [],
  itemsById: {},
  imageIds: [],
  sections: [],
  isLoading: false,
  isHydrated: false,
  setItems: (items) =>
    set({
      items,
      ...buildCatalogIndexes(items),
      isHydrated: true,
    }),
  setLoading: (isLoading) => set({isLoading}),
}));

let catalogUnsubscribe: (() => void) | null = null;
let catalogSubscriberCount = 0;

export function startMirrorCatalogSubscription(): () => void {
  catalogSubscriberCount += 1;
  if (catalogSubscriberCount === 1) {
    useMirrorCatalogStore.getState().setLoading(true);
    catalogUnsubscribe = subscribeToMirrorCatalog((items) => {
      useMirrorCatalogStore.getState().setItems(items);
      useMirrorCatalogStore.getState().setLoading(false);
    });
  }

  return () => {
    catalogSubscriberCount = Math.max(0, catalogSubscriberCount - 1);
    if (catalogSubscriberCount === 0) {
      catalogUnsubscribe?.();
      catalogUnsubscribe = null;
      // Keep the last catalog cache so order screens can still resolve warehouse
      // image IDs after leaving Add Order / Warehouse.
      useMirrorCatalogStore.getState().setLoading(false);
    }
  };
}

export function getMirrorCatalogItem(imageId: string): MirrorCatalogItem | null {
  return useMirrorCatalogStore.getState().itemsById[imageId] ?? null;
}

export function isKnownMirrorCatalogImageId(value: string): boolean {
  return useMirrorCatalogStore.getState().itemsById[value] != null;
}

export function getMirrorCatalogImageNaturalSize(
  imageId: string,
): {width: number; height: number} | null {
  const item = getMirrorCatalogItem(imageId);
  if (!item) {
    return null;
  }
  return {width: item.width, height: item.height};
}

function coerceCatalogImageIds(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const id = value.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

export function normalizeMirrorCatalogImageIds(values: unknown): string[] {
  const coerced = coerceCatalogImageIds(values);
  if (coerced.length === 0) {
    return [];
  }

  const {isHydrated, itemsById} = useMirrorCatalogStore.getState();
  // Until the catalog hydrates, keep order IDs so the UI can show them after load.
  if (!isHydrated || Object.keys(itemsById).length === 0) {
    return coerced;
  }

  return coerced.filter((id) => itemsById[id] != null);
}
