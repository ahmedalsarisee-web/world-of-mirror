import React, {useEffect, useMemo, useState} from 'react';
import {Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import PagerView from 'react-native-pager-view';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDirection} from '@app/hooks/useDirection';
import {getPositionEnd} from '@shared/utils/directionalStyles';

interface Props {
  visible: boolean;
  uris: string[];
  initialIndex?: number;
  onClose: () => void;
}

const ImagePreviewModal: React.FC<Props> = ({visible, uris, initialIndex = 0, onClose}) => {
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const {direction} = useDirection();
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  const closePosition = useMemo(() => getPositionEnd(direction, 16), [direction]);

  if (!uris.length) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />

        <Pressable
          style={[styles.closeBtn, closePosition, {top: insets.top + 8}]}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
        >
          <View style={styles.closeBtnBg}>
            <MaterialCommunityIcons name="close" size={22} color="#fff" />
          </View>
        </Pressable>

        {uris.length > 1 ? (
          <View style={[styles.counterWrap, {top: insets.top + 12}]}>
            <Text style={styles.counter}>
              {index + 1} / {uris.length}
            </Text>
          </View>
        ) : null}

        <PagerView
          key={`${visible}-${initialIndex}`}
          style={[styles.pager, {width, height: height * 0.78}]}
          initialPage={initialIndex}
          onPageSelected={(event) => setIndex(event.nativeEvent.position)}
        >
          {uris.map((uri, i) => (
            <View key={`${uri}-${i}`} style={styles.page}>
              <Image source={{uri}} style={styles.image} resizeMode="contain" />
            </View>
          ))}
        </PagerView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    zIndex: 2,
  },
  closeBtnBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterWrap: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  counter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default ImagePreviewModal;
