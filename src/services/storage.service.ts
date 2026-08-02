import * as FileSystem from 'expo-file-system/legacy';
import {deleteObject, ref} from 'firebase/storage';
import {getFirebaseAuth, getFirebaseStorage} from '@app/config/firebase';
import {isMockMode} from '@app/config/appMode';

const STORAGE_BUCKET = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '';

function normalizeBase64(base64: string): string {
  const trimmed = base64.trim();
  const commaIndex = trimmed.indexOf(',');
  return commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
}

async function getAuthToken(): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error('You must be logged in to upload images.');
  }
  return user.getIdToken(true);
}

function buildDownloadUrl(bucket: string, objectPath: string, downloadToken: string): string {
  const encodedPath = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${downloadToken}`;
}

function parseUploadResponse(body: string, fallbackPath: string): string {
  const payload = JSON.parse(body) as {
    name?: string;
    downloadTokens?: string;
  };

  const objectPath = payload.name ?? fallbackPath;
  const downloadToken = payload.downloadTokens?.split(',')[0] ?? '';
  if (!downloadToken) {
    throw new Error('Storage upload succeeded but no download token was returned.');
  }

  return buildDownloadUrl(STORAGE_BUCKET, objectPath, downloadToken);
}

async function writeBase64ToCache(base64: string): Promise<string> {
  const cacheUri = `${FileSystem.cacheDirectory}upload-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(cacheUri, normalizeBase64(base64), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return cacheUri;
}

async function uploadFileFromUri(fileUri: string, path: string): Promise<string> {
  if (!STORAGE_BUCKET) {
    throw new Error('Firebase storage bucket is not configured.');
  }

  const token = await getAuthToken();
  const uploadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o` +
    `?uploadType=media&name=${encodeURIComponent(path)}`;

  const response = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
    },
  });

  if (response.status < 200 || response.status >= 300) {
    if (response.status === 403) {
      throw new Error(
        'Storage permission denied. In Firebase Console open Storage → Rules, paste the rules from firebase/storage.rules, then click Publish.',
      );
    }
    throw new Error(response.body || `Storage upload failed (${response.status})`);
  }

  return parseUploadResponse(response.body, path);
}

async function uploadBase64ViaRest(base64: string, path: string): Promise<string> {
  const cacheUri = await writeBase64ToCache(base64);
  try {
    return await uploadFileFromUri(cacheUri, path);
  } finally {
    await FileSystem.deleteAsync(cacheUri, {idempotent: true});
  }
}

async function uploadFileUriViaRest(fileUri: string, path: string): Promise<string> {
  if (fileUri.startsWith('file://')) {
    return uploadFileFromUri(fileUri, path);
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uploadBase64ViaRest(base64, path);
}

export async function uploadImage(uri: string, path: string): Promise<string> {
  if (isMockMode) {
    return uri;
  }

  return uploadFileUriViaRest(uri, path);
}

export async function uploadImageBase64(base64: string, path: string): Promise<string> {
  if (isMockMode) {
    return `data:image/jpeg;base64,${normalizeBase64(base64)}`;
  }

  return uploadBase64ViaRest(base64, path);
}

export async function deleteImage(path: string): Promise<void> {
  if (isMockMode) {
    return;
  }
  const storageRef = ref(getFirebaseStorage(), path);
  await deleteObject(storageRef).catch(() => undefined);
}

export function storagePathFromDownloadUrl(imageUrl: string): string | null {
  if (!imageUrl.includes('firebasestorage.googleapis.com')) {
    return null;
  }

  try {
    const pathname = new URL(imageUrl).pathname;
    const encoded = pathname.split('/o/')[1];
    if (!encoded) {
      return null;
    }
    return decodeURIComponent(encoded.split('?')[0] ?? encoded);
  } catch {
    return null;
  }
}

export function getSaveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('storage/unauthorized') || error.message.includes('403')) {
      return 'Storage permission denied. Publish Storage rules in Firebase Console.';
    }
    if (
      error.message.includes('permission-denied') ||
      error.message.includes('Missing or insufficient permissions')
    ) {
      return 'Firestore permission denied. Run: firebase deploy --only firestore:rules';
    }
    if (error.message.includes('You must be logged in')) {
      return error.message;
    }
    return error.message;
  }
  return 'Failed to save. Please try again.';
}
