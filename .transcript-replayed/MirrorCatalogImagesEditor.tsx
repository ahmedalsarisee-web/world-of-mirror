import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import CatalogImageThumb from '@app/components/common/catalogImageText/CatalogImageThumb';
import CatalogImageWithTextOverlay from '@app/components/common/catalogImageText/CatalogImageWithTextOverlay';
import CatalogImageTextEditorModal from '@app/components/common/catalogImageText/CatalogImageTextEditorModal';
import MirrorCatalogPickerSheet from '@app/components/pricing/MirrorCatalogPickerSheet';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {normalizeMirrorCatalogImageIds, type MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';

import {
  buildOrderAttachedImages,
  getOrderAttachedImageKey,
  type OrderAttachedImage,
} from '@app/utils/orderAttachedImages';
import {
  catalogImageToPickedImage,
  hasCatalogImageTextAnnotation,
  type CatalogMirrorImageAnnotationData,
} from '@app/utils/catalogImageTextAnnotations';
import {
  isEmptyCatalogImageTextAnnotation,
  type CatalogImageTextAnnotation,
} from '@app/utils/catalogImageTextEditor';
import type {PickedImage} from '@app/utils/imagePicker';
import {invalidateCatalogImageMarkerCache} from '@app/utils/catalogImageMarker';

interface Props {
  selectedIds: MirrorCatalogImageId[];
  onChangeSelected: (selectedIds: MirrorCatalogImageId[]) => void;
  annotationData?: CatalogMirrorImageAnnotationData;
  onChangeAnnotationData?: (data: CatalogMirrorImageAnnotationData) => void;
  disabled?: boolean;
}

const THUMB_SIZE = 72;

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
  annotateLabel: string;
  replaceLabel: string;
  removeLabel: string;
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
  annotateLabel,
  replaceLabel,
  removeLabel,
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
        <View style={stylesStatic.annotateButton} pointerEvents="box-none">
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
      ) : null}
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
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
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
  annotateButton: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    gap: 4,
  },
  thumbActionPill: {
    flex: 1,
    minHeight: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  thumbActionText: {
    color: '#FFFFFF',
    fontSize: 10,
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
});

const MirrorCatalogImagesEditor: React.FC<Props> = ({
  selectedIds,
  onChangeSelected,
  annotationData,
  onChangeAnnotationData,
  disabled = false,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, chevronForward} = useDirection();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replacePickerOpen, setReplacePickerOpen] = useState(false);
  const [replaceTargetId, setReplaceTargetId] = useState<MirrorCatalogImageId | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImageId, setEditorImageId] = useState<MirrorCatalogImageId | null>(null);
  const [editorImage, setEditorImage] = useState<PickedImage | null>(null);

  const catalogImageIds = useMemo(() => normalizeMirrorCatalogImageIds(selectedIds), [selectedIds]);
  const canAnnotate = Boolean(onChangeAnnotationData);
  const thumbRadius = theme.components.input.radius;

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
      }
    },
    [annotationData, catalogImageIds, onChangeAnnotationData, onChangeSelected],
  );

  const replaceImage = useCallback(
    (oldImageId: MirrorCatalogImageId, newImageId: MirrorCatalogImageId) => {
      if (oldImageId === newImageId) {
        return;
      }
      if (editorImageId === oldImageId) {
        setEditorOpen(false);
        setEditorImage(null);
        setEditorImageId(null);
      }
      onChangeSelected(catalogImageIds.map((entry) => (entry === oldImageId ? newImageId : entry)));
      if (onChangeAnnotationData && annotationData?.[oldImageId]) {
        const next = {...annotationData};
        delete next[oldImageId];
        onChangeAnnotationData(next);
      }
    },
    [annotationData, catalogImageIds, editorImageId, onChangeAnnotationData, onChangeSelected],
  );

  const replaceDisabledIds = useMemo(() => {
    if (!replaceTargetId) {
      return catalogImageIds;
    }
    return catalogImageIds.filter((imageId) => imageId !== replaceTargetId);
  }, [catalogImageIds, replaceTargetId]);

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
    (annotation: CatalogImageTextAnnotation) => {
      if (!editorImageId || !onChangeAnnotationData) {
        return;
      }
      onChangeAnnotationData({
        ...(annotationData ?? {}),
        [editorImageId]: annotation,
      });
      setEditorOpen(false);
      setEditorImage(null);
      setEditorImageId(null);
    },
    [annotationData, editorImageId, onChangeAnnotationData],
  );

  const openReplacePicker = useCallback((imageId: MirrorCatalogImageId) => {
    setReplaceTargetId(imageId);
    setReplacePickerOpen(true);
  }, []);

  const removeStudioImage = useCallback(

    (imageUrl: string) => {

      if (!onChangeStudioUrls) {

        return;

      }

      onChangeStudioUrls(studioImageUrls.filter((entry) => entry !== imageUrl));

    },

    [onChangeStudioUrls, studioImageUrls],

  );



  const annotateLabel = t('mirrorCatalogEditShort');
  const replaceLabel = t('mirrorCatalogReplaceImage');
  const removeLabel = t('mirrorCatalogRemoveImage');

  const renderAttachedThumb = useCallback(
    ({item}: {item: OrderAttachedImage}) => {
      if (item.kind === 'studio') {
        return (
          <StudioEditorThumb
            imageUrl={item.url}
            disabled={disabled}
            radius={thumbRadius}
            onRemove={removeStudioImage}
            removeLabel={removeLabel}
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
          onAnnotate={startAnnotate}
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
      disabled,
      openReplacePicker,
      removeImage,
      removeLabel,
      removeStudioImage,
      replaceLabel,
      startAnnotate,
      theme.colors.primary,
      thumbRadius,
    ],
  );

  const attachedThumbKeyExtractor = useCallback(
    (item: OrderAttachedImage, index: number) => `${index}-${getOrderAttachedImageKey(item)}`,
    [],
  );



  const renderThumb = useCallback(
    ({item: imageId}: {item: MirrorCatalogImageId}) => (
      <EditorCatalogThumb
        imageId={imageId}
        annotation={annotationData?.[imageId]}
        isAnnotated={hasCatalogImageTextAnnotation(imageId, annotationData)}
        canAnnotate={canAnnotate}
        disabled={disabled}
        radius={thumbRadius}
        onAnnotate={startAnnotate}
        onReplace={openReplacePicker}
        onRemove={removeImage}
        annotateLabel={annotateLabel}
        replaceLabel={replaceLabel}
        removeLabel={removeLabel}
        primaryColor={theme.colors.primary}
      />
    ),
    [
      annotationData,
      annotateLabel,
      canAnnotate,
      disabled,
      openReplacePicker,
      removeImage,
      removeLabel,
      replaceLabel,
      startAnnotate,
      theme.colors.primary,
      thumbRadius,
    ],
  );

  const thumbKeyExtractor = useCallback(
    (imageId: MirrorCatalogImageId, index: number) => `${index}-${imageId}`,
    [],
  );

  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
          {t('mirrorCatalogEditSectionLabel')}
        </Text>

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
          accessibilityLabel={t('mirrorCatalogEditChange')}
        >
          <View style={[styles.pickerIconWrap, {backgroundColor: theme.colors.surfaceSecondary}]}>
            <MaterialCommunityIcons name="image-edit-outline" size={18} color={theme.colors.primary} />
          </View>
          <Text style={[styles.pickerValue, textStyle, {color: theme.typography.primary}]} numberOfLines={2}>
            {catalogImageIds.length > 0
              ? t('mirrorCatalogEditChangeWithCount', {count: catalogImageIds.length})
              : t('mirrorCatalogEditAdd')}
          </Text>
          <MaterialCommunityIcons name={chevronForward} size={18} color={theme.colors.icon} />
        </Pressable>

        {catalogImageIds.length > 0 ? (
          <FlatList
            horizontal
            data={catalogImageIds}
            keyExtractor={thumbKeyExtractor}
            renderItem={renderThumb}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.thumbList, {gap: theme.spacing.xs}]}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews
          />
        ) : null}
      </View>

      <MirrorCatalogPickerSheet
        visible={pickerOpen}
        selectedIds={catalogImageIds}
        onClose={() => setPickerOpen(false)}
        onConfirm={(nextIds) => {
          onChangeSelected(nextIds);
          if (onChangeAnnotationData && annotationData) {
            const allowed = new Set(nextIds);
            const pruned: CatalogMirrorImageAnnotationData = {};
            for (const [id, state] of Object.entries(annotationData)) {
              if (allowed.has(id as MirrorCatalogImageId)) {
                pruned[id] = state;
              }
            }
            onChangeAnnotationData(pruned);
          }
        }}
      />

      <MirrorCatalogPickerSheet
        visible={replacePickerOpen}
        selectedIds={[]}
        selectionMode="single"
        disabledIds={replaceDisabledIds}
        title={t('mirrorCatalogReplacePickerTitle')}
        confirmLabel={t('mirrorCatalogReplaceImage')}
        onClose={() => {
          setReplacePickerOpen(false);
          setReplaceTargetId(null);
        }}
        onConfirm={(selectedIds) => {
          const newImageId = selectedIds[0];
          if (replaceTargetId && newImageId) {
            replaceImage(replaceTargetId, newImageId);
          }
          setReplacePickerOpen(false);
          setReplaceTargetId(null);
        }}
      />

      {editorImageId ? (
        <CatalogImageTextEditorModal
          key={editorImageId}
          visible={editorOpen}
          imageId={editorImageId}
          image={editorImage}
          initialAnnotation={annotationData?.[editorImageId]}
          showEntryMenu
          onClose={() => {
            setEditorOpen(false);
            setEditorImage(null);
            setEditorImageId(null);
          }}
          onComplete={handleAnnotateComplete}
        />
      ) : null}
    </>
  );
};

export default MirrorCatalogImagesEditor;
