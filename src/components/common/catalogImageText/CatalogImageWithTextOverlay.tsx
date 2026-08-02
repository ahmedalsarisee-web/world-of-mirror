import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {Image} from 'expo-image';
import {useLanguage} from '@app/context/LangContext';
import {useDirection} from '@app/hooks/useDirection';
import CatalogImageThumb from '@app/components/common/CatalogImageThumb';
import CatalogImageTextOverlay from '@app/components/common/catalogImageText/CatalogImageTextOverlay';
import {useMirrorCatalogExpoImage} from '@app/hooks/useMirrorCatalogExpoImage';
import {
  getMirrorCatalogImageNaturalSize,
  type MirrorCatalogImageId,
} from '@app/data/mirrorCatalogImages';
import {useMirrorCatalogStore} from '@app/stores/mirrorCatalogStore';
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
  const {source, loading} = useMirrorCatalogExpoImage(imageId, 'display');
  const catalogItem = useMirrorCatalogStore((state) => state.itemsById[imageId]);
  const naturalSize = useMemo(
    () => getMirrorCatalogImageNaturalSize(imageId),
    [catalogItem, imageId],
  );
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [imageId, annotation, source]);

  const layout = useMemo(() => {
    if (!naturalSize) {
      return null;
    }
    const nextLayout = getCatalogImageLayout(width, height, naturalSize.width, naturalSize.height);
    return isCatalogImageLayoutReady(nextLayout) ? nextLayout : null;
  }, [height, naturalSize, width]);

  useEffect(() => {
    if (imageLoaded) {
      onCaptureReady?.();
    }
  }, [imageLoaded, onCaptureReady]);

  if (!layout) {
    return (
      <CatalogImageThumb
        imageId={imageId}
        width={width}
        height={height}
        borderRadius={borderRadius}
        onCaptureReady={onCaptureReady}
      />
    );
  }

  return (
    <View
      collapsable={false}
      style={[styles.root, CATALOG_IMAGE_COORDINATE_LAYER_STYLE, {width, height, borderRadius}]}
    >
      <View
        pointerEvents="none"
        collapsable={false}
        style={{
          position: 'absolute',
          left: layout.offsetX,
          top: layout.offsetY,
          width: layout.displayWidth,
          height: layout.displayHeight,
        }}
      >
        {loading || !source ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Image
            key={`catalog-overlay-${imageId}`}
            recyclingKey={imageId}
            source={source}
            style={{width: layout.displayWidth, height: layout.displayHeight}}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
            onLoadEnd={() => setImageLoaded(true)}
          />
        )}
        <View style={StyleSheet.absoluteFill} collapsable={false}>
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
