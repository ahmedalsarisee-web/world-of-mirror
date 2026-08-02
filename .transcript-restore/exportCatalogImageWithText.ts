import {Platform} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {catalogImageToPickedImage} from '@app/utils/catalogImageTextAnnotations';
import {
  isEmptyCatalogImageTextAnnotation,
  type CatalogImageTextAnnotation,
} from '@app/utils/catalogImageTextEditor';

function getSafeCaptureFileName(fileStem: string): string {
  const base = fileStem.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');
  const normalized = base || 'mirror_catalog';
  return normalized.length >= 3 ? normalized : 'mirror_catalog';
}

async function ensureLocalJpegUri(uri: string, fileStem: string): Promise<string> {
  const safeStem = getSafeCaptureFileName(fileStem);
  const normalized = uri.startsWith('file://') ? uri : `file://${uri}`;

  const fileInfo = await FileSystem.getInfoAsync(normalized);
  if (!fileInfo.exists) {
    throw new Error('Captured file missing');
  }

  if (/\.jpe?g$/i.test(normalized)) {
    return normalized;
  }

  const destination = `${FileSystem.cacheDirectory}${safeStem}.jpg`;
  await FileSystem.copyAsync({from: normalized, to: destination});
  return destination;
}

function hasMediaLibraryAccess(
  permission: Awaited<
    ReturnType<(typeof import('expo-media-library/legacy'))['getPermissionsAsync']>
  >,
): boolean {
  return (
    permission.granted ||
    permission.accessPrivileges === 'limited' ||
    permission.accessPrivileges === 'all'
  );
}

async function ensureGallerySavePermission(): Promise<void> {
  const MediaLibrary = await import('expo-media-library/legacy');

  const writeOnlyCurrent = await MediaLibrary.getPermissionsAsync(true, ['photo']);
  if (hasMediaLibraryAccess(writeOnlyCurrent)) {
    return;
  }

  const writeOnlyRequested = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
  if (hasMediaLibraryAccess(writeOnlyRequested)) {
    return;
  }

  if (Platform.OS === 'android') {
    const readWriteCurrent = await MediaLibrary.getPermissionsAsync(false, ['photo']);
    if (hasMediaLibraryAccess(readWriteCurrent)) {
      return;
    }

    const readWriteRequested = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
    if (hasMediaLibraryAccess(readWriteRequested)) {
      return;
    }
  }

  throw new Error('Permission denied');
}

async function saveUriToGallery(jpegUri: string): Promise<void> {
  const MediaLibrary = await import('expo-media-library/legacy');

  await ensureGallerySavePermission();

  let lastError: unknown;
  try {
    await MediaLibrary.createAssetAsync(jpegUri);
    return;
  } catch (error) {
    lastError = error;
  }

  try {
    await MediaLibrary.saveToLibraryAsync(jpegUri);
    return;
  } catch (error) {
    lastError = error;
  }

  throw lastError instanceof Error ? lastError : new Error('Save failed');
}

export async function saveCatalogImageWithTextToGallery(params: {
  imageId: MirrorCatalogImageId;
  annotation?: CatalogImageTextAnnotation;
  fileStem: string;
  captureUri: string;
}): Promise<void> {
  const jpegUri = await ensureLocalJpegUri(params.captureUri, params.fileStem);
  await saveUriToGallery(jpegUri);
}

export async function resolveCatalogImageUriForCapture(
  imageId: MirrorCatalogImageId,
): Promise<string | null> {
  const picked = await catalogImageToPickedImage(imageId);
  return picked?.uri ?? null;
}

export function shouldCaptureAnnotatedCatalogImage(
  annotation?: CatalogImageTextAnnotation,
): boolean {
  return Boolean(annotation && !isEmptyCatalogImageTextAnnotation(annotation));
}
