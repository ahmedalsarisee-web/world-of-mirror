import React, {useCallback, useMemo, useState} from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AppButton from '@app/components/common/AppButton';
import CatalogImageSkiaCanvas from '@app/components/common/catalogImageSkia/CatalogImageSkiaCanvas';
import CatalogImageTextEditorModal from '@app/components/common/catalogImageSkia/CatalogImageTextEditorModal';
import {useTheme} from '@app/context/ThemeContext';
import {useDirection} from '@app/hooks/useDirection';
import {normalizeMirrorCatalogImageIds, type MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {
  catalogImageToPickedImage,
  countCatalogImageTextAnnotations,
  type CatalogMirrorImageAnnotationData,
} from '@app/utils/catalogImageTextAnnotations';
import type {CatalogImageTextAnnotation} from '@app/utils/catalogImageTextEditor';
import type {PickedImage} from '@app/utils/imagePicker';

interface Props {
  imageIds?: string[];
  annotationData?: CatalogMirrorImageAnnotationData;
  compact?: boolean;
  annotatable?: boolean;
  annotating?: boolean;
  onAnnotationDataChange?: (data: CatalogMirrorImageAnnotationData) => void | Promise<void>;
}

interface CatalogThumbProps {
  imageId: MirrorCatalogImageId;
  annotation?: CatalogImageTextAnnotation;
  size: number;
  radius: number;
  borderColor: string;
  onPress: (imageId: MirrorCatalogImageId) => void;
}

const CatalogThumb = React.memo(function CatalogThumb({
  imageId,
  annotation,
  size,
  radius,
  borderColor,
  onPress,
}: CatalogThumbProps) {
  return (
    <Pressable
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor,
      }}
      onPress={() => onPress(imageId)}
      accessibilityRole="button"
      accessibilityLabel={imageId}
    >
      <CatalogImageSkiaCanvas
        imageId={imageId}
        annotation={annotation}
        width={size}
        height={size}
        borderRadius={radius}
      />
      {annotation?.textLayers.length ? (
        <View style={thumbStyles.annotatedBadge}>
          <MaterialCommunityIcons name="format-text" size={10} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
});

const thumbStyles = StyleSheet.create({
  annotatedBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
});

const ConfirmedOrderCatalogImages: React.FC<Props> = ({
  imageIds,
  annotationData,
  compact = false,
  annotatable = false,
  annotating = false,
  onAnnotationDataChange,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {inlineTextStyle} = useDirection();
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImageId, setEditorImageId] = useState<MirrorCatalogImageId | null>(null);
  const [editorImage, setEditorImage] = useState<PickedImage | null>(null);

  const catalogImageIds = useMemo(() => normalizeMirrorCatalogImageIds(imageIds), [imageIds]);
  const canAnnotate = annotatable && Boolean(onAnnotationDataChange);
  const columns = 4;
  const thumbSize = compact ? 56 : 72;
  const gridGap = theme.spacing.xs;
  const gridMaxHeight = Math.ceil(Math.min(catalogImageIds.length, 12) / columns) * (thumbSize + gridGap);
  const previewSize = width - theme.spacing.md * 2;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {gap: theme.spacing.xs},
        sectionTitle: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          opacity: 0.7,
        },
        compactRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
        compactText: {fontSize: theme.typographyScale.size.xs},
        grid: {maxHeight: gridMaxHeight},
        gridContent: {gap: gridGap},
        gridRow: {flexDirection: 'row', gap: gridGap},
        gridSpacer: {width: thumbSize, height: 0},
        previewBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.92)',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.md,
          paddingTop: insets.top + theme.spacing.sm,
          paddingBottom: insets.bottom + theme.spacing.sm,
        },
        previewHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.sm,
        },
        previewTitle: {color: '#FFFFFF', fontSize: theme.typographyScale.size.sm, fontWeight: '600', flex: 1},
        previewImageWrap: {width: previewSize, height: previewSize, alignSelf: 'center'},
        previewActions: {marginTop: theme.spacing.md, gap: theme.spacing.sm},
      }),
    [gridGap, gridMaxHeight, insets.bottom, insets.top, previewSize, theme, thumbSize],
  );

  const gridRows = useMemo(() => {
    const rows: MirrorCatalogImageId[][] = [];
    for (let index = 0; index < catalogImageIds.length; index += columns) {
      rows.push(catalogImageIds.slice(index, index + columns));
    }
    return rows;
  }, [catalogImageIds, columns]);

  const openPreview = useCallback((imageId: MirrorCatalogImageId) => {
    setPreviewId(imageId);
  }, []);

  const startAnnotate = useCallback(async (imageId: MirrorCatalogImageId) => {
    const picked = await catalogImageToPickedImage(imageId);
    if (!picked) {
      return;
    }
    setEditorImageId(imageId);
    setEditorImage(picked);
    setEditorOpen(true);
  }, []);

  const handleAnnotateComplete = useCallback(
    async (annotation: CatalogImageTextAnnotation) => {
      if (!editorImageId || !onAnnotationDataChange) {
        return;
      }
      const nextData: CatalogMirrorImageAnnotationData = {
        ...(annotationData ?? {}),
        [editorImageId]: annotation,
      };
      await onAnnotationDataChange(nextData);
      setEditorOpen(false);
      setEditorImage(null);
      setEditorImageId(null);
      setPreviewId(null);
    },
    [annotationData, editorImageId, onAnnotationDataChange],
  );

  const renderGridRow = useCallback(
    ({item: row}: {item: MirrorCatalogImageId[]}) => (
      <View style={styles.gridRow}>
        {row.map((imageId) => (
          <CatalogThumb
            key={imageId}
            imageId={imageId}
            annotation={annotationData?.[imageId]}
            size={thumbSize}
            radius={theme.components.input.radius}
            borderColor={theme.colors.divider}
            onPress={openPreview}
          />
        ))}
        {row.length < columns
          ? Array.from({length: columns - row.length}, (_, index) => (
              <View key={`spacer-${index}`} style={styles.gridSpacer} />
            ))
          : null}
      </View>
    ),
    [
      annotationData,
      openPreview,
      styles.gridRow,
      styles.gridSpacer,
      theme.colors.divider,
      theme.components.input.radius,
      thumbSize,
    ],
  );

  if (catalogImageIds.length === 0) {
    return null;
  }

  if (compact) {
    const annotatedCount = countCatalogImageTextAnnotations(catalogImageIds, annotationData);
    return (
      <View style={styles.compactRow}>
        <MaterialCommunityIcons name="image-multiple-outline" size={14} color={theme.colors.primary} />
        <Text style={[styles.compactText, inlineTextStyle, {color: theme.colors.primary}]}>
          {annotatedCount > 0
            ? t('mirrorCatalogImagesCountAnnotated', {count: catalogImageIds.length, annotated: annotatedCount})
            : t('mirrorCatalogImagesCount', {count: catalogImageIds.length})}
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, inlineTextStyle, {color: theme.typography.secondary}]}>
          {t('mirrorCatalogImagesSection')}
        </Text>
        <FlatList
          data={gridRows}
          keyExtractor={(row, index) => `${row.join('-')}-${index}`}
          renderItem={renderGridRow}
          style={styles.grid}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={catalogImageIds.length > columns * 2}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={3}
          maxToRenderPerBatch={4}
          windowSize={5}
        />
      </View>

      <Modal visible={previewId !== null} transparent animationType="fade" onRequestClose={() => setPreviewId(null)}>
        <View style={styles.previewBackdrop}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {previewId}
            </Text>
            <Pressable onPress={() => setPreviewId(null)} hitSlop={12} accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
          {previewId ? (
            <View style={styles.previewImageWrap}>
              <CatalogImageSkiaCanvas
                imageId={previewId as MirrorCatalogImageId}
                annotation={annotationData?.[previewId]}
                width={previewSize}
                height={previewSize}
              />
            </View>
          ) : null}
          {canAnnotate && previewId ? (
            <View style={styles.previewActions}>
              <AppButton
                label={t('addTextToImage')}
                onPress={() => void startAnnotate(previewId as MirrorCatalogImageId)}
                loading={annotating}
                disabled={annotating}
              />
            </View>
          ) : null}
        </View>
      </Modal>

      {editorImageId ? (
        <CatalogImageTextEditorModal
          visible={editorOpen}
          imageId={editorImageId}
          image={editorImage}
          initialAnnotation={annotationData?.[editorImageId]}
          onClose={() => {
            setEditorOpen(false);
            setEditorImage(null);
            setEditorImageId(null);
          }}
          onComplete={(annotation) => {
            void handleAnnotateComplete(annotation);
          }}
        />
      ) : null}
    </>
  );
};

export default ConfirmedOrderCatalogImages;
