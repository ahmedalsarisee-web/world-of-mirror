import React, {useCallback, useMemo, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import CatalogImageThumb from '@app/components/common/CatalogImageThumb';
import StudioImageThumb from '@app/components/common/StudioImageThumb';
import CatalogImageWithTextOverlay from '@app/components/common/catalogImageText/CatalogImageWithTextOverlay';
import StudioImageWithTextOverlay from '@app/components/common/catalogImageText/StudioImageWithTextOverlay';
import CatalogImageTextEditorModal from '@app/components/common/catalogImageText/CatalogImageTextEditorModal';
import MirrorCatalogPickerSheet from '@app/components/pricing/MirrorCatalogPickerSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {normalizeMirrorCatalogImageIds, type MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import {getMirrorCatalogDisplaySource} from '@app/data/mirrorCatalogImageAssets';
import {
  hasCatalogImageTextAnnotation,
  pruneOrderImageAnnotationData,
  type CatalogMirrorImageAnnotationData,
} from '@app/utils/catalogImageTextAnnotations';
import {
  isEmptyCatalogImageTextAnnotation,
  type CatalogImageTextAnnotation,
} from '@app/utils/catalogImageTextEditor';
import type {PickedImage} from '@app/utils/imagePicker';
import {invalidateCatalogImageMarkerCache} from '@app/utils/catalogImageMarker';
import {invalidateMirrorCatalogMaterializedUri} from '@app/utils/mirrorCatalogExpoImage';
import {applyStudioToCatalogReplaceToDraft} from '@app/utils/orderStudioImageReplace';
import {
  buildOrderAttachedImages,
  getOrderAttachedImageKey,
  type OrderAttachedImage,
} from '@app/utils/orderAttachedImages';

interface Props {
  selectedIds: MirrorCatalogImageId[];
  onChangeSelected: (selectedIds: MirrorCatalogImageId[]) => void;
  annotationData?: CatalogMirrorImageAnnotationData;
  onChangeAnnotationData?: (data: CatalogMirrorImageAnnotationData) => void;
  disabled?: boolean;
  variant?: 'default' | 'addOrder';
  studioImageUrls?: string[];
  onChangeStudioUrls?: (urls: string[]) => void;
  onAddStudioImages?: () => void | Promise<void>;
  onReplaceStudioImage?: (imageUrl: string) => void | Promise<void>;
  uploadingStudio?: boolean;
}

const THUMB_SIZE = 72;

interface StudioEditorThumbProps {
  imageUrl: string;
  annotation?: CatalogImageTextAnnotation;
  isAnnotated: boolean;
  canAnnotate: boolean;
  disabled: boolean;
  radius: number;
  onAnnotate: (imageUrl: string) => void;
  onReplace: (imageUrl: string) => void;
  onRemove: (imageUrl: string) => void;
  replaceLabel: string;
  removeLabel: string;
  annotateLabel: string;
  canReplace: boolean;
  primaryColor: string;
}

const StudioEditorThumb = React.memo(function StudioEditorThumb({
  imageUrl,
  annotation,
  isAnnotated,
  canAnnotate,
  disabled,
  radius,
  onAnnotate,
  onReplace,
  onRemove,
  replaceLabel,
  removeLabel,
  annotateLabel,
  canReplace,
  primaryColor,
}: StudioEditorThumbProps) {
  const showOverlay = Boolean(annotation && !isEmptyCatalogImageTextAnnotation(annotation));

  return (
    <View style={stylesStatic.thumbWrap}>
      <View style={[stylesStatic.thumb, {borderRadius: radius}]}>
        {showOverlay ? (
          <StudioImageWithTextOverlay
            imageUri={imageUrl}
            imageKey={imageUrl}
            annotation={annotation}
            width={THUMB_SIZE}
            height={THUMB_SIZE}
            borderRadius={radius}
          />
        ) : (
          <StudioImageThumb
            imageUrl={imageUrl}
            width={THUMB_SIZE}
            height={THUMB_SIZE}
            borderRadius={radius}
            priority="low"
          />
        )}
      </View>
      {canAnnotate ? (
        <View style={stylesStatic.actionRow} pointerEvents="box-none">
          <Pressable
            style={stylesStatic.thumbActionPill}
            onPress={() => onAnnotate(imageUrl)}
            disabled={disabled}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={annotateLabel}
          >
            <Text style={stylesStatic.thumbActionText}>{annotateLabel}</Text>
          </Pressable>
          {canReplace ? (
            <Pressable
              style={stylesStatic.thumbActionPill}
              onPress={() => onReplace(imageUrl)}
              disabled={disabled}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={replaceLabel}
            >
              <Text style={stylesStatic.thumbActionText}>{replaceLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : canReplace ? (
        <View style={stylesStatic.actionRow} pointerEvents="box-none">
          <Pressable
            style={stylesStatic.thumbActionPill}
            onPress={() => onReplace(imageUrl)}
            disabled={disabled}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={replaceLabel}
          >
            <Text style={stylesStatic.thumbActionText}>{replaceLabel}</Text>
          </Pressable>
        </View>
      ) : null}
      {isAnnotated ? (
        <View style={[stylesStatic.annotatedBadge, {backgroundColor: primaryColor}]}>
          <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
        </View>
      ) : null}
      {!disabled ? (
        <Pressable
          style={stylesStatic.removeButton}
          onPress={() => onRemove(imageUrl)}
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
        >
          <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
});

interface EditorThumbProps {
  imageId: MirrorCatalogImageId;
  annotation?: CatalogImageTextAnnotation;
  isAnnotated: boolean;
  canAnnotate: boolean;
  disabled: boolean;
  radius: number;
  onAnnotate: (imageId: MirrorCatalogImageId) => void;
  onReplace: (imageId: MirrorCatalogImageId) => void;
  onRemove: (imageId: MirrorCatalogImageId) => void;
  replaceLabel: string;
  removeLabel: string;
  annotateLabel: string;
  primaryColor: string;
}

const EditorCatalogThumb = React.memo(function EditorCatalogThumb({
  imageId,
  annotation,
  isAnnotated,
  canAnnotate,
  disabled,
  radius,
  onAnnotate,
  onReplace,
  onRemove,
  replaceLabel,
  removeLabel,
  annotateLabel,
  primaryColor,
}: EditorThumbProps) {
  const showOverlay = Boolean(annotation && !isEmptyCatalogImageTextAnnotation(annotation));

  return (
    <View style={stylesStatic.thumbWrap}>
      <View style={[stylesStatic.thumb, {borderRadius: radius}]}>
        {showOverlay ? (
          <CatalogImageWithTextOverlay
            imageId={imageId}
            annotation={annotation}
            width={THUMB_SIZE}
            height={THUMB_SIZE}
            borderRadius={radius}
          />
        ) : (
          <CatalogImageThumb
            imageId={imageId}
            width={THUMB_SIZE}
            height={THUMB_SIZE}
            borderRadius={radius}
            priority="low"
          />
        )}
      </View>
      {canAnnotate ? (
        <View style={stylesStatic.actionRow} pointerEvents="box-none">
          <Pressable
            style={stylesStatic.thumbActionPill}
            onPress={() => onAnnotate(imageId)}
            disabled={disabled}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={annotateLabel}
          >
            <Text style={stylesStatic.thumbActionText}>{annotateLabel}</Text>
          </Pressable>
          <Pressable
            style={stylesStatic.thumbActionPill}
            onPress={() => onReplace(imageId)}
            disabled={disabled}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={replaceLabel}
          >
            <Text style={stylesStatic.thumbActionText}>{replaceLabel}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={stylesStatic.actionRow} pointerEvents="box-none">
          <Pressable
            style={stylesStatic.thumbActionPill}
            onPress={() => onReplace(imageId)}
            disabled={disabled}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={replaceLabel}
          >
            <Text style={stylesStatic.thumbActionText}>{replaceLabel}</Text>
          </Pressable>
        </View>
      )}
      {isAnnotated ? (
        <View style={[stylesStatic.annotatedBadge, {backgroundColor: primaryColor}]}>
          <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
        </View>
      ) : null}
      <Pressable
        style={stylesStatic.removeButton}
        onPress={() => onRemove(imageId)}
        disabled={disabled}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
      >
        <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
      </Pressable>
    </View>
  );
});

const stylesStatic = StyleSheet.create({
  thumbWrap: {position: 'relative'},
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  actionRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -2,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  thumbActionPill: {
    flex: 1,
    maxWidth: '48%',
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  thumbActionText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  annotatedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
});

const MirrorCatalogImagesEditor: React.FC<Props> = ({
  selectedIds,
  onChangeSelected,
  annotationData,
  onChangeAnnotationData,
  disabled = false,
  variant = 'default',
  studioImageUrls = [],
  onChangeStudioUrls,
  onAddStudioImages,
  onReplaceStudioImage,
  uploadingStudio = false,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, chevronForward} = useDirection();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replacePickerOpen, setReplacePickerOpen] = useState(false);
  const [replaceTargetId, setReplaceTargetId] = useState<MirrorCatalogImageId | null>(null);
  const [replaceStudioTargetUrl, setReplaceStudioTargetUrl] = useState<string | null>(null);
  const replaceTargetRef = useRef<MirrorCatalogImageId | null>(null);
  const replaceStudioTargetRef = useRef<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [editorImage, setEditorImage] = useState<PickedImage | null>(null);

  const catalogImageIds = useMemo(() => normalizeMirrorCatalogImageIds(selectedIds), [selectedIds]);
  const canAnnotate = Boolean(onChangeAnnotationData);
  const canReplaceStudio = Boolean(onReplaceStudioImage);
  const attachedThumbItems = useMemo(
    () => buildOrderAttachedImages(catalogImageIds, studioImageUrls),
    [catalogImageIds, studioImageUrls],
  );

  const thumbRadius = theme.components.input.radius;
  const isAddOrderVariant = variant === 'addOrder';
  const pickerButtonLabel =
    catalogImageIds.length + studioImageUrls.length > 0
      ? isAddOrderVariant
        ? t('addOrderChooseImagesWithCount', {
            count: catalogImageIds.length + studioImageUrls.length,
          })
        : t('mirrorCatalogEditChangeWithCount', {count: catalogImageIds.length})
      : isAddOrderVariant
        ? t('addOrderChooseImages')
        : t('mirrorCatalogEditAdd');
  const pickerAccessibilityLabel = isAddOrderVariant
    ? t('addOrderChooseImages')
    : t('mirrorCatalogEditChange');
  const pickerIconName = isAddOrderVariant ? 'image-multiple-outline' : 'image-edit-outline';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {gap: theme.spacing.xs},
        sectionTitle: {fontSize: theme.typographyScale.size.sm, fontWeight: '700'},
        pickerRow: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.components.input.radius,
          borderWidth: 1,
          minHeight: 48,
        },
        pickerIconWrap: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        pickerValue: {flex: 1, fontSize: theme.typographyScale.size.sm, fontWeight: '600'},
        thumbList: {paddingVertical: 2},
      }),
    [row, theme],
  );

  const removeImage = useCallback(
    (imageId: MirrorCatalogImageId) => {
      onChangeSelected(catalogImageIds.filter((entry) => entry !== imageId));
      if (onChangeAnnotationData && annotationData?.[imageId]) {
        const next = {...annotationData};
        delete next[imageId];
        onChangeAnnotationData(next);
        invalidateCatalogImageMarkerCache(imageId);
      }
    },
    [annotationData, catalogImageIds, onChangeAnnotationData, onChangeSelected],
  );

  const replaceImage = useCallback(
    (oldImageId: MirrorCatalogImageId, newImageId: MirrorCatalogImageId) => {
      if (oldImageId === newImageId) {
        return;
      }
      if (editorKey === oldImageId) {
        setEditorOpen(false);
        setEditorImage(null);
        setEditorKey(null);
      }
      onChangeSelected(catalogImageIds.map((entry) => (entry === oldImageId ? newImageId : entry)));
      invalidateMirrorCatalogMaterializedUri(oldImageId);
      invalidateMirrorCatalogMaterializedUri(newImageId);
      if (onChangeAnnotationData && annotationData?.[oldImageId]) {
        const next = {...annotationData};
        delete next[oldImageId];
        onChangeAnnotationData(next);
        invalidateCatalogImageMarkerCache(oldImageId);
      }
    },
    [annotationData, catalogImageIds, editorKey, onChangeAnnotationData, onChangeSelected],
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

  const closeReplacePicker = useCallback(() => {
    setReplacePickerOpen(false);
    setReplaceTargetId(null);
    setReplaceStudioTargetUrl(null);
    replaceTargetRef.current = null;
    replaceStudioTargetRef.current = null;
  }, []);

  const openReplacePicker = useCallback((imageId: MirrorCatalogImageId) => {
    replaceTargetRef.current = imageId;
    replaceStudioTargetRef.current = null;
    setReplaceTargetId(imageId);
    setReplaceStudioTargetUrl(null);
    setReplacePickerOpen(true);
  }, []);

  const openStudioReplacePicker = useCallback((imageUrl: string) => {
    replaceStudioTargetRef.current = imageUrl;
    replaceTargetRef.current = null;
    setReplaceStudioTargetUrl(imageUrl);
    setReplaceTargetId(null);
    setReplacePickerOpen(true);
  }, []);

  const replaceStudioWithCatalog = useCallback(
    (oldUrl: string, newImageId: MirrorCatalogImageId) => {
      if (editorKey === oldUrl) {
        setEditorOpen(false);
        setEditorImage(null);
        setEditorKey(null);
      }

      const next = applyStudioToCatalogReplaceToDraft({
        catalogImageIds,
        studioImageUrls,
        annotationData: annotationData ?? {},
        oldUrl,
        newImageId,
      });
      onChangeSelected(next.catalogImageIds);
      onChangeStudioUrls?.(next.studioImageUrls);
      onChangeAnnotationData?.(next.annotationData);
      invalidateMirrorCatalogMaterializedUri(newImageId);
      invalidateCatalogImageMarkerCache(oldUrl);
    },
    [
      annotationData,
      catalogImageIds,
      editorKey,
      onChangeAnnotationData,
      onChangeSelected,
      onChangeStudioUrls,
      studioImageUrls,
    ],
  );

  const handleStudioReplaceWithGallery = useCallback(() => {
    const targetUrl = replaceStudioTargetRef.current;
    if (!targetUrl || !onReplaceStudioImage) {
      return;
    }

    closeReplacePicker();
    void onReplaceStudioImage(targetUrl);
  }, [closeReplacePicker, onReplaceStudioImage]);

  const startAnnotateCatalog = useCallback((imageId: MirrorCatalogImageId) => {
    if (!getMirrorCatalogDisplaySource(imageId)) {
      return;
    }
    setEditorKey(imageId);
    setEditorImage(null);
    setEditorOpen(true);
  }, []);

  const startAnnotateStudio = useCallback((imageUrl: string) => {
    setEditorKey(imageUrl);
    setEditorImage({uri: imageUrl});
    setEditorOpen(true);
  }, []);

  const handleAnnotateComplete = useCallback(
    (annotation: CatalogImageTextAnnotation) => {
      if (!editorKey || !onChangeAnnotationData) {
        return;
      }
      onChangeAnnotationData({
        ...(annotationData ?? {}),
        [editorKey]: annotation,
      });
      invalidateCatalogImageMarkerCache(editorKey);
      setEditorOpen(false);
      setEditorImage(null);
      setEditorKey(null);
    },
    [annotationData, editorKey, onChangeAnnotationData],
  );

  const removeStudioImage = useCallback(
    (imageUrl: string) => {
      if (!onChangeStudioUrls) {
        return;
      }
      onChangeStudioUrls(studioImageUrls.filter((entry) => entry !== imageUrl));
      if (onChangeAnnotationData && annotationData?.[imageUrl]) {
        const next = {...annotationData};
        delete next[imageUrl];
        onChangeAnnotationData(next);
        invalidateCatalogImageMarkerCache(imageUrl);
      }
      if (editorKey === imageUrl) {
        setEditorOpen(false);
        setEditorImage(null);
        setEditorKey(null);
      }
    },
    [annotationData, editorKey, onChangeAnnotationData, onChangeStudioUrls, studioImageUrls],
  );

  const replaceStudioImage = useCallback(
    (imageUrl: string) => {
      openStudioReplacePicker(imageUrl);
    },
    [openStudioReplacePicker],
  );

  const replacePickerTitle = replaceStudioTargetUrl
    ? t('mirrorCatalogReplaceStudioPickerTitle')
    : t('mirrorCatalogReplacePickerTitle');
  const replacePickerSubtitle = replaceStudioTargetUrl
    ? t('mirrorCatalogReplaceStudioPickerSubtitle')
    : t('mirrorCatalogReplacePickerSubtitle');
  const replacePickerStudioUploadEnabled = replaceStudioTargetUrl
    ? Boolean(onReplaceStudioImage)
    : false;

  const replaceLabel = t('mirrorCatalogReplaceImage');
  const removeLabel = t('mirrorCatalogRemoveImage');
  const annotateLabel = t('mirrorCatalogEditShort');

  const renderAttachedThumb = useCallback(
    ({item}: {item: OrderAttachedImage}) => {
      if (item.kind === 'studio') {
        return (
          <StudioEditorThumb
            imageUrl={item.url}
            annotation={annotationData?.[item.url]}
            isAnnotated={hasCatalogImageTextAnnotation(item.url, annotationData)}
            canAnnotate={canAnnotate}
            disabled={disabled}
            radius={thumbRadius}
            onAnnotate={startAnnotateStudio}
            onReplace={replaceStudioImage}
            onRemove={removeStudioImage}
            replaceLabel={replaceLabel}
            annotateLabel={annotateLabel}
            canReplace={canReplaceStudio}
            removeLabel={removeLabel}
            primaryColor={theme.colors.primary}
          />
        );
      }

      return (
        <EditorCatalogThumb
          imageId={item.id}
          annotation={annotationData?.[item.id]}
          isAnnotated={hasCatalogImageTextAnnotation(item.id, annotationData)}
          canAnnotate={canAnnotate}
          disabled={disabled}
          radius={thumbRadius}
          onAnnotate={startAnnotateCatalog}
          onReplace={openReplacePicker}
          onRemove={removeImage}
          annotateLabel={annotateLabel}
          replaceLabel={replaceLabel}
          removeLabel={removeLabel}
          primaryColor={theme.colors.primary}
        />
      );
    },
    [
      annotationData,
      annotateLabel,
      canAnnotate,
      canReplaceStudio,
      disabled,
      openReplacePicker,
      removeImage,
      onReplaceStudioImage,
      removeLabel,
      replaceStudioImage,
      replaceLabel,
      replaceLabel,
      startAnnotateCatalog,
      startAnnotateStudio,
      theme.colors.primary,
      thumbRadius,
    ],
  );

  const attachedThumbKeyExtractor = useCallback(
    (item: OrderAttachedImage, index: number) => `${index}-${getOrderAttachedImageKey(item)}`,
    [],
  );

  return (
    <>
      <View style={styles.section}>
        {!isAddOrderVariant ? (
          <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
            {t('mirrorCatalogEditSectionLabel')}
          </Text>
        ) : null}

        <Pressable
          style={({pressed}) => [
            styles.pickerRow,
            {
              borderColor: theme.colors.inputBorder,
              backgroundColor: theme.colors.inputBackground,
              opacity: pressed || disabled ? 0.88 : 1,
            },
          ]}
          onPress={() => setPickerOpen(true)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={pickerAccessibilityLabel}
        >
          <View style={[styles.pickerIconWrap, {backgroundColor: theme.colors.surfaceSecondary}]}>
            <MaterialCommunityIcons name={pickerIconName} size={18} color={theme.colors.primary} />
          </View>
          <Text style={[styles.pickerValue, textStyle, {color: theme.typography.primary}]} numberOfLines={2}>
            {pickerButtonLabel}
          </Text>
          <MaterialCommunityIcons name={chevronForward} size={18} color={theme.colors.icon} />
        </Pressable>

        {attachedThumbItems.length > 0 ? (
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.thumbList, {gap: theme.spacing.xs}]}
          >
            {attachedThumbItems.map((item, index) => (
              <React.Fragment key={attachedThumbKeyExtractor(item, index)}>
                {renderAttachedThumb({item})}
              </React.Fragment>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <MirrorCatalogPickerSheet
        visible={pickerOpen}
        selectedIds={catalogImageIds}
        title={isAddOrderVariant ? t('mirrorWarehouseTitle') : undefined}
        subtitle={isAddOrderVariant ? t('addOrderChooseImagesPickerSubtitle') : undefined}
        enableStudioUpload={Boolean(onAddStudioImages)}
        uploadingStudio={uploadingStudio}
        studioImageUrls={studioImageUrls}
        onAddStudioImages={onAddStudioImages}
        onClose={() => setPickerOpen(false)}
        onConfirm={(nextIds) => {
          onChangeSelected(nextIds);
          if (onChangeAnnotationData && annotationData) {
            onChangeAnnotationData(
              pruneOrderImageAnnotationData(nextIds, studioImageUrls, annotationData) ?? {},
            );
            const allowed = new Set([
              ...nextIds,
              ...studioImageUrls.map((entry) => String(entry ?? '').trim()).filter(Boolean),
            ]);
            for (const key of Object.keys(annotationData)) {
              if (!allowed.has(key)) {
                invalidateCatalogImageMarkerCache(key);
              }
            }
          }
        }}
      />

      <MirrorCatalogPickerSheet
        visible={replacePickerOpen}
        selectedIds={[]}
        selectionMode="single"
        disabledIds={replaceDisabledIds}
        title={replacePickerTitle}
        subtitle={replacePickerSubtitle}
        confirmLabel={t('mirrorCatalogReplaceImage')}
        enableStudioUpload={replacePickerStudioUploadEnabled}
        uploadingStudio={uploadingStudio}
        onAddStudioImages={replacePickerStudioUploadEnabled ? handleStudioReplaceWithGallery : undefined}
        onClose={closeReplacePicker}
        onConfirm={(selectedIds) => {
          const studioTargetUrl = replaceStudioTargetRef.current;
          const newImageId = selectedIds[0];
          if (studioTargetUrl && newImageId) {
            replaceStudioWithCatalog(studioTargetUrl, newImageId);
            closeReplacePicker();
            return;
          }

          const targetId = replaceTargetRef.current;
          if (targetId && newImageId) {
            replaceImage(targetId, newImageId);
          }
          closeReplacePicker();
        }}
      />

      {editorKey ? (
        <CatalogImageTextEditorModal
          key={editorKey}
          visible={editorOpen}
          imageId={editorKey}
          image={editorImage}
          initialAnnotation={annotationData?.[editorKey]}
          showEntryMenu
          onClose={() => {
            setEditorOpen(false);
            setEditorImage(null);
            setEditorKey(null);
          }}
          onComplete={handleAnnotateComplete}
        />
      ) : null}
    </>
  );
};

export default MirrorCatalogImagesEditor;
