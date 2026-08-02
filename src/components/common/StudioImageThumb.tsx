import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Image} from 'expo-image';

interface Props {
  imageUrl: string;
  width: number;
  height: number;
  borderRadius?: number;
  onCaptureReady?: () => void;
  priority?: 'low' | 'normal' | 'high';
}

const StudioImageThumb = React.memo(
  function StudioImageThumb({
    imageUrl,
    width,
    height,
    borderRadius = 0,
    onCaptureReady,
    priority = 'normal',
  }: Props) {
    const [reloadNonce, setReloadNonce] = useState(0);

    useEffect(() => {
      setReloadNonce(0);
    }, [imageUrl]);

    const trimmedUrl = imageUrl.trim();
    if (!trimmedUrl) {
      return <View style={[styles.fallback, {width, height, borderRadius}]} />;
    }

    const recyclingKey = reloadNonce > 0 ? `${trimmedUrl}::${reloadNonce}` : trimmedUrl;

    return (
      <View collapsable={false} style={[styles.root, {width, height, borderRadius}]}>
        <Image
          recyclingKey={recyclingKey}
          source={{uri: trimmedUrl}}
          style={{width, height}}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
          priority={priority}
          onLoadEnd={onCaptureReady}
          onError={() => {
            if (reloadNonce < 1) {
              setReloadNonce((current) => current + 1);
            }
          }}
        />
      </View>
    );
  },
  (previous, next) =>
    previous.imageUrl === next.imageUrl &&
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

export default StudioImageThumb;
