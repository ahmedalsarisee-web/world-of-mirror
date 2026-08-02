import type {MirrorCatalogImageId} from '@app/types/mirrorCatalog';
import {getMirrorCatalogDisplayUrl} from '@app/data/mirrorCatalogImageAssets';
import {materializeLocalImageFile} from '@app/utils/materializeLocalImageFile';
import {saveImageFileToGallery, type SaveImageToGalleryResult} from '@app/utils/saveImageToGalleryOrShare';

export async function saveCatalogImageToGallery(params: {
  imageId: MirrorCatalogImageId;
  fileStem: string;
}): Promise<SaveImageToGalleryResult> {
  const displayUrl = getMirrorCatalogDisplayUrl(params.imageId);
  if (!displayUrl) {
    throw new Error('Catalog image missing');
  }

  const jpegUri = await materializeLocalImageFile({
    uri: displayUrl,
    fileStem: params.fileStem,
    useStableCache: true,
  });

  return saveImageFileToGallery(jpegUri);
}
