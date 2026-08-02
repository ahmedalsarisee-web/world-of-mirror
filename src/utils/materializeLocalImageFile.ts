import {Asset} from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import {manipulateAsync, SaveFormat} from 'expo-image-manipulator';
import {Image, type ImageSourcePropType} from 'react-native';

function sanitizeFileStem(fileStem: string): string {
  const base = fileStem.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');
  const normalized = base || 'mirror_catalog';
  return normalized.length >= 3 ? normalized : 'mirror_catalog';
}

function normalizeReadableUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith('file://') || /^https?:\/\//i.test(trimmed) || trimmed.startsWith('content://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `file://${trimmed}`;
  }
  return trimmed;
}

async function fileExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

async function materializeImageToCache(sourceUri: string, cacheStem: string): Promise<string> {
  const normalizedSource = normalizeReadableUri(sourceUri);
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Cache directory unavailable');
  }

  if (/\.webp$/i.test(normalizedSource)) {
    const webpPath = `${cacheDir}${cacheStem}.webp`;
    if (await fileExists(webpPath)) {
      return webpPath;
    }
    await FileSystem.copyAsync({from: normalizedSource, to: webpPath});
    return webpPath;
  }

  const jpgPath = `${cacheDir}${cacheStem}.jpg`;
  if (/\.jpe?g$/i.test(normalizedSource)) {
    if (await fileExists(jpgPath)) {
      return jpgPath;
    }
    if (normalizedSource === jpgPath) {
      return jpgPath;
    }
    await FileSystem.copyAsync({from: normalizedSource, to: jpgPath});
    return jpgPath;
  }

  if (await fileExists(jpgPath)) {
    return jpgPath;
  }

  const converted = await manipulateAsync(
    normalizedSource,
    [],
    {compress: 0.95, format: SaveFormat.JPEG},
  );

  if (!converted.uri) {
    throw new Error('Image conversion failed');
  }

  if (converted.uri === jpgPath) {
    return jpgPath;
  }

  await FileSystem.copyAsync({from: converted.uri, to: jpgPath});
  return jpgPath;
}

async function materializeBundledSource(
  bundledSource: ImageSourcePropType,
  cacheStem: string,
): Promise<string | null> {
  if (typeof bundledSource === 'number') {
    const asset = Asset.fromModule(bundledSource);
    await asset.downloadAsync();
    const localUri = asset.localUri ?? asset.uri;
    if (localUri) {
      return materializeImageToCache(localUri, cacheStem);
    }
  }

  const resolved = Image.resolveAssetSource(bundledSource);
  if (!resolved?.uri) {
    return null;
  }

  try {
    const asset = Asset.fromURI(resolved.uri);
    await asset.downloadAsync();
    const localUri = asset.localUri ?? asset.uri;
    if (localUri) {
      return materializeImageToCache(localUri, cacheStem);
    }
  } catch {
    if (await fileExists(resolved.uri)) {
      return materializeImageToCache(resolved.uri, cacheStem);
    }
  }

  return null;
}

/**
 * Copies any image URI (bundled asset, cache, remote, content) into a readable JPEG file
 * under the app cache — required for gallery export and native image marker in release APKs.
 */
export async function materializeLocalImageFile(params: {
  uri: string;
  fileStem: string;
  bundledSource?: ImageSourcePropType | null;
  useStableCache?: boolean;
}): Promise<string> {
  const safeStem = sanitizeFileStem(params.fileStem);
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Cache directory unavailable');
  }
  const cacheStem = params.useStableCache ? safeStem : `${safeStem}_${Date.now()}`;
  const uri = params.uri.trim();

  if (params.bundledSource) {
    const bundled = await materializeBundledSource(params.bundledSource, cacheStem);
    if (bundled) {
      return bundled;
    }
  }

  if (/^https?:\/\//i.test(uri)) {
    const downloaded = await FileSystem.downloadAsync(uri, `${cacheDir}${cacheStem}.jpg`);
    return materializeImageToCache(downloaded.uri, cacheStem);
  }

  const normalized = normalizeReadableUri(uri);
  if (normalized && (await fileExists(normalized))) {
    return materializeImageToCache(normalized, cacheStem);
  }

  if (uri) {
    try {
      const asset = Asset.fromURI(uri);
      await asset.downloadAsync();
      const localUri = asset.localUri ?? asset.uri;
      if (localUri) {
        return materializeImageToCache(localUri, cacheStem);
      }
    } catch {
      // Fall through to not-found error.
    }
  }

  throw new Error('Image file unavailable');
}
