import * as FileSystem from 'expo-file-system/legacy';
import type {PickedImage} from '@app/utils/imagePicker';

export type ImageTextPosition = 'top' | 'center' | 'bottom';
export type ImageTextSize = 'sm' | 'md' | 'lg';

export const IMAGE_TEXT_COLORS = ['#FFFFFF', '#111827', '#E53935', '#2563EB', '#F59E0B'] as const;

export const IMAGE_TEXT_SIZE_MAP: Record<ImageTextSize, number> = {
  sm: 22,
  md: 30,
  lg: 40,
};

export async function uriToPickedImage(uri: string): Promise<PickedImage> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {uri, base64};
}
