import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import PagerView from 'react-native-pager-view';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {useMirrorCatalogExpoImage} from '@app/hooks/useMirrorCatalogExpoImage';
import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {useDirection} from '@app/hooks/useDirection';
import {getPositionEnd, getPositionStart} from '@shared/utils/directionalStyles';

interface Props {
  visible: boolean;
  imageIds: readonly MirrorCatalogImageId[];
  initialIndex?: number;
  onClose: () => void;
  onDelete?: (imageId: MirrorCatalogImageId) => void;
  deleting?: boolean;
}
interface PreviewPageProps {
  imageId: MirrorCatalogImageId;
  previewSize: number;
}

const CatalogPreviewPage: React.FC<PreviewPageProps> = ({imageId, previewSize}) => {
  const {source, loading} = useMirrorCatalogExpoImage(imageId, 'display');

  return (
    <View style={styles.page}>
      {loading || !source ? (
        <ActivityIndicator color="#FFFFFF" size="large" />
      ) : (
        <Image
          key={`catalog-preview-${imageId}`}
          recyclingKey={imageId}
          source={source}
          style={{width: previewSize, height: previewSize}}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
        />
      )}
    </View>
  );
};

const CatalogImagePreviewModal: React.FC<Props> = ({
  visible,
  imageIds,
  initialIndex = 0,
  onClose,
  onDelete,
  deleting = false,
}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {width, height} = useWindowDimensions();
  const {direction} = useDirection();
  const [index, setIndex] = useState(initialIndex);
  const previewSize = width - 24;
  const currentImageId = imageIds[index] ?? imageIds[initialIndex] ?? imageIds[0];

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  useEffect(() => {
    if (index >= imageIds.length && imageIds.length > 0) {
      setIndex(Math.max(0, imageIds.length - 1));
    }
  }, [imageIds.length, index]);

  const closePosition = useMemo(() => getPositionEnd(direction, 16), [direction]);
  const deletePosition = useMemo(() => getPositionStart(direction, 16), [direction]);
  if (!imageIds.length) {
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
          accessibilityLabel={t('cancel')}
        >
          <View style={styles.closeBtnBg}>
            <MaterialCommunityIcons name="close" size={22} color="#fff" />
          </View>
        </Pressable>

        {onDelete && currentImageId ? (
          <Pressable
            style={[styles.closeBtn, deletePosition, {top: insets.top + 8}]}
            onPress={() => onDelete(currentImageId)}
            disabled={deleting}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('mirrorWarehouseDeleteImage')}
          >
            <View style={[styles.closeBtnBg, styles.deleteBtnBg]}>
              {deleting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <MaterialCommunityIcons name="close" size={22} color="#fff" />
              )}
            </View>
          </Pressable>
        ) : null}
        {imageIds.length > 1 ? (
          <View style={[styles.counterWrap, {top: insets.top + 12}]}>
            <Text style={styles.counter}>
              {index + 1} / {imageIds.length}
            </Text>
          </View>
        ) : null}

        <PagerView
          key={`${visible}-${initialIndex}`}
          style={[styles.pager, {width, height: height * 0.78}]}
          initialPage={initialIndex}
          onPageSelected={(event) => setIndex(event.nativeEvent.position)}
        >
          {imageIds.map((imageId, pageIndex) => (
            <View key={`${imageId}-${pageIndex}`} collapsable={false}>
              <CatalogPreviewPage imageId={imageId} previewSize={previewSize} />
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
  deleteBtnBg: {
    backgroundColor: 'rgba(220, 38, 38, 0.88)',
  },  counterWrap: {
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
});

export default CatalogImagePreviewModal;
