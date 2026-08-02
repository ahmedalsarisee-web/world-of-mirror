import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Image} from 'expo-image';
import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {useMirrorCatalogStore} from '@app/stores/mirrorCatalogStore';
import {getMirrorCatalogBundledExpoSource} from '@app/utils/mirrorCatalogExpoImage';

interface Props {
  imageId: MirrorCatalogImageId;
  width: number;
  height: number;
  borderRadius?: number;
  onCaptureReady?: () => void;
  priority?: 'low' | 'normal' | 'high';
}

const CatalogImageThumb = React.memo(
  function CatalogImageThumb({
    imageId,
    width,
    height,
    borderRadius = 0,
    onCaptureReady,
    priority = 'normal',
  }: Props) {
    // Re-render when this catalog item hydrates / updates (URL may appear later).
    const catalogItem = useMirrorCatalogStore((state) => state.itemsById[imageId]);
    const source = useMemo(
      () => getMirrorCatalogBundledExpoSource(imageId, 'thumb'),
      [catalogItem, imageId],
    );

    if (!source) {
      return <View style={[styles.fallback, {width, height, borderRadius}]} />;
    }

    return (
      <View collapsable={false} style={[styles.root, {width, height, borderRadius}]}>
        <Image
          key={`catalog-thumb-${imageId}`}
          recyclingKey={imageId}
          source={source}
          style={{width, height}}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
          priority={priority}
          onLoadEnd={onCaptureReady}
        />
      </View>
    );
  },
  (previous, next) =>
    previous.imageId === next.imageId &&
    previous.width === next.width &&
    previous.height === next.height &&
    previous.borderRadius === next.borderRadius &&
    previous.priority === next.priority &&
    previous.onCaptureReady === next.onCaptureReady,
);

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    backgroundColor: '#000000',
  },
});

export default CatalogImageThumb;
