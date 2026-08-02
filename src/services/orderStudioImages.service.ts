import {manipulateAsync, SaveFormat} from 'expo-image-manipulator';
import {isMockMode} from '@app/config/appMode';
import {getSaveErrorMessage, uploadImage} from '@app/services/storage.service';
import type {PickedImage} from '@app/utils/imagePicker';

const STUDIO_UPLOAD_COMPRESS = 0.5;

async function compressStudioPickedImage(image: PickedImage): Promise<PickedImage> {
  try {
    const compressed = await manipulateAsync(image.uri, [], {
      compress: STUDIO_UPLOAD_COMPRESS,
      format: SaveFormat.JPEG,
    });
    if (compressed.uri) {
      return {uri: compressed.uri};
    }
  } catch {
    // Some gallery formats (HEIC, content://) fail conversion — upload the original pick.
  }
  return image;
}

function buildOrderStudioImagePath(userId: string, index: number): string {
  const stamp = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`;
  return `orderStudioImages/${userId}/${stamp}.jpg`;
}

export async function uploadOrderStudioImages(
  images: PickedImage[],
  userId: string,
): Promise<string[]> {
  if (!images.length) {
    return [];
  }

  const urls: string[] = [];
  let lastError: unknown = null;

  for (let index = 0; index < images.length; index += 1) {
    try {
      const image = await compressStudioPickedImage(images[index]);
      if (isMockMode) {
        urls.push(image.uri);
        continue;
      }
      const downloadUrl = await uploadImage(image.uri, buildOrderStudioImagePath(userId, index));
      urls.push(downloadUrl);
    } catch (error) {
      lastError = error;
    }
  }

  if (urls.length === 0 && lastError) {
    throw lastError;
  }

  return urls;
}

export {getSaveErrorMessage as getOrderStudioImageSaveErrorMessage};
