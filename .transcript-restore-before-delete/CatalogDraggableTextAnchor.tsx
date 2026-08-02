import React, {useEffect} from 'react';
import {StyleSheet, type ViewStyle} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {runOnJS, useAnimatedStyle, useSharedValue} from 'react-native-reanimated';
import {
  CATALOG_IMAGE_COORDINATE_LAYER_STYLE,
  type CatalogImageLayout,
  type CatalogImageTextAlign,
} from '@app/utils/catalogImageTextEditor';

const TEXT_TAP_SLOP = 8;

interface Props {
  nx: number;
  ny: number;
  layout: CatalogImageLayout;
  anchorAlign: CatalogImageTextAlign;
  style?: ViewStyle;
  onMove: (nx: number, ny: number) => void;
  onPress?: () => void;
  onDoublePress?: () => void;
  children: React.ReactNode;
}

const CatalogDraggableTextAnchor: React.FC<Props> = ({
  nx,
  ny,
  layout,
  anchorAlign,
  style,
  onMove,
  onPress,
  onDoublePress,
  children,
}) => {
  const anchorNx = useSharedValue(nx);
  const anchorNy = useSharedValue(ny);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startNx = useSharedValue(nx);
  const startNy = useSharedValue(ny);
  const moved = useSharedValue(false);

  useEffect(() => {
    anchorNx.value = nx;
    anchorNy.value = ny;
    dragX.value = 0;
    dragY.value = 0;
  }, [anchorNx, anchorNy, dragX, dragY, nx, ny]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startNx.value = anchorNx.value;
      startNy.value = anchorNy.value;
      moved.value = false;
      dragX.value = 0;
      dragY.value = 0;
    })
    .onUpdate((event) => {
      if (
        Math.abs(event.translationX) > TEXT_TAP_SLOP ||
        Math.abs(event.translationY) > TEXT_TAP_SLOP
      ) {
        moved.value = true;
      }
      dragX.value = event.translationX;
      dragY.value = event.translationY;
    })
    .onEnd((event) => {
      if (moved.value) {
        const nextNx = Math.min(
          1,
          Math.max(0, startNx.value + event.translationX / layout.displayWidth),
        );
        const nextNy = Math.min(
          1,
          Math.max(0, startNy.value + event.translationY / layout.displayHeight),
        );
        anchorNx.value = nextNx;
        anchorNy.value = nextNy;
        runOnJS(onMove)(nextNx, nextNy);
      } else if (onPress) {
        runOnJS(onPress)();
      }
      dragX.value = 0;
      dragY.value = 0;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd(() => {
      if (onDoublePress) {
        runOnJS(onDoublePress)();
      }
    });

  const gesture = onDoublePress ? Gesture.Exclusive(pan, doubleTap) : pan;

  const animatedStyle = useAnimatedStyle(() => {
    const transforms: {translateX: number | string}[] = [];
    if (anchorAlign === 'center') {
      transforms.push({translateX: '-50%'});
    } else if (anchorAlign === 'right') {
      transforms.push({translateX: '-100%'});
    }

    return {
      left: anchorNx.value * layout.displayWidth + dragX.value,
      top: anchorNy.value * layout.displayHeight + dragY.value,
      transform: transforms.length > 0 ? transforms : undefined,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        collapsable={false}
        style={[styles.anchor, CATALOG_IMAGE_COORDINATE_LAYER_STYLE, animatedStyle, style]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
  },
});

export default CatalogDraggableTextAnchor;
