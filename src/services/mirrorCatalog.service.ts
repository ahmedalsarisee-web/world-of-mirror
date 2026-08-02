import {Image} from 'react-native';
import {manipulateAsync, SaveFormat} from 'expo-image-manipulator';
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
import {clearMirrorWarehouseStock} from '@app/services/mirrorWarehouse.service';
import {getSaveErrorMessage, uploadImage} from '@app/services/storage.service';
import {
  recordMirrorCatalogDeletedNotification,
  recordMirrorCatalogUploadedNotification,
} from '@app/utils/recordAdminOperationNotifications';
import {
  normalizeMirrorCatalogDoc,
  type MirrorCatalogImageId,
  type MirrorCatalogItem,
} from '@app/types/mirrorCatalog';
import {
  buildEmptyMirrorCatalogManifest,
  normalizeMirrorCatalogManifest,
  type MirrorCatalogManifest,
} from '@app/types/mirrorCatalogManifest';
import {toFirestoreSafePayload} from '@app/utils/firestorePayload';
import type {PickedImage} from '@app/utils/imagePicker';
import {
  readMirrorCatalogManifestCache,
  writeMirrorCatalogManifestCache,
} from '@app/utils/mirrorCatalogCache';
import {
  resolveCatalogSectionKey,
  resolveCatalogSortOrder,
} from '@app/utils/mirrorCatalogSections';

const LEGACY_MIRROR_CATALOG = 'mirrorCatalog';
const MIRROR_CATALOG_META = 'mirrorCatalogMeta';
const MANIFEST_DOC_ID = 'manifest';

const THUMB_MAX_EDGE = 240;
const DISPLAY_MAX_EDGE = 1280;

let legacyCatalogMigrationPromise: Promise<MirrorCatalogManifest | null> | null = null;
let lastAppliedManifestVersion = 0;

function sanitizeCatalogSection(section: string): string {
  return section.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'other';
}

function createCatalogImageId(sourceName?: string): string {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const base = (sourceName ?? '')
    .trim()
    .replace(/[/\\]+/g, '_')
    .replace(/[^\w.\-() \u0600-\u06FF]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  return base ? `${stamp}-${base}` : stamp;
}

function buildCatalogStoragePath(
  imageId: string,
  section: string,
  variant: 'thumb' | 'display',
): string {
  const safeSection = sanitizeCatalogSection(section);
  return `mirrorCatalog/sections/${safeSection}/${imageId}/${variant}.jpg`;
}

function manifestRef() {
  return doc(getFirebaseDb(), MIRROR_CATALOG_META, MANIFEST_DOC_ID);
}

function manifestToPayload(manifest: MirrorCatalogManifest): Record<string, unknown> {
  return toFirestoreSafePayload({
    version: manifest.version,
    updatedAt: manifest.updatedAt,
    items: manifest.items,
  }) as Record<string, unknown>;
}

async function readRemoteManifest(): Promise<MirrorCatalogManifest | null> {
  const snap = await getDoc(manifestRef());
  if (!snap.exists()) {
    return null;
  }
  return normalizeMirrorCatalogManifest(snap.data() as Record<string, unknown>);
}

async function migrateLegacyCatalogDocsOnce(): Promise<MirrorCatalogManifest | null> {
  if (legacyCatalogMigrationPromise) {
    return legacyCatalogMigrationPromise;
  }

  legacyCatalogMigrationPromise = (async () => {
    const existing = await readRemoteManifest();
    if (existing) {
      return existing;
    }

    const legacySnap = await getDocs(collection(getFirebaseDb(), LEGACY_MIRROR_CATALOG));
    if (legacySnap.empty) {
      return null;
    }

    const items = legacySnap.docs
      .map((entry) => normalizeMirrorCatalogDoc(entry.id, entry.data()))
      .filter((item): item is MirrorCatalogItem => item !== null);

    if (items.length === 0) {
      return null;
    }

    const manifest: MirrorCatalogManifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      items,
    };

    await runTransaction(getFirebaseDb(), async (transaction) => {
      const current = await transaction.get(manifestRef());
      if (current.exists()) {
        return;
      }
      transaction.set(manifestRef(), manifestToPayload(manifest));
    });

    await writeMirrorCatalogManifestCache(manifest);
    return manifest;
  })().catch((error) => {
    console.warn('[mirrorCatalog] legacy migration failed', error);
    return null;
  });

  return legacyCatalogMigrationPromise;
}

async function persistManifestItems(items: MirrorCatalogItem[]): Promise<MirrorCatalogManifest> {
  return runTransaction(getFirebaseDb(), async (transaction) => {
    const snap = await transaction.get(manifestRef());
    const current = snap.exists()
      ? normalizeMirrorCatalogManifest(snap.data() as Record<string, unknown>) ?? buildEmptyMirrorCatalogManifest()
      : buildEmptyMirrorCatalogManifest();

    const next: MirrorCatalogManifest = {
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      items,
    };

    transaction.set(manifestRef(), manifestToPayload(next));
    return next;
  });
}

async function applyManifest(manifest: MirrorCatalogManifest, callback: (items: MirrorCatalogItem[]) => void) {
  if (manifest.version === lastAppliedManifestVersion) {
    return;
  }
  lastAppliedManifestVersion = manifest.version;
  await writeMirrorCatalogManifestCache(manifest);
  callback(manifest.items);
}

async function readImageSize(uri: string): Promise<{width: number; height: number} | null> {
  try {
    return await new Promise<{width: number; height: number}>((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => resolve({width, height}),
        (error) => reject(error),
      );
    });
  } catch {
    return null;
  }
}

async function compressCatalogImage(
  uri: string,
  maxEdge: number,
  compress: number,
): Promise<{uri: string; width: number; height: number}> {
  const attempts: Array<{resize: {width: number}}[] | []> = [[{resize: {width: maxEdge}}], []];
  let lastError: unknown = null;

  for (const actions of attempts) {
    try {
      const result = await manipulateAsync(uri, actions, {
        compress,
        format: SaveFormat.JPEG,
      });

      if (!result.uri) {
        continue;
      }

      const measured = await readImageSize(result.uri);
      return {
        uri: result.uri,
        width: measured?.width ?? maxEdge,
        height: measured?.height ?? maxEdge,
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Image compression failed');
}

export function subscribeToMirrorCatalog(
  callback: (items: MirrorCatalogItem[]) => void,
): Unsubscribe {
  if (isMockMode) {
    callback([...useMockDb.getState().mirrorCatalogItems]);
    return useMockDb.subscribe((state) => {
      callback([...state.mirrorCatalogItems]);
    });
  }

  let cancelled = false;

  void (async () => {
    const cached = await readMirrorCatalogManifestCache();
    if (cached && !cancelled) {
      lastAppliedManifestVersion = cached.version;
      callback(cached.items);
    }
  })();

  const unsub = onSnapshot(
    manifestRef(),
    (snap) => {
      void (async () => {
        if (cancelled) {
          return;
        }

        if (!snap.exists()) {
          const migrated = await migrateLegacyCatalogDocsOnce();
          if (migrated) {
            await applyManifest(migrated, callback);
            return;
          }
          callback([]);
          return;
        }

        const manifest = normalizeMirrorCatalogManifest(snap.data() as Record<string, unknown>);
        if (!manifest) {
          callback([]);
          return;
        }

        await applyManifest(manifest, callback);
      })();
    },
    (error) => {
      console.warn('[mirrorCatalog] manifest listener failed', error);
      callback([]);
    },
  );

  return () => {
    cancelled = true;
    unsub();
  };
}

export async function uploadMirrorCatalogImage(
  image: PickedImage,
  sourceName?: string,
  options?: {section?: string; sortOrder?: number},
): Promise<MirrorCatalogItem> {
  const imageId = createCatalogImageId(sourceName ?? image.uri.split('/').pop());
  const now = new Date().toISOString();
  const section = options?.section ?? resolveCatalogSectionKey(sourceName ?? imageId);
  const sortOrder = options?.sortOrder ?? resolveCatalogSortOrder(sourceName ?? imageId);

  const display = await compressCatalogImage(image.uri, DISPLAY_MAX_EDGE, 0.82);
  const thumb = await compressCatalogImage(display.uri, THUMB_MAX_EDGE, 0.72);

  if (isMockMode) {
    const item: MirrorCatalogItem = {
      id: imageId,
      thumbUrl: thumb.uri,
      displayUrl: display.uri,
      section,
      sortOrder,
      width: display.width,
      height: display.height,
      createdAt: now,
      updatedAt: now,
    };
    useMockDb.getState().addMirrorCatalogItem(item);
    return item;
  }

  const thumbUrl = await uploadImage(thumb.uri, buildCatalogStoragePath(imageId, section, 'thumb'));
  const displayUrl = await uploadImage(display.uri, buildCatalogStoragePath(imageId, section, 'display'));

  const item: MirrorCatalogItem = {
    id: imageId,
    thumbUrl,
    displayUrl,
    section,
    sortOrder,
    width: display.width,
    height: display.height,
    createdAt: now,
    updatedAt: now,
  };

  const current = (await readRemoteManifest()) ?? buildEmptyMirrorCatalogManifest();
  const nextItems = [...current.items.filter((entry) => entry.id !== item.id), item];
  await persistManifestItems(nextItems);

  return item;
}

export async function uploadMirrorCatalogImages(
  images: PickedImage[],
  options?: {section?: string},
): Promise<MirrorCatalogItem[]> {
  const uploaded: MirrorCatalogItem[] = [];
  let lastError: unknown = null;
  const baseSortOrder = Date.now();

  for (const image of images) {
    try {
      const sourceName = image.uri.split('/').pop() ?? undefined;
      uploaded.push(
        await uploadMirrorCatalogImage(image, sourceName, {
          section: options?.section ?? 'uploads',
          sortOrder: baseSortOrder + uploaded.length,
        }),
      );
    } catch (error) {
      console.warn('[mirrorCatalog] upload failed', error);
      lastError = error;
    }
  }

  if (uploaded.length === 0 && lastError) {
    throw lastError;
  }

  if (uploaded.length > 0) {
    recordMirrorCatalogUploadedNotification(uploaded.length);
  }

  return uploaded;
}

export async function deleteMirrorCatalogImage(imageId: MirrorCatalogImageId): Promise<void> {
  const now = new Date().toISOString();

  if (isMockMode) {
    useMockDb.getState().removeMirrorCatalogItem(imageId);
    useMockDb.getState().setMirrorWarehouseCount(imageId, 0);
    return;
  }

  const current = (await readRemoteManifest()) ?? buildEmptyMirrorCatalogManifest();
  if (!current.items.some((entry) => entry.id === imageId)) {
    await clearMirrorWarehouseStock(imageId);
    return;
  }

  const nextItems = current.items.map((entry) =>
    entry.id === imageId
      ? {...entry, removedFromWarehouseAt: now, updatedAt: now}
      : entry,
  );
  await persistManifestItems(nextItems);
  await clearMirrorWarehouseStock(imageId);
  recordMirrorCatalogDeletedNotification(imageId);
}

export {getSaveErrorMessage as getMirrorCatalogSaveErrorMessage};
