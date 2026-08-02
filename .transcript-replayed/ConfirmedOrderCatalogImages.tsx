import React, {useCallback, useMemo, useState} from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import PagerView from 'react-native-pager-view';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Image} from 'expo-image';
import CatalogImageThumb from '@app/components/common/catalogImageText/CatalogImageThumb';
import CatalogImageWithTextOverlay from '@app/components/common/catalogImageText/CatalogImageWithTextOverlay';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ActivityIndicator} from 'react-native';
import CatalogImageWithTextOverlay from '@app/components/common/catalogImageText/CatalogImageWithTextOverlay';
import CatalogImageTextEditorModal from '@app/components/common/catalogImageText/CatalogImageTextEditorModal';
import {useTheme} from '@app/context/ThemeContext';
import {useLanguage} from '@app/context/LangContext';
import {useDirection} from '@app/hooks/useDirection';
import {normalizeMirrorCatalogImageIds, type MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {
  catalogImageToPickedImage,
  countCatalogImageTextAnnotations,
  type CatalogMirrorImageAnnotationData,
} from '@app/utils/catalogImageTextAnnotations';
import {
  isEmptyCatalogImageTextAnnotation,
  type CatalogImageTextAnnotation,
} from '@app/utils/catalogImageTextEditor';
import type {PickedImage} from '@app/utils/imagePicker';

interface Props {
  imageIds?: string[];
  annotationData?: CatalogMirrorImageAnnotationData;
  compact?: boolean;
  annotatable?: boolean;
  annotating?: boolean;
  onAnnotationDataChange?: (data: CatalogMirrorImageAnnotationData) => void | Promise<void>;
}

const COMPACT_VISIBLE_THUMBS = 6;
const EXPANDED_VISIBLE_THUMBS = 4;
const PHOTO_GRID_COLUMNS = 3;

interface StudioThumbProps {
  imageUrl: string;
  size: number;
  radius: number;
  borderColor: string;
  onPress: () => void;
}

const StudioThumb = React.memo(function StudioThumb({
  imageUrl,
  size,
  radius,
  borderColor,
  onPress,
  moreCount,
}: StudioThumbProps) {
  const {theme} = useTheme();

  return (
    <Pressable
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor,
        backgroundColor: '#000000',
      }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={imageUrl}
    >
      <Image source={{uri: imageUrl}} style={{width: size, height: size}} contentFit="contain" />
      {moreCount && moreCount > 0 ? (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
        >
          <Text style={{color: '#FFFFFF', fontSize: theme.typographyScale.size.sm, fontWeight: '800'}}>
            +{moreCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

interface CatalogThumbProps {
  imageId: MirrorCatalogImageId;
  annotation?: CatalogImageTextAnnotation;
  size: number;
  radius: number;
  borderColor: string;
  onPress: (imageId: MirrorCatalogImageId) => void;
  moreCount?: number;
}

const CatalogThumb = React.memo(function CatalogThumb({
  imageId,
  annotation,
  size,
  radius,
  borderColor,
  onPress,
  moreCount,
}: CatalogThumbProps) {
  const showAnnotation = Boolean(annotation && !isEmptyCatalogImageTextAnnotation(annotation));
  const {theme} = useTheme();
  const {t} = useTranslation();

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
      accessibilityLabel={
        moreCount && moreCount > 0
          ? t('mirrorCatalogImagesViewAllA11y', {count: moreCount + EXPANDED_VISIBLE_THUMBS})
          : imageId
      }
    >
      {showAnnotation ? (
        <CatalogImageWithTextOverlay
          imageId={imageId}
          annotation={annotation}
          width={size}
          height={size}
          borderRadius={radius}
        />
      ) : (
        <CatalogImageThumb imageId={imageId} width={size} height={size} borderRadius={radius} priority="low" />
      )}
      {moreCount && moreCount > 0 ? (
        <>
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
          >
            <View
              style={{
                minWidth: size * 0.46,
                minHeight: size * 0.46,
                borderRadius: size * 0.23,
                borderWidth: 2,
                borderColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 8,
                paddingVertical: 4,
                gap: 2,
              }}
            >
              <MaterialCommunityIcons name="plus" size={Math.max(18, size * 0.18)} color="#FFFFFF" />
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: Math.max(theme.typographyScale.size.sm, size * 0.14),
                  fontWeight: '800',
                  lineHeight: Math.max(theme.typographyScale.size.sm, size * 0.14) + 2,
                }}
              >
                {moreCount}
              </Text>
            </View>
          </View>
          <View
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 22,
              height: 22,
              borderRadius: 11,
              paddingHorizontal: 5,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primary,
              borderWidth: 1.5,
              borderColor: '#FFFFFF',
            }}
          >
            <Text style={{color: '#FFFFFF', fontSize: 11, fontWeight: '800', lineHeight: 13}}>
              {t('mirrorCatalogImagesMoreCount', {count: moreCount})}
            </Text>
          </View>
        </>
      ) : null}
    </Pressable>
  );
});

const ConfirmedOrderCatalogImages: React.FC<Props> = ({
  imageIds,
  studioImageUrls,
  annotationData,
  compact = false,
  annotatable = false,
  annotating = false,
  onAnnotationDataChange,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {language} = useLanguage();
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
        viewPhotosButton: {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        sectionTitle: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          opacity: 0.7,
        },
        compactRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
        compactText: {fontSize: theme.typographyScale.size.xs},
        compactThumbRow: {flexDirection: 'row', gap: gridGap, paddingVertical: 2},
        compactMoreThumb: {
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
        },
        compactMoreText: {fontSize: theme.typographyScale.size.sm, fontWeight: '700'},
        horizontalThumbRow: {flexDirection: 'row', gap: gridGap, paddingVertical: 2},
        moreImagesHint: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
          opacity: 0.85,
        },
        photoGridBackdrop: {
          flex: 1,
          backgroundColor: theme.colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
        photoGridHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: photoGridPadding,
          paddingVertical: theme.spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.divider,
        },
        photoGridTitle: {
          fontSize: theme.typographyScale.size.md,
          fontWeight: '700',
          flex: 1,
        },
        photoGridList: {
          padding: photoGridPadding,
        },
        photoGridRow: {
          gap: gridGap,
          marginBottom: gridGap,
        },
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
    [gridGap, insets.bottom, insets.top, photoGridPadding, previewSize, theme],
  );

  const handleThumbRowLayout = useCallback((event: {nativeEvent: {layout: {width: number}}}) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setThumbRowWidth((current) => (current === nextWidth ? current : nextWidth));
  }, []);

  const openPreview = useCallback((imageId: MirrorCatalogImageId) => {
    setPreviewId(imageId);
  }, []);

  const startAnnotate = useCallback(async (imageId: MirrorCatalogImageId) => {
    const picked = await catalogImageToPickedImage(imageId);
    if (!picked) {
      return;
    }
    setPreviewId(null);
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
      invalidateCatalogImageMarkerCache(editorImageId);
      setEditorOpen(false);
      setEditorImage(null);
      setEditorImageId(null);
      setPreviewIndex(null);
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
    const compactThumbSize = 72;

    return (
      <View style={styles.section}>
        <View style={styles.compactRow}>
          <MaterialCommunityIcons name="image-multiple-outline" size={14} color={theme.colors.primary} />
          <Text style={[styles.compactText, inlineTextStyle, {color: theme.colors.primary}]}>
            {annotatedCount > 0
              ? t('mirrorCatalogImagesCountAnnotated', {count: catalogImageIds.length, annotated: annotatedCount})
              : t('mirrorCatalogImagesCount', {count: catalogImageIds.length})}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.compactThumbRow}
        >
          {catalogImageIds.map((imageId) => (
            <CatalogThumb
              key={imageId}
              imageId={imageId}
              annotation={annotationData?.[imageId]}
              size={compactThumbSize}
              radius={theme.components.input.radius}
              borderColor={theme.colors.divider}
              onPress={openPreview}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, inlineTextStyle, {color: theme.typography.secondary}]}>
          {t('mirrorCatalogViewPhotos')}
        </Text>
        <FlatList
          data={gridRows}
          keyExtractor={(row, index) => `${row.join('-')}-${index}`}
          renderItem={renderGridRow}
          style={styles.grid}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={catalogImageIds.length > columns * 2}
          removeClippedSubviews={false}
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
