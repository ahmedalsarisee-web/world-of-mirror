import React, {useCallback, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import BottomSheet from '@app/components/common/BottomSheet';
import AppButton from '@app/components/common/AppButton';
import OrderStudioUploadTile from '@app/components/pricing/OrderStudioUploadTile';
import CatalogImageThumb from '@app/components/common/CatalogImageThumb';
import StudioImageThumb from '@app/components/common/StudioImageThumb';
import {useTheme} from '@app/context/ThemeContext';
import {useDirection} from '@app/hooks/useDirection';
import type {MirrorCatalogImageId} from '@app/types/mirrorCatalog';
import {useMirrorCatalogStore} from '@app/stores/mirrorCatalogStore';
import {
  buildOrderAttachedImages,
  getOrderAttachedImageKey,
  type OrderAttachedImage,
} from '@app/utils/orderAttachedImages';

interface Props {
  visible: boolean;
  selectedIds: MirrorCatalogImageId[];
  onClose: () => void;
  onConfirm: (selectedIds: MirrorCatalogImageId[]) => void;
  selectionMode?: 'multiple' | 'single';
  disabledIds?: MirrorCatalogImageId[];
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  enableStudioUpload?: boolean;
  uploadingStudio?: boolean;
  studioImageUrls?: string[];
  onAddStudioImages?: () => void;
}

type CatalogRow = MirrorCatalogImageId[];

interface CatalogSection {
  key: string;
  title: string;
  data: CatalogRow[];
}

interface CatalogTileProps {
  imageId: MirrorCatalogImageId;
  size: number;
  selected: boolean;
  disabled: boolean;
  onToggle: (imageId: MirrorCatalogImageId) => void;
  primaryColor: string;
  radius: number;
}

const CatalogTile = React.memo(function CatalogTile({
  imageId,
  size,
  selected,
  disabled,
  onToggle,
  primaryColor,
  radius,
}: CatalogTileProps) {
  return (
    <Pressable
      collapsable={false}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor: '#000000',
        opacity: disabled ? 0.35 : 1,
      }}
      onPress={() => onToggle(imageId)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{selected, disabled}}
      accessibilityLabel={imageId}
    >
      <CatalogImageThumb
        imageId={imageId}
        width={size}
        height={size}
        borderRadius={radius}
        priority="low"
      />
      {selected ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: radius,
              borderWidth: 2,
              borderColor: primaryColor,
            },
          ]}
        />
      ) : null}
      {selected ? (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: primaryColor,
          }}
        >
          <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
});

function chunkRow<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

const SELECTED_PREVIEW_SIZE = 56;

interface SelectedPreviewThumbProps {
  item: OrderAttachedImage;
  radius: number;
  primaryColor: string;
}

const SelectedPreviewThumb = React.memo(function SelectedPreviewThumb({
  item,
  radius,
  primaryColor,
}: SelectedPreviewThumbProps) {
  return (
    <View
      style={{
        width: SELECTED_PREVIEW_SIZE,
        height: SELECTED_PREVIEW_SIZE,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor: '#000000',
        borderWidth: 2,
        borderColor: primaryColor,
      }}
    >
      {item.kind === 'catalog' ? (
        <CatalogImageThumb
          imageId={item.id}
          width={SELECTED_PREVIEW_SIZE}
          height={SELECTED_PREVIEW_SIZE}
          borderRadius={radius}
          priority="low"
        />
      ) : (
        <StudioImageThumb
          imageUrl={item.url}
          width={SELECTED_PREVIEW_SIZE}
          height={SELECTED_PREVIEW_SIZE}
          borderRadius={radius}
          priority="low"
        />
      )}
    </View>
  );
});

function resolveSectionTitle(key: string, t: (key: string, options?: {series?: string}) => string): string {
  if (key === 'menu') {
    return t('mirrorCatalogSectionMenu');
  }
  if (key === 'uploads') {
    return t('mirrorCatalogSectionUploads');
  }
  if (key === 'other') {
    return t('mirrorCatalogSectionOther');
  }
  return t('mirrorCatalogSection', {series: key.toUpperCase()});
}

const MirrorCatalogPickerSheet: React.FC<Props> = ({
  visible,
  selectedIds,
  onClose,
  onConfirm,
  selectionMode = 'multiple',
  disabledIds = [],
  title,
  subtitle,
  confirmLabel,
  enableStudioUpload = false,
  uploadingStudio = false,
  studioImageUrls = [],
  onAddStudioImages,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {inlineTextStyle} = useDirection();
  const {width} = useWindowDimensions();
  const catalogImageIds = useMirrorCatalogStore((state) => state.imageIds);
  const catalogSections = useMirrorCatalogStore((state) => state.sections);
  const [draftSelectedIds, setDraftSelectedIds] = useState<MirrorCatalogImageId[]>(selectedIds);

  React.useEffect(() => {
    if (visible) {
      setDraftSelectedIds(selectedIds);
    }
  }, [selectedIds, visible]);

  const columns = width >= 720 ? 4 : 3;
  const horizontalPadding = theme.spacing.md * 2 + 40;
  const tileGap = theme.spacing.xs;
  const tileSize = Math.floor((width - horizontalPadding - tileGap * (columns - 1)) / columns);
  const disabledSet = useMemo(() => new Set(disabledIds), [disabledIds]);
  const selectedLookup = useMemo(() => {
    const lookup: Record<string, true> = {};
    for (const imageId of draftSelectedIds) {
      lookup[imageId] = true;
    }
    return lookup;
  }, [draftSelectedIds]);
  const isSingleSelect = selectionMode === 'single';
  const studioUrls = useMemo(
    () => studioImageUrls.map((entry) => String(entry ?? '').trim()).filter(Boolean),
    [studioImageUrls],
  );
  const selectedPreviewItems = useMemo(
    () => buildOrderAttachedImages(draftSelectedIds, studioUrls),
    [draftSelectedIds, studioUrls],
  );
  const totalSelectedCount = draftSelectedIds.length + studioUrls.length;

  const sections = useMemo<CatalogSection[]>(
    () =>
      catalogSections.map((section) => ({
        key: section.key,
        title: resolveSectionTitle(section.key, t),
        data: chunkRow(section.imageIds, columns),
      })),
    [catalogSections, columns, t],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          minHeight: 280,
        },
        topChrome: {
          gap: theme.spacing.xs,
          paddingBottom: theme.spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.divider,
        },
        subtitle: {
          fontSize: theme.typographyScale.size.sm,
          lineHeight: 20,
        },
        sectionHeader: {
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.xs,
        },
        sectionTitle: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          opacity: 0.75,
        },
        row: {
          flexDirection: 'row',
          gap: tileGap,
          marginBottom: tileGap,
        },
        rowSpacer: {
          width: tileSize,
          height: 0,
        },
        listContent: {
          paddingBottom: theme.spacing.sm,
        },
        studioBlock: {
          gap: theme.spacing.xs,
        },
        selectedPreviewList: {
          flexDirection: 'row',
          gap: theme.spacing.xs,
          paddingBottom: theme.spacing.xs,
        },
        studioHint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
        },
        actions: {
          gap: theme.spacing.sm,
          paddingTop: theme.spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.divider,
        },
        actionRow: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
        },
        actionHalf: {
          flex: 1,
        },
      }),
    [theme, tileGap, tileSize],
  );

  const toggleImage = useCallback(
    (imageId: MirrorCatalogImageId) => {
      if (disabledSet.has(imageId)) {
        return;
      }
      setDraftSelectedIds((current) => {
        if (isSingleSelect) {
          return current[0] === imageId ? [] : [imageId];
        }
        return current.includes(imageId)
          ? current.filter((entry) => entry !== imageId)
          : [...current, imageId];
      });
    },
    [disabledSet, isSingleSelect],
  );

  const handleConfirm = () => {
    const nextSelectedIds = draftSelectedIds;
    onConfirm(nextSelectedIds);
    onClose();
  };

  const renderRow = useCallback(
    ({item: row}: {item: CatalogRow}) => (
      <View style={styles.row}>
        {row.map((imageId) => (
          <CatalogTile
            key={imageId}
            imageId={imageId}
            size={tileSize}
            selected={Boolean(selectedLookup[imageId])}
            disabled={disabledSet.has(imageId)}
            onToggle={toggleImage}
            primaryColor={theme.colors.primary}
            radius={theme.components.input.radius}
          />
        ))}
        {row.length < columns
          ? Array.from({length: columns - row.length}, (_, index) => (
              <View key={`spacer-${index}`} style={styles.rowSpacer} />
            ))
          : null}
      </View>
    ),
    [
      columns,
      disabledSet,
      selectedLookup,
      styles.row,
      styles.rowSpacer,
      theme.colors.primary,
      theme.components.input.radius,
      tileSize,
      toggleImage,
    ],
  );

  const renderSectionHeader = useCallback(
    ({section}: {section: CatalogSection}) => (
      <View style={[styles.sectionHeader, {backgroundColor: theme.colors.surface}]}>
        <Text style={[styles.sectionTitle, inlineTextStyle, {color: theme.typography.secondary}]}>
          {section.title}
        </Text>
      </View>
    ),
    [inlineTextStyle, styles.sectionHeader, styles.sectionTitle, theme.colors.surface, theme.typography.secondary],
  );

  const sheetTitle = title ?? t('mirrorCatalogPickerTitle');
  const sheetSubtitle =
    subtitle ??
    (isSingleSelect
      ? t('mirrorCatalogReplacePickerSubtitle')
      : t('mirrorCatalogPickerSubtitle', {count: totalSelectedCount}));

  if (!visible) {
    return null;
  }

  return (
    <BottomSheet
      visible={visible}
      title={sheetTitle}
      onClose={onClose}
      bodyScrollable={false}
      sheetStyle={{height: '85%', maxHeight: '85%'}}
    >
      <View style={styles.root}>
        <View style={styles.topChrome}>
          <Text style={[styles.subtitle, inlineTextStyle, {color: theme.typography.secondary}]}>
            {sheetSubtitle}
          </Text>

          {enableStudioUpload ? (
            <View style={styles.studioBlock}>
              <OrderStudioUploadTile
                size={tileSize}
                radius={theme.components.input.radius}
                disabled={uploadingStudio}
                loading={uploadingStudio}
                onPress={() => onAddStudioImages?.()}
              />
              <Text style={[styles.studioHint, inlineTextStyle, {color: theme.typography.secondary}]}>
                {t('orderStudioUploadPickerHint')}
              </Text>
            </View>
          ) : null}

          {selectedPreviewItems.length > 0 ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedPreviewList}
            >
              {selectedPreviewItems.map((item, index) => (
                <SelectedPreviewThumb
                  key={`${index}-${getOrderAttachedImageKey(item)}`}
                  item={item}
                  radius={theme.components.input.radius}
                  primaryColor={theme.colors.primary}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>

        <SectionList
          sections={sections}
          key={String(columns)}
          keyExtractor={(row, index) => `${row.join('-')}-${index}`}
          renderItem={renderRow}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator
          style={{flex: 1}}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={7}
          extraData={draftSelectedIds}
          contentContainerStyle={styles.listContent}
        />

        <View style={styles.actions}>
          {!isSingleSelect ? (
            <View style={styles.actionRow}>
              <AppButton
                label={t('mirrorCatalogPickerClear')}
                variant="outline"
                style={styles.actionHalf}
                onPress={() => setDraftSelectedIds([])}
                disabled={draftSelectedIds.length === 0}
              />
              <AppButton
                label={t('mirrorCatalogPickerSelectAll')}
                variant="outline"
                style={styles.actionHalf}
                onPress={() => setDraftSelectedIds([...catalogImageIds])}
              />
            </View>
          ) : null}
          <AppButton
            label={confirmLabel ?? t('mirrorCatalogPickerConfirm')}
            onPress={handleConfirm}
            disabled={isSingleSelect && draftSelectedIds.length !== 1}
          />
        </View>
      </View>
    </BottomSheet>
  );
};

export default MirrorCatalogPickerSheet;
