import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  InteractionManager,
  Modal,
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
import CatalogImageThumb from '@app/components/common/CatalogImageThumb';
import StudioImageThumb from '@app/components/common/StudioImageThumb';
import CatalogImageWithTextOverlay from '@app/components/common/catalogImageText/CatalogImageWithTextOverlay';
import StudioImageWithTextOverlay from '@app/components/common/catalogImageText/StudioImageWithTextOverlay';
import CatalogImageTextEditorModal from '@app/components/common/catalogImageText/CatalogImageTextEditorModal';
import MirrorCatalogPickerSheet from '@app/components/pricing/MirrorCatalogPickerSheet';
import {useTheme} from '@app/context/ThemeContext';
import {useLanguage} from '@app/context/LangContext';
import {useDirection} from '@app/hooks/useDirection';
import {normalizeMirrorCatalogImageIds, type MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {getMirrorCatalogDisplaySource} from '@app/data/mirrorCatalogImageAssets';
import {useMirrorCatalogStore} from '@app/stores/mirrorCatalogStore';
import {saveCatalogImageToGallery} from '@app/utils/exportCatalogImage';
import {saveMarkedCatalogImageToGallery, saveMarkedRemoteImageToGallery} from '@app/utils/exportCatalogImageWithText';
import {pushOrderOverlayBackHandler} from '@app/utils/orderOverlayBackHandler';
import {
  countOrderImageTextAnnotations,
  type CatalogMirrorImageAnnotationData,
} from '@app/utils/catalogImageTextAnnotations';
import {
  isEmptyCatalogImageTextAnnotation,
  type CatalogImageTextAnnotation,
} from '@app/utils/catalogImageTextEditor';
import type {PickedImage} from '@app/utils/imagePicker';
import {invalidateCatalogImageMarkerCache} from '@app/utils/catalogImageMarker';
import {invalidateMirrorCatalogMaterializedUri} from '@app/utils/mirrorCatalogExpoImage';
import {
  buildOrderAttachedImages,
  getOrderAttachedImageKey,
  type OrderAttachedImage,
} from '@app/utils/orderAttachedImages';

interface Props {
  imageIds?: string[];
  studioImageUrls?: string[];
  annotationData?: CatalogMirrorImageAnnotationData;
  compact?: boolean;
  annotatable?: boolean;
  annotating?: boolean;
  replaceable?: boolean;
  replacing?: boolean;
  removable?: boolean;
  removing?: boolean;
  onAnnotationDataChange?: (data: CatalogMirrorImageAnnotationData) => void | Promise<void>;
  onReplaceImage?: (
    oldImageId: MirrorCatalogImageId,
    newImageId: MirrorCatalogImageId,
  ) => void | Promise<void>;
  onReplaceImageWithStudio?: (oldImageId: MirrorCatalogImageId) => void | Promise<void>;
  onRemoveImage?: (imageId: MirrorCatalogImageId) => void | Promise<void>;
  onRemoveStudioImage?: (imageUrl: string) => void | Promise<void>;
  onReplaceStudioImage?: (imageUrl: string) => void | Promise<void>;
  onReplaceStudioImageWithCatalog?: (
    oldUrl: string,
    newImageId: MirrorCatalogImageId,
  ) => void | Promise<void>;
}

const COMPACT_VISIBLE_THUMBS = 6;
const EXPANDED_VISIBLE_THUMBS = 4;
const PHOTO_GRID_COLUMNS = 3;

interface StudioThumbProps {
  imageUrl: string;
  annotation?: CatalogImageTextAnnotation;
  size: number;
  radius: number;
  borderColor: string;
  onPress: () => void;
  moreCount?: number;
}

const StudioThumb = React.memo(function StudioThumb({
  imageUrl,
  annotation,
  size,
  radius,
  borderColor,
  onPress,
  moreCount,
}: StudioThumbProps) {
  const {theme} = useTheme();
  const showAnnotation = Boolean(annotation && !isEmptyCatalogImageTextAnnotation(annotation));

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
      {showAnnotation ? (
        <StudioImageWithTextOverlay
          imageUri={imageUrl}
          imageKey={imageUrl}
          annotation={annotation}
          width={size}
          height={size}
          borderRadius={radius}
        />
      ) : (
        <StudioImageThumb
          imageUrl={imageUrl}
          width={size}
          height={size}
          borderRadius={radius}
          priority="low"
        />
      )}
      {moreCount && moreCount > 0 ? (
        <View
          style={{
            ...StyleSheet.absoluteFill,
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
  const {theme} = useTheme();
  const {t} = useTranslation();
  const showAnnotation = Boolean(annotation && !isEmptyCatalogImageTextAnnotation(annotation));

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
              ...StyleSheet.absoluteFill,
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
  replaceable = false,
  replacing = false,
  removable = false,
  removing = false,
  onAnnotationDataChange,
  onReplaceImage,
  onReplaceImageWithStudio,
  onRemoveImage,
  onRemoveStudioImage,
  onReplaceStudioImage,
  onReplaceStudioImageWithCatalog,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {language} = useLanguage();
  const {inlineTextStyle} = useDirection();
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewSessionKey, setPreviewSessionKey] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [editorImage, setEditorImage] = useState<PickedImage | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<MirrorCatalogImageId | null>(null);
  const [replaceStudioTargetUrl, setReplaceStudioTargetUrl] = useState<string | null>(null);
  const [replacePickerOpen, setReplacePickerOpen] = useState(false);
  const [optimisticImageIds, setOptimisticImageIds] = useState<MirrorCatalogImageId[] | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [photoGridOpen, setPhotoGridOpen] = useState(false);
  const [thumbRowWidth, setThumbRowWidth] = useState(0);
  const previewCaptureRef = useRef<View>(null);
  const replaceTargetRef = useRef<MirrorCatalogImageId | null>(null);
  const replaceStudioTargetRef = useRef<string | null>(null);

  const catalogHydrated = useMirrorCatalogStore((state) => state.isHydrated);
  const catalogItemCount = useMirrorCatalogStore((state) => state.items.length);

  const catalogImageIds = useMemo(() => {
    if (optimisticImageIds) {
      return optimisticImageIds;
    }
    return normalizeMirrorCatalogImageIds(imageIds);
  }, [catalogHydrated, catalogItemCount, imageIds, optimisticImageIds]);

  const attachedImages = useMemo(
    () => buildOrderAttachedImages(catalogImageIds, studioImageUrls),
    [catalogImageIds, studioImageUrls],
  );

  useEffect(() => {
    setOptimisticImageIds(null);
  }, [imageIds, studioImageUrls]);
  const previewItem =
    previewIndex !== null && previewIndex >= 0 && previewIndex < attachedImages.length
      ? attachedImages[previewIndex]
      : null;
  const previewOpen = previewIndex !== null;
  const canAnnotate = annotatable && Boolean(onAnnotationDataChange);
  const canReplace = replaceable && Boolean(onReplaceImage);
  const canReplaceWithStudio = replaceable && Boolean(onReplaceImageWithStudio);
  const canReplaceStudio = replaceable && Boolean(onReplaceStudioImage);
  const canReplaceStudioWithCatalog =
    replaceable && Boolean(onReplaceStudioImageWithCatalog ?? onReplaceStudioImage);
  const canRemove = removable && Boolean(onRemoveImage);
  const canRemoveStudio = removable && Boolean(onRemoveStudioImage);
  const previewBusy = annotating || replacing || removing || downloading;
  const gridGap = theme.spacing.xs;
  const expandedThumbSize = useMemo(() => {
    const rowWidth = thumbRowWidth > 0 ? thumbRowWidth : width - theme.spacing.md * 2;
    const size = Math.floor((rowWidth - gridGap * (EXPANDED_VISIBLE_THUMBS - 1)) / EXPANDED_VISIBLE_THUMBS);
    return Math.max(56, size);
  }, [gridGap, thumbRowWidth, theme.spacing.md, width]);
  const compactThumbSize = 72;
  const previewSize = width - theme.spacing.md * 2;
  const photoGridPadding = theme.spacing.md;
  const photoGridItemSize = useMemo(() => {
    const size = Math.floor(
      (width - photoGridPadding * 2 - gridGap * (PHOTO_GRID_COLUMNS - 1)) / PHOTO_GRID_COLUMNS,
    );
    return Math.max(88, size);
  }, [gridGap, photoGridPadding, width]);

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
        previewBody: {flex: 1, justifyContent: 'center', alignItems: 'center'},
        previewPager: {flex: 1, width: previewSize},
        previewPage: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        previewImageWrap: {width: previewSize, height: previewSize, position: 'relative'},
        previewDeleteBtn: {
          position: 'absolute',
          top: 8,
          right: 8,
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.65)',
          zIndex: 2,
        },
        previewBottomActions: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
        },
        previewIconAction: {
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          minWidth: 52,
          paddingVertical: 4,
          opacity: 1,
        },
        previewIconActionDisabled: {opacity: 0.45},
        previewIconLabel: {
          color: '#FFFFFF',
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '600',
        },
      }),
    [gridGap, insets.bottom, insets.top, photoGridPadding, previewSize, theme],
  );

  const handleThumbRowLayout = useCallback((event: {nativeEvent: {layout: {width: number}}}) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setThumbRowWidth((current) => (current === nextWidth ? current : nextWidth));
  }, []);

  const openPreview = useCallback((item: OrderAttachedImage) => {
    const index = attachedImages.findIndex(
      (entry) => getOrderAttachedImageKey(entry) === getOrderAttachedImageKey(item),
    );
    if (index < 0) {
      return;
    }
    setPreviewIndex(index);
    setPreviewSessionKey((value) => value + 1);
  }, [attachedImages]);

  const openPhotoGrid = useCallback(() => {
    setPhotoGridOpen(true);
  }, []);

  const closePhotoGrid = useCallback(() => {
    setPhotoGridOpen(false);
  }, []);

  const openPreviewFromGrid = useCallback(
    (item: OrderAttachedImage) => {
      setPhotoGridOpen(false);
      openPreview(item);
    },
    [openPreview],
  );

  const closePreview = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  const closeReplacePicker = useCallback(() => {
    setReplacePickerOpen(false);
    setReplaceTargetId(null);
    setReplaceStudioTargetUrl(null);
    replaceTargetRef.current = null;
    replaceStudioTargetRef.current = null;
  }, []);

  const handleReplaceWithStudio = useCallback(() => {
    const targetId = replaceTargetRef.current;
    if (!targetId || !onReplaceImageWithStudio) {
      return;
    }

    closeReplacePicker();
    InteractionManager.runAfterInteractions(() => {
      void onReplaceImageWithStudio(targetId);
    });
  }, [closeReplacePicker, onReplaceImageWithStudio]);

  const handleStudioReplaceWithGallery = useCallback(() => {
    const targetUrl = replaceStudioTargetRef.current;
    if (!targetUrl || !onReplaceStudioImage) {
      return;
    }

    closeReplacePicker();
    InteractionManager.runAfterInteractions(() => {
      void onReplaceStudioImage(targetUrl);
    });
  }, [closeReplacePicker, onReplaceStudioImage]);

  const returnToOrderCardView = useCallback(() => {
    setEditorOpen(false);
    setEditorImage(null);
    setEditorKey(null);
    setPreviewIndex(null);
    setPhotoGridOpen(false);
    setReplacePickerOpen(false);
    setReplaceTargetId(null);
    setReplaceStudioTargetUrl(null);
    replaceTargetRef.current = null;
    replaceStudioTargetRef.current = null;
  }, []);

  const closeEditor = returnToOrderCardView;

  const handleOverlayBackPress = useCallback((): boolean => {
    if (editorOpen) {
      closeEditor();
      return true;
    }
    if (replacePickerOpen) {
      closeReplacePicker();
      return true;
    }
    if (previewOpen) {
      closePreview();
      return true;
    }
    if (photoGridOpen) {
      closePhotoGrid();
      return true;
    }
    return false;
  }, [
    closeEditor,
    closePhotoGrid,
    closePreview,
    closeReplacePicker,
    editorOpen,
    photoGridOpen,
    previewOpen,
    replacePickerOpen,
  ]);

  useEffect(() => {
    if (!editorOpen && !previewOpen && !replacePickerOpen && !photoGridOpen) {
      return;
    }

    return pushOrderOverlayBackHandler(handleOverlayBackPress);
  }, [editorOpen, handleOverlayBackPress, photoGridOpen, previewOpen, replacePickerOpen]);

  const handlePreviewPageSelected = useCallback((position: number) => {
    setPreviewIndex((current) => (current === position ? current : position));
  }, []);

  const handleDownloadPreview = useCallback(async () => {
    if (!previewItem) {
      return;
    }

    const annotationKey = getOrderAttachedImageKey(previewItem);
    const annotation = annotationData?.[annotationKey];
    const hasAnnotation = Boolean(annotation && !isEmptyCatalogImageTextAnnotation(annotation));

    setDownloading(true);
    try {
      let result: 'saved' | 'shared' = 'saved';
      if (previewItem.kind === 'catalog') {
        if (hasAnnotation) {
          result = await saveMarkedCatalogImageToGallery({
            imageId: previewItem.id,
            annotation,
            language,
            fileStem: previewItem.id,
            captureViewRef: previewCaptureRef,
          });
        } else {
          result = await saveCatalogImageToGallery({
            imageId: previewItem.id,
            fileStem: previewItem.id,
          });
        }
      } else {
        result = await saveMarkedRemoteImageToGallery({
          imageUri: previewItem.url,
          imageKey: previewItem.url,
          annotation: hasAnnotation ? annotation : undefined,
          language,
          fileStem: 'studio_order',
          captureViewRef: previewCaptureRef,
        });
      }
      Alert.alert(
        t('done'),
        result === 'shared' ? t('mirrorCatalogDownloadSharePrompt') : t('mirrorCatalogDownloadSuccess'),
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'Expo Go gallery save unavailable') {
        Alert.alert(t('error'), t('mirrorCatalogDownloadExpoGoRequired'));
      } else if (error instanceof Error && error.message === 'Permission denied') {
        Alert.alert(t('error'), t('mirrorCatalogDownloadPermissionDenied'));
      } else {
        Alert.alert(t('error'), t('mirrorCatalogDownloadFailed'));
      }
    } finally {
      setDownloading(false);
    }
  }, [annotationData, language, previewItem, t]);

  const startAnnotateCatalog = useCallback((imageId: MirrorCatalogImageId) => {
    if (!getMirrorCatalogDisplaySource(imageId)) {
      return;
    }
    setPreviewIndex(null);
    setEditorKey(imageId);
    setEditorImage(null);
    setEditorOpen(true);
  }, []);

  const startAnnotateStudio = useCallback((imageUrl: string) => {
    setPreviewIndex(null);
    setEditorKey(imageUrl);
    setEditorImage({uri: imageUrl});
    setEditorOpen(true);
  }, []);

  const startAnnotatePreview = useCallback(
    (item: OrderAttachedImage) => {
      if (item.kind === 'catalog') {
        startAnnotateCatalog(item.id);
        return;
      }
      startAnnotateStudio(item.url);
    },
    [startAnnotateCatalog, startAnnotateStudio],
  );

  const handleAnnotateComplete = useCallback(
    async (annotation: CatalogImageTextAnnotation) => {
      if (!editorKey || !onAnnotationDataChange) {
        return;
      }

      const savedEditorKey = editorKey;
      const nextData: CatalogMirrorImageAnnotationData = {
        ...(annotationData ?? {}),
        [savedEditorKey]: annotation,
      };

      try {
        await onAnnotationDataChange(nextData);
        invalidateCatalogImageMarkerCache(savedEditorKey);
      } catch {
        // Parent shows the save error alert; keep editor open for retry.
        throw new Error('annotation save failed');
      }
    },
    [annotationData, editorKey, onAnnotationDataChange],
  );

  const startReplace = useCallback((imageId: MirrorCatalogImageId) => {
    replaceTargetRef.current = imageId;
    replaceStudioTargetRef.current = null;
    setReplaceTargetId(imageId);
    setReplaceStudioTargetUrl(null);
    setReplacePickerOpen(true);
  }, []);

  const startStudioReplace = useCallback((imageUrl: string) => {
    replaceStudioTargetRef.current = imageUrl;
    replaceTargetRef.current = null;
    setReplaceStudioTargetUrl(imageUrl);
    setReplaceTargetId(null);
    setReplacePickerOpen(true);
  }, []);

  const executeRemoveImage = useCallback(
    async (imageId: MirrorCatalogImageId) => {
      if (!onRemoveImage) {
        return;
      }

      const nextImageIds = catalogImageIds.filter((entry) => entry !== imageId);
      setOptimisticImageIds(nextImageIds);

      if (editorKey === imageId) {
        setEditorOpen(false);
        setEditorImage(null);
        setEditorKey(null);
      }

      if (previewIndex !== null) {
        const removedIndex = catalogImageIds.indexOf(imageId);
        if (removedIndex >= 0) {
          if (nextImageIds.length === 0) {
            setPreviewIndex(null);
          } else {
            setPreviewIndex(Math.min(removedIndex, nextImageIds.length - 1));
          }
        }
      }

      if (nextImageIds.length === 0) {
        setPhotoGridOpen(false);
      }

      try {
        await onRemoveImage(imageId);
      } catch {
        setOptimisticImageIds(null);
        if (previewIndex !== null) {
          const previousIndex = catalogImageIds.indexOf(imageId);
          if (previousIndex >= 0) {
            setPreviewIndex(previousIndex);
          }
        }
      }
    },
    [catalogImageIds, editorKey, onRemoveImage, previewIndex],
  );

  const promptRemoveImage = useCallback(
    (imageId: MirrorCatalogImageId) => {
      Alert.alert(t('mirrorCatalogRemoveImage'), t('mirrorCatalogRemoveImageConfirmMessage'), [
        {text: t('no'), style: 'cancel'},
        {
          text: t('yes'),
          style: 'destructive',
          onPress: () => {
            void executeRemoveImage(imageId);
          },
        },
      ]);
    },
    [executeRemoveImage, t],
  );

  const promptRemoveStudioImage = useCallback(
    (imageUrl: string) => {
      Alert.alert(t('mirrorCatalogRemoveImage'), t('mirrorCatalogRemoveImageConfirmMessage'), [
        {text: t('no'), style: 'cancel'},
        {
          text: t('yes'),
          style: 'destructive',
          onPress: () => {
            void onRemoveStudioImage?.(imageUrl);
          },
        },
      ]);
    },
    [onRemoveStudioImage, t],
  );

  const handleReplaceConfirm = useCallback(
    async (selectedIds: MirrorCatalogImageId[]) => {
      const studioTargetUrl = replaceStudioTargetRef.current;
      const newImageId = selectedIds[0];
      if (!newImageId) {
        return;
      }

      if (studioTargetUrl) {
        if (!onReplaceStudioImageWithCatalog) {
          return;
        }

        if (previewIndex !== null) {
          const currentItem = attachedImages[previewIndex];
          if (currentItem?.kind === 'studio' && currentItem.url === studioTargetUrl) {
            const nextPreviewIndex = attachedImages.findIndex(
              (item, index) =>
                index !== previewIndex &&
                ((item.kind === 'catalog' && item.id === newImageId) ||
                  (item.kind === 'studio' && item.url !== studioTargetUrl)),
            );
            if (nextPreviewIndex >= 0) {
              setPreviewIndex(nextPreviewIndex);
            }
          }
        }

        try {
          await onReplaceStudioImageWithCatalog(studioTargetUrl, newImageId);
          invalidateMirrorCatalogMaterializedUri(newImageId);
          invalidateCatalogImageMarkerCache(studioTargetUrl);
        } catch {
          return;
        }

        closeReplacePicker();
        return;
      }

      const targetId = replaceTargetRef.current;
      if (!targetId || !onReplaceImage || newImageId === targetId) {
        return;
      }

      const nextImageIds = catalogImageIds.map((entry) =>
        entry === targetId ? newImageId : entry,
      );
      setOptimisticImageIds(nextImageIds);

      if (editorKey === targetId) {
        setEditorOpen(false);
        setEditorImage(null);
        setEditorKey(null);
      }

      if (previewIndex !== null && targetId === catalogImageIds[previewIndex]) {
        const nextPreviewIndex = nextImageIds.indexOf(newImageId);
        if (nextPreviewIndex >= 0) {
          setPreviewIndex(nextPreviewIndex);
        }
      }

      try {
        await onReplaceImage(targetId, newImageId);
        invalidateMirrorCatalogMaterializedUri(targetId);
        invalidateMirrorCatalogMaterializedUri(newImageId);
        invalidateCatalogImageMarkerCache(targetId);
      } catch {
        setOptimisticImageIds(null);
        if (previewIndex !== null && targetId === catalogImageIds[previewIndex]) {
          const previousIndex = catalogImageIds.indexOf(targetId);
          if (previousIndex >= 0) {
            setPreviewIndex(previousIndex);
          }
        }
        return;
      }

      closeReplacePicker();
    },
    [
      attachedImages,
      catalogImageIds,
      closeReplacePicker,
      editorKey,
      onReplaceImage,
      onReplaceStudioImageWithCatalog,
      previewIndex,
    ],
  );

  const replaceDisabledIds = useMemo(() => {
    if (replaceStudioTargetUrl) {
      return [];
    }
    if (!replaceTargetId) {
      return catalogImageIds;
    }
    return catalogImageIds.filter((imageId) => imageId !== replaceTargetId);
  }, [catalogImageIds, replaceStudioTargetUrl, replaceTargetId]);

  const replacePickerTitle = replaceStudioTargetUrl
    ? t('mirrorCatalogReplaceStudioPickerTitle')
    : t('mirrorCatalogReplacePickerTitle');
  const replacePickerSubtitle = replaceStudioTargetUrl
    ? t('mirrorCatalogReplaceStudioPickerSubtitle')
    : canReplaceWithStudio
      ? t('mirrorCatalogReplacePickerSubtitleWithStudio')
      : t('mirrorCatalogReplacePickerSubtitle');
  const replacePickerStudioUploadEnabled = replaceStudioTargetUrl
    ? canReplaceStudio
    : canReplaceWithStudio;
  const replacePickerStudioUploadHandler = replaceStudioTargetUrl
    ? handleStudioReplaceWithGallery
    : handleReplaceWithStudio;

  if (attachedImages.length === 0) {
    return null;
  }

  const previewLabel =
    previewItem?.kind === 'catalog'
      ? previewItem.id
      : previewItem?.kind === 'studio'
        ? t('orderStudioPreviewLabel')
        : '';

  const previewModal = (
    <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={closePreview}>
      <View style={styles.previewBackdrop}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle} numberOfLines={1}>
            {attachedImages.length > 1 && previewIndex !== null
              ? `${previewIndex + 1} / ${attachedImages.length} · ${previewLabel}`
              : previewLabel}
          </Text>
          <Pressable onPress={closePreview} hitSlop={12} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.previewBody}>
          {previewIndex !== null ? (
            <PagerView
              key={`catalog-preview-${previewSessionKey}`}
              style={styles.previewPager}
              initialPage={previewIndex}
              onPageSelected={(event) => handlePreviewPageSelected(event.nativeEvent.position)}
            >
              {attachedImages.map((item, pageIndex) => {
                const shouldRenderPage =
                  previewIndex !== null && Math.abs(pageIndex - previewIndex) <= 1;
                const pageKey = getOrderAttachedImageKey(item);

                return (
                <View key={`${pageKey}-${pageIndex}`} style={styles.previewPage} collapsable={false}>
                  {shouldRenderPage ? (
                  <View
                    collapsable={false}
                    ref={pageIndex === previewIndex ? previewCaptureRef : undefined}
                    style={styles.previewImageWrap}
                  >
                    {item.kind === 'catalog' ? (
                      <CatalogImageWithTextOverlay
                        imageId={item.id}
                        annotation={annotationData?.[item.id]}
                        width={previewSize}
                        height={previewSize}
                      />
                    ) : (
                      <StudioImageWithTextOverlay
                        imageUri={item.url}
                        imageKey={item.url}
                        annotation={annotationData?.[item.url]}
                        width={previewSize}
                        height={previewSize}
                      />
                    )}
                    {item.kind === 'catalog' && canRemove ? (
                      <Pressable
                        style={[
                          styles.previewDeleteBtn,
                          previewBusy ? styles.previewIconActionDisabled : null,
                        ]}
                        onPress={() => promptRemoveImage(item.id)}
                        disabled={previewBusy}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('mirrorCatalogRemoveImage')}
                      >
                        <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
                      </Pressable>
                    ) : null}
                    {item.kind === 'studio' && canRemoveStudio ? (
                      <Pressable
                        style={[
                          styles.previewDeleteBtn,
                          previewBusy ? styles.previewIconActionDisabled : null,
                        ]}
                        onPress={() => promptRemoveStudioImage(item.url)}
                        disabled={previewBusy}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('mirrorCatalogRemoveImage')}
                      >
                        <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
                      </Pressable>
                    ) : null}
                  </View>
                  ) : (
                    <View style={styles.previewImageWrap} />
                  )}
                </View>
                );
              })}
            </PagerView>
          ) : null}
        </View>
        {previewItem ? (
          <View style={styles.previewBottomActions}>
            <Pressable
              style={[styles.previewIconAction, previewBusy ? styles.previewIconActionDisabled : null]}
              onPress={() => void handleDownloadPreview()}
              disabled={previewBusy}
              accessibilityRole="button"
              accessibilityLabel={t('mirrorCatalogDownloadImage')}
            >
              {downloading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <MaterialCommunityIcons name="download-outline" size={16} color="#FFFFFF" />
              )}
              <Text style={styles.previewIconLabel}>{t('mirrorCatalogDownloadImage')}</Text>
            </Pressable>
            {canAnnotate ? (
              <Pressable
                style={[styles.previewIconAction, previewBusy ? styles.previewIconActionDisabled : null]}
                onPress={() => startAnnotatePreview(previewItem)}
                disabled={previewBusy}
                accessibilityRole="button"
                accessibilityLabel={t('mirrorCatalogEditShort')}
              >
                {annotating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <MaterialCommunityIcons name="pencil-outline" size={16} color="#FFFFFF" />
                )}
                <Text style={styles.previewIconLabel}>{t('mirrorCatalogEditShort')}</Text>
              </Pressable>
            ) : null}
            {previewItem.kind === 'catalog' && canReplace ? (
              <Pressable
                style={[styles.previewIconAction, previewBusy ? styles.previewIconActionDisabled : null]}
                onPress={() => startReplace(previewItem.id)}
                disabled={previewBusy}
                accessibilityRole="button"
                accessibilityLabel={t('mirrorCatalogReplaceImage')}
              >
                {replacing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <MaterialCommunityIcons name="swap-horizontal" size={16} color="#FFFFFF" />
                )}
                <Text style={styles.previewIconLabel}>{t('mirrorCatalogReplaceImage')}</Text>
              </Pressable>
            ) : null}
            {previewItem.kind === 'studio' && canReplaceStudioWithCatalog ? (
              <Pressable
                style={[styles.previewIconAction, previewBusy ? styles.previewIconActionDisabled : null]}
                onPress={() => startStudioReplace(previewItem.url)}
                disabled={previewBusy}
                accessibilityRole="button"
                accessibilityLabel={t('mirrorCatalogReplaceImage')}
              >
                {replacing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <MaterialCommunityIcons name="swap-horizontal" size={16} color="#FFFFFF" />
                )}
                <Text style={styles.previewIconLabel}>{t('mirrorCatalogReplaceImage')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );

  const editorModal =
    editorKey ? (
      <CatalogImageTextEditorModal
        key={editorKey}
        visible={editorOpen}
        imageId={editorKey}
        image={editorImage}
        initialAnnotation={annotationData?.[editorKey]}
        onClose={closeEditor}
        onComplete={(annotation) => {
          void handleAnnotateComplete(annotation);
        }}
      />
    ) : null;

  const replacePicker = (
    <MirrorCatalogPickerSheet
      visible={replacePickerOpen}
      selectedIds={[]}
      selectionMode="single"
      disabledIds={replaceDisabledIds}
      title={replacePickerTitle}
      subtitle={replacePickerSubtitle}
      confirmLabel={t('mirrorCatalogReplaceImage')}
      enableStudioUpload={replacePickerStudioUploadEnabled}
      uploadingStudio={replacing}
      onAddStudioImages={replacePickerStudioUploadHandler}
      onClose={closeReplacePicker}
      onConfirm={(selectedIds) => {
        void handleReplaceConfirm(selectedIds);
      }}
    />
  );

  const photoGridModal = photoGridOpen ? (
    <Modal visible animationType="slide" onRequestClose={closePhotoGrid}>
      <View style={styles.photoGridBackdrop}>
        <View style={styles.photoGridHeader}>
          <Text style={[styles.photoGridTitle, inlineTextStyle, {color: theme.typography.primary}]}>
            {t('mirrorCatalogViewPhotos')} ({attachedImages.length})
          </Text>
          <Pressable onPress={closePhotoGrid} hitSlop={12} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={24} color={theme.colors.icon} />
          </Pressable>
        </View>
        <FlatList
          data={attachedImages}
          keyExtractor={(item, index) => `${index}-${getOrderAttachedImageKey(item)}`}
          numColumns={PHOTO_GRID_COLUMNS}
          columnWrapperStyle={styles.photoGridRow}
          contentContainerStyle={styles.photoGridList}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          renderItem={({item}) =>
            item.kind === 'catalog' ? (
              <CatalogThumb
                imageId={item.id}
                annotation={annotationData?.[item.id]}
                size={photoGridItemSize}
                radius={theme.components.input.radius}
                borderColor={theme.colors.divider}
                onPress={() => openPreviewFromGrid(item)}
              />
            ) : (
              <StudioThumb
                imageUrl={item.url}
                annotation={annotationData?.[item.url]}
                size={photoGridItemSize}
                radius={theme.components.input.radius}
                borderColor={theme.colors.divider}
                onPress={() => openPreviewFromGrid(item)}
              />
            )
          }
        />
      </View>
    </Modal>
  ) : null;

  if (compact) {
    const annotatedCount = countOrderImageTextAnnotations(catalogImageIds, studioImageUrls, annotationData);
    const visibleImages = attachedImages.slice(0, COMPACT_VISIBLE_THUMBS);
    const hiddenImageCount = Math.max(0, attachedImages.length - visibleImages.length);

    return (
      <>
        <View style={styles.section}>
          <View style={styles.compactRow}>
            <MaterialCommunityIcons name="image-multiple-outline" size={14} color={theme.colors.primary} />
            <Text style={[styles.compactText, inlineTextStyle, {color: theme.colors.primary}]}>
              {annotatedCount > 0
                ? t('mirrorCatalogImagesCountAnnotated', {count: attachedImages.length, annotated: annotatedCount})
                : t('mirrorCatalogImagesCount', {count: attachedImages.length})}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.compactThumbRow}
          >
            {visibleImages.map((item, index) =>
              item.kind === 'catalog' ? (
                <CatalogThumb
                  key={`${index}-${item.id}`}
                  imageId={item.id}
                  annotation={annotationData?.[item.id]}
                  size={compactThumbSize}
                  radius={theme.components.input.radius}
                  borderColor={theme.colors.divider}
                  onPress={() => openPreview(item)}
                />
              ) : (
                <StudioThumb
                  key={`${index}-${item.url}`}
                  imageUrl={item.url}
                  annotation={annotationData?.[item.url]}
                  size={compactThumbSize}
                  radius={theme.components.input.radius}
                  borderColor={theme.colors.divider}
                  onPress={() => openPreview(item)}
                />
              ),
            )}
            {hiddenImageCount > 0 ? (
              <Pressable
                style={[
                  styles.compactMoreThumb,
                  {
                    width: compactThumbSize,
                    height: compactThumbSize,
                    borderRadius: theme.components.input.radius,
                    borderColor: theme.colors.divider,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
                onPress={() => setPreviewIndex(COMPACT_VISIBLE_THUMBS)}
                accessibilityRole="button"
                accessibilityLabel={t('mirrorCatalogImagesMoreCount', {count: hiddenImageCount})}
              >
                <Text style={[styles.compactMoreText, {color: theme.colors.primary}]}>
                  {t('mirrorCatalogImagesMoreCount', {count: hiddenImageCount})}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
        {previewOpen ? previewModal : null}
        {editorOpen && editorKey ? editorModal : null}
        {replacePickerOpen ? replacePicker : null}
      </>
    );
  }

  return (
    <>
      <View style={styles.section} onLayout={handleThumbRowLayout}>
        <Pressable
          onPress={openPhotoGrid}
          hitSlop={6}
          style={styles.viewPhotosButton}
          accessibilityRole="button"
          accessibilityLabel={t('mirrorCatalogViewPhotosA11y', {count: attachedImages.length})}
        >
          <MaterialCommunityIcons
            name="image-multiple-outline"
            size={14}
            color={theme.typography.secondary}
          />
          <Text style={[styles.sectionTitle, inlineTextStyle, {color: theme.typography.secondary}]}>
            {t('mirrorCatalogViewPhotos')}
          </Text>
        </Pressable>
        <View style={styles.horizontalThumbRow}>
          {(() => {
            const hasMoreImages = attachedImages.length > EXPANDED_VISIBLE_THUMBS;
            const visibleImages = hasMoreImages
              ? attachedImages.slice(0, EXPANDED_VISIBLE_THUMBS)
              : attachedImages;
            const hiddenImageCount = hasMoreImages
              ? attachedImages.length - EXPANDED_VISIBLE_THUMBS
              : 0;

            return visibleImages.map((item, index) =>
              item.kind === 'catalog' ? (
                <CatalogThumb
                  key={`${index}-${item.id}`}
                  imageId={item.id}
                  annotation={annotationData?.[item.id]}
                  size={expandedThumbSize}
                  radius={theme.components.input.radius}
                  borderColor={theme.colors.divider}
                  onPress={() => openPreview(item)}
                  moreCount={
                    hasMoreImages && index === EXPANDED_VISIBLE_THUMBS - 1 ? hiddenImageCount : undefined
                  }
                />
              ) : (
                <StudioThumb
                  key={`${index}-${item.url}`}
                  imageUrl={item.url}
                  annotation={annotationData?.[item.url]}
                  size={expandedThumbSize}
                  radius={theme.components.input.radius}
                  borderColor={theme.colors.divider}
                  onPress={() => openPreview(item)}
                  moreCount={
                    hasMoreImages && index === EXPANDED_VISIBLE_THUMBS - 1 ? hiddenImageCount : undefined
                  }
                />
              ),
            );
          })()}
        </View>
        {attachedImages.length > EXPANDED_VISIBLE_THUMBS ? (
          <Text
            style={[styles.moreImagesHint, inlineTextStyle, {color: theme.colors.primary}]}
          >
            {t('mirrorCatalogImagesMoreHint', {
              count: attachedImages.length - EXPANDED_VISIBLE_THUMBS,
            })}
          </Text>
        ) : null}
      </View>

      {photoGridOpen ? photoGridModal : null}
      {previewOpen ? previewModal : null}
      {editorOpen && editorKey ? editorModal : null}
      {replacePickerOpen ? replacePicker : null}
    </>
  );
};

export default ConfirmedOrderCatalogImages;
