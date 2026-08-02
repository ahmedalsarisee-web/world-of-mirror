import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  normalizeMirrorWarehouseStockManifest,
  type MirrorWarehouseStockManifest,
} from '@app/types/mirrorWarehouseStock';

const CACHE_KEY = 'mirrorWarehouseStockManifestCache';

export async function readMirrorWarehouseStockManifestCache(): Promise<MirrorWarehouseStockManifest | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizeMirrorWarehouseStockManifest(parsed);
  } catch {
    return null;
  }
}

export async function writeMirrorWarehouseStockManifestCache(
  manifest: MirrorWarehouseStockManifest,
): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(manifest));
  } catch {
    // Cache is optional — Firestore remains source of truth.
  }
}
