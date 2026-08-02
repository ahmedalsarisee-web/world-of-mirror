import {Platform} from 'react-native';
import Constants from 'expo-constants';

export type SaveImageToGalleryResult = 'saved' | 'shared';

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

function isExpoGoAndroid(): boolean {
  return Platform.OS === 'android' && isExpoGo();
}

function hasGalleryWriteAccess(
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

function normalizeGalleryUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith('file://') || trimmed.startsWith('content://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `file://${trimmed}`;
  }
  return trimmed;
}

async function ensureGallerySavePermission(): Promise<void> {
  const MediaLibrary = await import('expo-media-library/legacy');

  // Expo Go blocks photo/video permission APIs on Android. Saving still works via
  // MediaStore insert on Android 10+ without requesting READ_MEDIA_IMAGES.
  if (isExpoGoAndroid()) {
    return;
  }

  const writeOnlyCurrent = await MediaLibrary.getPermissionsAsync(true, ['photo']);
  if (hasGalleryWriteAccess(writeOnlyCurrent)) {
    return;
  }

  const writeOnlyRequested = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
  if (hasGalleryWriteAccess(writeOnlyRequested)) {
    return;
  }

  if (Platform.OS === 'android') {
    const readWriteCurrent = await MediaLibrary.getPermissionsAsync(false, ['photo']);
    if (hasGalleryWriteAccess(readWriteCurrent)) {
      return;
    }

    const readWriteRequested = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
    if (hasGalleryWriteAccess(readWriteRequested)) {
      return;
    }
  }

  throw new Error('Permission denied');
}

async function shareImageFallback(jpegUri: string): Promise<void> {
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Save failed');
  }

  await Sharing.shareAsync(normalizeGalleryUri(jpegUri), {
    mimeType: 'image/jpeg',
    UTI: 'public.jpeg',
    dialogTitle: 'Save image',
  });
}

async function saveImageFileToGalleryDirect(jpegUri: string): Promise<void> {
  const MediaLibrary = await import('expo-media-library/legacy');
  const normalizedUri = normalizeGalleryUri(jpegUri);

  let lastError: unknown;
  try {
    await MediaLibrary.saveToLibraryAsync(normalizedUri);
    return;
  } catch (error) {
    lastError = error;
  }

  try {
    await MediaLibrary.createAssetAsync(normalizedUri);
    return;
  } catch (error) {
    lastError = error;
  }

  if (isExpoGoAndroid()) {
    throw new Error('Expo Go gallery save unavailable');
  }

  throw lastError instanceof Error ? lastError : new Error('Save failed');
}

export async function saveImageFileToGallery(jpegUri: string): Promise<SaveImageToGalleryResult> {
  await ensureGallerySavePermission();

  try {
    await saveImageFileToGalleryDirect(jpegUri);
    return 'saved';
  } catch (primaryError) {
    if (primaryError instanceof Error && primaryError.message === 'Permission denied') {
      throw primaryError;
    }
    if (primaryError instanceof Error && primaryError.message === 'Expo Go gallery save unavailable') {
      throw primaryError;
    }

    try {
      await shareImageFallback(jpegUri);
      return 'shared';
    } catch {
      throw primaryError instanceof Error ? primaryError : new Error('Save failed');
    }
  }
}

export function isDirectGallerySaveLimited(): boolean {
  return isExpoGoAndroid();
}
