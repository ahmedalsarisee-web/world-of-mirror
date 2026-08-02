import type {RefObject} from 'react';

import type {View} from 'react-native';

import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';

import {getMirrorCatalogDisplaySource} from '@app/data/mirrorCatalogImageAssets';

import {catalogImageToPickedImage} from '@app/utils/catalogImageTextAnnotations';

import {

  isEmptyCatalogImageTextAnnotation,

  type CatalogImageTextAnnotation,

} from '@app/utils/catalogImageTextEditor';

import type {LangCode} from '@app/types/language';

import {getRemoteImageNaturalSize} from '@app/utils/catalogImageTextAnnotations';

import {

  isImageMarkerAvailable,

  markCatalogImageWithText,

  markRemoteImageWithText,

} from '@app/utils/catalogImageMarker';

import {materializeLocalImageFile} from '@app/utils/materializeLocalImageFile';

import {

  saveImageFileToGallery,

  type SaveImageToGalleryResult,

} from '@app/utils/saveImageToGalleryOrShare';



function getSafeCaptureFileName(fileStem: string): string {

  const base = fileStem.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');

  const normalized = base || 'mirror_catalog';

  return normalized.length >= 3 ? normalized : 'mirror_catalog';

}



async function waitForCaptureFrame(): Promise<void> {

  await new Promise<void>((resolve) => {

    requestAnimationFrame(() => {

      requestAnimationFrame(() => {

        requestAnimationFrame(() => resolve());

      });

    });

  });

}



async function persistJpegToGallery(jpegUri: string): Promise<SaveImageToGalleryResult> {

  return saveImageFileToGallery(jpegUri);

}



export async function saveCatalogImageViewToGallery(

  viewRef: RefObject<View | null>,

  fileStem: string,

): Promise<SaveImageToGalleryResult> {

  if (!viewRef.current) {

    throw new Error('Capture view not mounted');

  }



  await waitForCaptureFrame();



  const {captureRef} = await import('react-native-view-shot');

  const uri = await captureRef(viewRef.current, {

    format: 'jpg',

    quality: 0.95,

    result: 'tmpfile',

    fileName: getSafeCaptureFileName(fileStem),

  });



  const jpegUri = await materializeLocalImageFile({

    uri,

    fileStem,

  });



  return persistJpegToGallery(jpegUri);

}



async function saveAnnotatedImageWithFallback(params: {

  fileStem: string;

  captureViewRef?: RefObject<View | null>;

  renderWithMarker: () => Promise<string>;

}): Promise<SaveImageToGalleryResult> {

  if (params.captureViewRef?.current) {

    try {

      return await saveCatalogImageViewToGallery(params.captureViewRef, params.fileStem);

    } catch {

      // Fall back to native marker when on-screen capture is unavailable.

    }

  }



  if (isImageMarkerAvailable()) {

    const sourceUri = await params.renderWithMarker();

    const jpegUri = await materializeLocalImageFile({

      uri: sourceUri,

      fileStem: params.fileStem,

    });

    return persistJpegToGallery(jpegUri);

  }



  throw new Error('Image marker native module is not available');

}



export async function saveMarkedCatalogImageToGallery(params: {

  imageId: MirrorCatalogImageId;

  annotation?: CatalogImageTextAnnotation;

  language: LangCode;

  fileStem: string;

  captureViewRef?: RefObject<View | null>;

}): Promise<SaveImageToGalleryResult> {

  const hasAnnotation = Boolean(

    params.annotation && !isEmptyCatalogImageTextAnnotation(params.annotation),

  );

  const bundledSource = getMirrorCatalogDisplaySource(params.imageId);



  if (!hasAnnotation) {

    const picked = await catalogImageToPickedImage(params.imageId);

    if (!picked?.uri) {

      throw new Error('Catalog image missing');

    }

    const jpegUri = await materializeLocalImageFile({

      uri: picked.uri,

      fileStem: params.fileStem,

      bundledSource,

    });

    return persistJpegToGallery(jpegUri);

  }



  return saveAnnotatedImageWithFallback({

    fileStem: params.fileStem,

    captureViewRef: params.captureViewRef,

    renderWithMarker: () =>

      markCatalogImageWithText({

        imageId: params.imageId,

        annotation: params.annotation!,

        language: params.language,

        filenameStem: params.fileStem,

      }),

  });

}



export async function saveMarkedRemoteImageToGallery(params: {

  imageUri: string;

  imageKey: string;

  imageWidth?: number;

  imageHeight?: number;

  annotation?: CatalogImageTextAnnotation;

  language: LangCode;

  fileStem: string;

  captureViewRef?: RefObject<View | null>;

}): Promise<SaveImageToGalleryResult> {

  const hasAnnotation = Boolean(

    params.annotation && !isEmptyCatalogImageTextAnnotation(params.annotation),

  );



  if (!hasAnnotation) {

    const jpegUri = await materializeLocalImageFile({

      uri: params.imageUri,

      fileStem: params.fileStem,

    });

    return persistJpegToGallery(jpegUri);

  }



  return saveAnnotatedImageWithFallback({

    fileStem: params.fileStem,

    captureViewRef: params.captureViewRef,

    renderWithMarker: async () => {

      let imageWidth = params.imageWidth;

      let imageHeight = params.imageHeight;

      if (!imageWidth || !imageHeight) {

        const naturalSize = await getRemoteImageNaturalSize(params.imageUri);

        imageWidth = naturalSize.width;

        imageHeight = naturalSize.height;

      }



      const materializedUri = await materializeLocalImageFile({

        uri: params.imageUri,

        fileStem: params.fileStem,

      });



      return markRemoteImageWithText({

        imageKey: params.imageKey,

        imageUri: materializedUri,

        imageWidth,

        imageHeight,

        annotation: params.annotation!,

        language: params.language,

        filenameStem: params.fileStem,

      });

    },

  });

}


