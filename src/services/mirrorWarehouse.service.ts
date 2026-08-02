import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb} from '@app/config/firebase';
import {useMockDb} from '@app/mock/mockDb';
import type {MirrorCatalogImageId} from '@app/types/mirrorCatalog';
import {
  normalizeMirrorWarehouseStockDoc,
  type MirrorWarehouseStockCounts,
} from '@app/types/mirrorWarehouse';
import {
  buildEmptyMirrorWarehouseStockManifest,
  normalizeMirrorWarehouseStockManifest,
  type MirrorWarehouseStockManifest,
} from '@app/types/mirrorWarehouseStock';
import {toFirestoreSafePayload} from '@app/utils/firestorePayload';
import {
  readMirrorWarehouseStockManifestCache,
  writeMirrorWarehouseStockManifestCache,
} from '@app/utils/mirrorWarehouseCache';
import {recordMirrorWarehouseStockNotification} from '@app/utils/recordAdminOperationNotifications';

const LEGACY_MIRROR_WAREHOUSE = 'mirrorWarehouse';
const MIRROR_WAREHOUSE_META = 'mirrorWarehouseMeta';
const STOCK_DOC_ID = 'stock';

let legacyStockMigrationPromise: Promise<MirrorWarehouseStockManifest | null> | null = null;
let lastAppliedStockVersion = 0;

function stockRef() {
  return doc(getFirebaseDb(), MIRROR_WAREHOUSE_META, STOCK_DOC_ID);
}

function manifestToPayload(manifest: MirrorWarehouseStockManifest): Record<string, unknown> {
  return toFirestoreSafePayload({
    version: manifest.version,
    updatedAt: manifest.updatedAt,
    counts: manifest.counts,
  }) as Record<string, unknown>;
}

async function readRemoteStockManifest(): Promise<MirrorWarehouseStockManifest | null> {
  const snap = await getDoc(stockRef());
  if (!snap.exists()) {
    return null;
  }
  return normalizeMirrorWarehouseStockManifest(snap.data() as Record<string, unknown>);
}

async function migrateLegacyStockDocsOnce(): Promise<MirrorWarehouseStockManifest | null> {
  if (legacyStockMigrationPromise) {
    return legacyStockMigrationPromise;
  }

  legacyStockMigrationPromise = (async () => {
    const existing = await readRemoteStockManifest();
    if (existing) {
      return existing;
    }

    const legacySnap = await getDocs(collection(getFirebaseDb(), LEGACY_MIRROR_WAREHOUSE));
    if (legacySnap.empty) {
      return null;
    }

    const counts: MirrorWarehouseStockCounts = {};
    for (const entry of legacySnap.docs) {
      const stock = normalizeMirrorWarehouseStockDoc(entry.id, entry.data());
      if (stock && stock.count > 0) {
        counts[stock.catalogImageId] = stock.count;
      }
    }

    if (Object.keys(counts).length === 0) {
      return null;
    }

    const manifest: MirrorWarehouseStockManifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      counts,
    };

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const current = await transaction.get(stockRef());
      if (current.exists()) {
        return;
      }
      transaction.set(stockRef(), manifestToPayload(manifest));
    });

    await writeMirrorWarehouseStockManifestCache(manifest);
    return manifest;
  })().catch((error) => {
    console.warn('[mirrorWarehouse] legacy migration failed', error);
    return null;
  });

  return legacyStockMigrationPromise;
}

async function persistStockCounts(counts: MirrorWarehouseStockCounts): Promise<MirrorWarehouseStockManifest> {
  return runTransaction(getFirebaseDb(), async (transaction) => {
    const snap = await transaction.get(stockRef());
    const current = snap.exists()
      ? normalizeMirrorWarehouseStockManifest(snap.data() as Record<string, unknown>) ??
        buildEmptyMirrorWarehouseStockManifest()
      : buildEmptyMirrorWarehouseStockManifest();

    const next: MirrorWarehouseStockManifest = {
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      counts,
    };

    transaction.set(stockRef(), manifestToPayload(next));
    return next;
  });
}

async function applyStockManifest(
  manifest: MirrorWarehouseStockManifest,
  callback: (counts: MirrorWarehouseStockCounts) => void,
) {
  if (manifest.version === lastAppliedStockVersion) {
    return;
  }
  lastAppliedStockVersion = manifest.version;
  await writeMirrorWarehouseStockManifestCache(manifest);
  callback(manifest.counts);
}

export function subscribeToMirrorWarehouseStock(
  callback: (counts: MirrorWarehouseStockCounts) => void,
): Unsubscribe {
  if (isMockMode) {
    callback({...useMockDb.getState().mirrorWarehouseStock});
    return useMockDb.subscribe((state) => {
      callback({...state.mirrorWarehouseStock});
    });
  }

  let cancelled = false;

  void (async () => {
    const cached = await readMirrorWarehouseStockManifestCache();
    if (cached && !cancelled) {
      lastAppliedStockVersion = cached.version;
      callback(cached.counts);
    }
  })();

  const unsub = onSnapshot(
    stockRef(),
    (snap) => {
      void (async () => {
        if (cancelled) {
          return;
        }

        if (!snap.exists()) {
          const migrated = await migrateLegacyStockDocsOnce();
          if (migrated) {
            await applyStockManifest(migrated, callback);
            return;
          }
          callback({});
          return;
        }

        const manifest = normalizeMirrorWarehouseStockManifest(snap.data() as Record<string, unknown>);
        if (!manifest) {
          callback({});
          return;
        }

        await applyStockManifest(manifest, callback);
      })();
    },
    (error) => {
      console.warn('[mirrorWarehouse] stock listener failed', error);
      callback({});
    },
  );

  return () => {
    cancelled = true;
    unsub();
  };
}

export async function adjustMirrorWarehouseCount(
  catalogImageId: MirrorCatalogImageId,
  delta: number,
): Promise<void> {
  if (!Number.isFinite(delta) || delta === 0) {
    return;
  }

  if (isMockMode) {
    const current = useMockDb.getState().mirrorWarehouseStock[catalogImageId] ?? 0;
    const next = Math.max(0, current + delta);
    useMockDb.getState().setMirrorWarehouseCount(catalogImageId, next);
    recordMirrorWarehouseStockNotification(catalogImageId, delta, next);
    return;
  }

  const current = (await readRemoteStockManifest()) ?? buildEmptyMirrorWarehouseStockManifest();
  const previous = current.counts[catalogImageId] ?? 0;
  const next = Math.max(0, previous + delta);
  const counts = {...current.counts};

  if (next === 0) {
    delete counts[catalogImageId];
  } else {
    counts[catalogImageId] = next;
  }

  await persistStockCounts(counts);
  recordMirrorWarehouseStockNotification(catalogImageId, delta, next);
}

export async function clearMirrorWarehouseStock(catalogImageId: MirrorCatalogImageId): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().setMirrorWarehouseCount(catalogImageId, 0);
    return;
  }

  const current = (await readRemoteStockManifest()) ?? buildEmptyMirrorWarehouseStockManifest();
  if (!(catalogImageId in current.counts)) {
    return;
  }

  const counts = {...current.counts};
  delete counts[catalogImageId];
  await persistStockCounts(counts);
}
