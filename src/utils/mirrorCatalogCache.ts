import AsyncStorage from '@react-native-async-storage/async-storage';
import type {MirrorCatalogManifest} from '@app/types/mirrorCatalogManifest';
import {normalizeMirrorCatalogManifest} from '@app/types/mirrorCatalogManifest';

const CACHE_KEY = 'mirrorCatalogManifestCache';

export async function readMirrorCatalogManifestCache(): Promise<MirrorCatalogManifest | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizeMirrorCatalogManifest(parsed);
  } catch {
    return null;
  }
}

export async function writeMirrorCatalogManifestCache(manifest: MirrorCatalogManifest): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(manifest));
  } catch {
    // Cache is optional — Firestore remains source of truth.
  }
}

export async function clearMirrorCatalogManifestCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore cache clear failures.
  }
}
