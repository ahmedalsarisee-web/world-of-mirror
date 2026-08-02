import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {Image} from 'expo-image';
import {useLanguage} from '@app/context/LangContext';
import {useDirection} from '@app/hooks/useDirection';
import CatalogImageThumb from '@app/components/common/catalogImageText/CatalogImageThumb';
import CatalogImageTextOverlay from '@app/components/common/catalogImageText/CatalogImageTextOverlay';
import {
  getMirrorCatalogImageNaturalSize,
  type MirrorCatalogImageId,
} from '@app/data/mirrorCatalogImages';
import {getMirrorCatalogDisplaySource} from '@app/data/mirrorCatalogImageAssets';
import {
  CATALOG_IMAGE_COORDINATE_LAYER_STYLE,
  getCatalogImageLayout,
  isCatalogImageLayoutReady,
  isEmptyCatalogImageTextAnnotation,
  type CatalogImageTextAnnotation,
} from '@app/utils/catalogImageTextEditor';
import {
  isImageMarkerAvailable,
  markCatalogImageWithText,
} from '@app/utils/catalogImageMarker';

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
  const source = getMirrorCatalogDisplaySource(imageId);
  const naturalSize = useMemo(() => getMirrorCatalogImageNaturalSize(imageId), [imageId]);
  const [markedUri, setMarkedUri] = useState<string | null>(null);
  const [markerFailed, setMarkerFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const useMarker = isImageMarkerAvailable() && !markerFailed;

  useEffect(() => {
    setMarkedUri(null);
    setMarkerFailed(false);
    setImageLoaded(false);
  }, [imageId, annotation, source]);

  useEffect(() => {
    if (!useMarker) {
      return;
    }

    let cancelled = false;
    void markCatalogImageWithText({
      imageId,
      annotation,
      language,
    })
      .then((uri) => {
        if (!cancelled) {
          setMarkedUri(uri);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMarkerFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [annotation, imageId, language, useMarker]);

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

  if (!source) {
    return null;
  }

  if (useMarker) {
    if (!markedUri) {
      return (
        <View style={[styles.root, {width, height, borderRadius}]}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      );
    }

    return (
      <View style={[styles.root, {width, height, borderRadius, overflow: 'hidden'}]}>
        <Image
          recyclingKey={`${imageId}-marked`}
          source={{uri: markedUri}}
          style={{width, height}}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
          onLoadEnd={() => setImageLoaded(true)}
        />
      </View>
    );
  }

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
          recyclingKey={imageId}
          source={source}
          style={{width: layout.displayWidth, height: layout.displayHeight}}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
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
