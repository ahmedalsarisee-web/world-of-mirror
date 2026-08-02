import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Image, StyleSheet, View} from 'react-native';
import {useLanguage} from '@app/context/LangContext';
import {useDirection} from '@app/hooks/useDirection';
import CatalogImageThumb from '@app/components/common/catalogImageText/CatalogImageThumb';
import CatalogImageTextOverlay from '@app/components/common/catalogImageText/CatalogImageTextOverlay';
import {
  getMirrorCatalogImageNaturalSize,
  getMirrorCatalogImageSource,
  type MirrorCatalogImageId,
} from '@app/data/mirrorCatalogImages';
import {
  CATALOG_IMAGE_COORDINATE_LAYER_STYLE,
  getCatalogImageLayout,
  isCatalogImageLayoutReady,
  isEmptyCatalogImageTextAnnotation,
  type CatalogImageTextAnnotation,
} from '@app/utils/catalogImageTextEditor';

interface Props {
  imageId: MirrorCatalogImageId;
  annotation?: CatalogImageTextAnnotation;
  width: number;
  height: number;
  borderRadius?: number;
  onCaptureReady?: () => void;
}

const CatalogImageWithTextOverlayAnnotated: React.FC<Required<Pick<Props, 'annotation'>> & Props> = ({
  imageId,
  annotation,
  width,
  height,
  borderRadius = 0,
  onCaptureReady,
}) => {
  const {language} = useLanguage();
  const {appFont} = useDirection();
  const fontFamily = appFont('bold').fontFamily;
  const source = getMirrorCatalogImageSource(imageId);
  const syncNaturalSize = useMemo(() => getMirrorCatalogImageNaturalSize(imageId), [imageId]);
  const [naturalSize, setNaturalSize] = useState<{width: number; height: number} | null>(syncNaturalSize);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setNaturalSize(syncNaturalSize);
  }, [syncNaturalSize]);

  useEffect(() => {
    setImageLoaded(false);
  }, [imageId, source]);

  useEffect(() => {
    if (naturalSize || !source || typeof source !== 'number') {
      return;
    }

    let cancelled = false;
    const resolved = Image.resolveAssetSource(source);
    Image.getSize(
      resolved.uri,
      (imageWidth, imageHeight) => {
        if (!cancelled && imageWidth > 0 && imageHeight > 0) {
          setNaturalSize({width: imageWidth, height: imageHeight});
        }
      },
      () => {
        // Avoid square fallback — it misaligns text coordinates with the visible image.
      },
    );

    return () => {
      cancelled = true;
    };
  }, [naturalSize, source]);

  const layout = useMemo(() => {
    if (!naturalSize) {
      return null;
    }
    const nextLayout = getCatalogImageLayout(width, height, naturalSize.width, naturalSize.height);
    return isCatalogImageLayoutReady(nextLayout) ? nextLayout : null;
  }, [height, naturalSize, width]);

  useEffect(() => {
    if (layout && imageLoaded) {
      onCaptureReady?.();
    }
  }, [imageLoaded, layout, onCaptureReady]);

  if (!source) {
    return null;
  }

  if (!layout) {
    return (
      <View style={[styles.root, {width, height, borderRadius}]}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={[styles.root, CATALOG_IMAGE_COORDINATE_LAYER_STYLE, {width, height, borderRadius}]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: layout.offsetX,
          top: layout.offsetY,
          width: layout.displayWidth,
          height: layout.displayHeight,
        }}
      >
        <Image
          key={imageId}
          source={source}
          style={{width: layout.displayWidth, height: layout.displayHeight}}
          resizeMode="contain"
          fadeDuration={0}
          onLoadEnd={() => setImageLoaded(true)}
        />
        <View style={StyleSheet.absoluteFill}>
          <CatalogImageTextOverlay
            layers={annotation.textLayers}
            layout={layout}
            fontFamily={fontFamily}
            language={language}
          />
        </View>
      </View>
    </View>
  );
};

const CatalogImageWithTextOverlay: React.FC<Props> = (props) => {
  if (!props.annotation || isEmptyCatalogImageTextAnnotation(props.annotation)) {
    return <CatalogImageThumb {...props} />;
  }

  return <CatalogImageWithTextOverlayAnnotated {...props} annotation={props.annotation} />;
};

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CatalogImageWithTextOverlay;
