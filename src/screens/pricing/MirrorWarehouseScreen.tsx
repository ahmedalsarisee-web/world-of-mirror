import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import CatalogImagePreviewModal from '@app/components/common/CatalogImagePreviewModal';
import CatalogImageThumb from '@app/components/common/CatalogImageThumb';
import ScreenContainer from '@app/components/common/ScreenContainer';
import ScreenHeader from '@app/components/common/ScreenHeader';
import OrderStudioUploadTile from '@app/components/pricing/OrderStudioUploadTile';
import type {MirrorCatalogImageId} from '@app/types/mirrorCatalog';
import {useDirection} from '@app/hooks/useDirection';
import {useMirrorCatalogSync} from '@app/hooks/useMirrorCatalogSync';
import {useTheme} from '@app/context/ThemeContext';
import {
  deleteMirrorCatalogImage,
  getMirrorCatalogSaveErrorMessage,
  uploadMirrorCatalogImages,
} from '@app/services/mirrorCatalog.service';
import {adjustMirrorWarehouseCount, subscribeToMirrorWarehouseStock} from '@app/services/mirrorWarehouse.service';
import {useAuthStore} from '@app/stores/authStore';
import {useMirrorCatalogStore} from '@app/stores/mirrorCatalogStore';
import type {PricingStackParamList} from '@app/types/navigation';
import type {MirrorWarehouseStockCounts} from '@app/types/mirrorWarehouse';
import {pickMultipleImages} from '@app/utils/imagePicker';
import {getTabBarHeight} from '@app/utils/tabBarInsets';

type Nav = NativeStackNavigationProp<PricingStackParamList, 'MirrorWarehouse'>;

type CatalogRow = MirrorCatalogImageId[];

interface CatalogSection {
  key: string;
  title: string;
  data: CatalogRow[];
}

function chunkRow<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

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

interface CatalogTileProps {
  imageId: MirrorCatalogImageId;
  size: number;
  radius: number;
  stockCount: number;
  onPress: (imageId: MirrorCatalogImageId) => void;
  onLongPress: (imageId: MirrorCatalogImageId, stockCount: number) => void;
}

const CatalogTile = React.memo(function CatalogTile({
  imageId,
  size,
  radius,
  stockCount,
  onPress,
  onLongPress,
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
      }}
      onPress={() => onPress(imageId)}
      onLongPress={() => onLongPress(imageId, stockCount)}
      accessibilityRole="button"
      accessibilityLabel={imageId}
    >
      <CatalogImageThumb
        imageId={imageId}
        width={size}
        height={size}
        borderRadius={radius}
        priority="low"
      />
      {stockCount > 0 ? (
        <View style={tileStyles.stockBadge}>
          <Text style={tileStyles.stockBadgeText}>{stockCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const MirrorWarehouseScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {chevronBack, inlineTextStyle, textStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  useMirrorCatalogSync(Boolean(user?.id));
  const {width} = useWindowDimensions();
  const imageIds = useMirrorCatalogStore((state) => state.imageIds);
  const catalogSections = useMirrorCatalogStore((state) => state.sections);
  const isCatalogLoading = useMirrorCatalogStore((state) => state.isLoading);
  const isCatalogHydrated = useMirrorCatalogStore((state) => state.isHydrated);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [stockCounts, setStockCounts] = useState<MirrorWarehouseStockCounts>({});
  const [uploading, setUploading] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);

  const columns = width >= 720 ? 4 : 3;
  const horizontalPadding = theme.spacing.md;
  const tileGap = theme.spacing.xs;
  const tileSize = Math.floor(
    (width - horizontalPadding * 2 - tileGap * (columns - 1)) / columns,
  );

  React.useEffect(() => {
    if (!user?.id) {
      setStockCounts({});
      return undefined;
    }
    return subscribeToMirrorWarehouseStock(setStockCounts);
  }, [user?.id]);

  const previewIndexByImageId = useMemo(() => {
    const map = new Map<MirrorCatalogImageId, number>();
    imageIds.forEach((imageId, index) => {
      map.set(imageId, index);
    });
    return map;
  }, [imageIds]);

  const sections = useMemo<CatalogSection[]>(
    () =>
      catalogSections.map((section) => ({
        key: section.key,
        title: resolveSectionTitle(section.key, t),
        data: chunkRow(section.imageIds, columns),
      })),
    [catalogSections, columns, t],
  );

  const stockedSummary = useMemo(() => {
    const stocked = Object.keys(stockCounts).length;
    const total = Object.values(stockCounts).reduce((sum, count) => sum + count, 0);
    return {stocked, total};
  }, [stockCounts]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          flex: 1,
          paddingHorizontal: horizontalPadding,
        },
        summaryRow: {
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.xs,
          gap: theme.spacing.xs,
        },
        summaryText: {
          fontSize: theme.typographyScale.size.sm,
          opacity: 0.85,
        },
        hintText: {
          fontSize: theme.typographyScale.size.xs,
          opacity: 0.65,
        },
        uploadRow: {
          paddingBottom: theme.spacing.sm,
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
          paddingTop: theme.spacing.sm,
          paddingBottom: getTabBarHeight(insets) + theme.spacing.lg,
        },
        emptyState: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        emptyTitle: {
          fontSize: theme.typographyScale.size.md,
          fontWeight: '700',
          textAlign: 'center',
        },
        emptySubtitle: {
          fontSize: theme.typographyScale.size.sm,
          textAlign: 'center',
          opacity: 0.75,
          lineHeight: 22,
        },
        loadingState: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [horizontalPadding, insets, theme, tileGap, tileSize],
  );

  const openPreview = useCallback(
    (imageId: MirrorCatalogImageId) => {
      const index = previewIndexByImageId.get(imageId);
      if (index !== undefined) {
        setPreviewIndex(index);
      }
    },
    [previewIndexByImageId],
  );

  const openStockAdjust = useCallback(
    (imageId: MirrorCatalogImageId, stockCount: number) => {
      Alert.alert(
        t('mirrorWarehouseAdjustTitle'),
        t('mirrorWarehouseAdjustMessage', {count: stockCount}),
        [
          {text: t('cancel'), style: 'cancel'},
          {
            text: t('mirrorWarehouseDecrease'),
            onPress: () => {
              void adjustMirrorWarehouseCount(imageId, -1).catch(() => undefined);
            },
          },
          {
            text: t('mirrorWarehouseIncrease'),
            onPress: () => {
              void adjustMirrorWarehouseCount(imageId, 1).catch(() => undefined);
            },
          },
        ],
      );
    },
    [t],
  );

  const handleUpload = useCallback(async () => {
    if (!user?.id || uploading) {
      return;
    }

    const picked = await pickMultipleImages();
    if (!picked.length) {
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadMirrorCatalogImages(picked);
      if (uploaded.length > 0) {
        Alert.alert(
          t('mirrorWarehouseUploadSuccessTitle'),
          t('mirrorWarehouseUploadSuccessMessage', {count: uploaded.length}),
        );
      }
    } catch (error) {
      Alert.alert(t('error'), getMirrorCatalogSaveErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }, [t, uploading, user?.id]);

  const handleDeleteImage = useCallback(
    (imageId: MirrorCatalogImageId) => {
      Alert.alert(t('mirrorWarehouseDeleteTitle'), t('mirrorWarehouseDeleteMessage'), [
        {text: t('cancel'), style: 'cancel'},
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => {
            setDeletingImage(true);
            void deleteMirrorCatalogImage(imageId)
              .then(() => {
                if (imageIds.length <= 1) {
                  setPreviewIndex(null);
                }
              })
              .catch((error) => {
                Alert.alert(t('error'), getMirrorCatalogSaveErrorMessage(error));
              })
              .finally(() => {
                setDeletingImage(false);
              });
          },
        },
      ]);
    },
    [imageIds.length, t],
  );

  const renderRow = useCallback(
    ({item: row}: {item: CatalogRow}) => (
      <View style={styles.row}>
        {row.map((imageId) => (
          <CatalogTile
            key={imageId}
            imageId={imageId}
            size={tileSize}
            radius={theme.components.input.radius}
            stockCount={stockCounts[imageId] ?? 0}
            onPress={openPreview}
            onLongPress={openStockAdjust}
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
      openPreview,
      openStockAdjust,
      stockCounts,
      styles.row,
      styles.rowSpacer,
      theme.components.input.radius,
      tileSize,
    ],
  );

  const renderSectionHeader = useCallback(
    ({section}: {section: CatalogSection}) => (
      <View style={[styles.sectionHeader, {backgroundColor: theme.colors.background}]}>
        <Text style={[styles.sectionTitle, inlineTextStyle, {color: theme.typography.secondary}]}>
          {section.title}
        </Text>
      </View>
    ),
    [
      inlineTextStyle,
      styles.sectionHeader,
      styles.sectionTitle,
      theme.colors.background,
      theme.typography.secondary,
    ],
  );

  const listHeader = (
    <View>
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryText, textStyle, {color: theme.typography.primary}]}>
          {t('mirrorWarehouseSummary', {count: imageIds.length})}
        </Text>
        {stockedSummary.stocked > 0 ? (
          <Text style={[styles.summaryText, textStyle, {color: theme.typography.secondary}]}>
            {t('mirrorWarehouseStockSummary', stockedSummary)}
          </Text>
        ) : null}
        <Text style={[styles.hintText, textStyle, {color: theme.typography.secondary}]}>
          {t('mirrorWarehouseAdjustHint')}
        </Text>
      </View>

      <View style={styles.uploadRow}>
        <OrderStudioUploadTile
          size={Math.min(tileSize * 2 + tileGap, 180)}
          radius={theme.components.input.radius}
          disabled={!user?.id}
          loading={uploading}
          label={t('mirrorWarehouseUploadTileLabel')}
          onPress={() => {
            void handleUpload();
          }}
        />
        <Text style={[styles.hintText, textStyle, {color: theme.typography.secondary, marginTop: theme.spacing.xs}]}>
          {t('mirrorWarehouseUploadHint')}
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer scroll={false} style={{padding: 0}} contentStyle={{flex: 1, padding: 0}}>
      <ScreenHeader
        title={t('mirrorWarehouseTitle')}
        startAction={
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            style={({pressed}) => [{opacity: pressed ? 0.65 : 1}]}
          >
            <MaterialCommunityIcons name={chevronBack} size={24} color={theme.typography.primary} />
          </Pressable>
        }
      />

      <View style={styles.body}>
        {isCatalogLoading && !isCatalogHydrated ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : imageIds.length === 0 ? (
          <View style={styles.emptyState}>
            {listHeader}
            <Text style={[styles.emptyTitle, textStyle, {color: theme.typography.primary}]}>
              {t('mirrorWarehouseEmptyTitle')}
            </Text>
            <Text style={[styles.emptySubtitle, textStyle, {color: theme.typography.secondary}]}>
              {t('mirrorWarehouseEmptySubtitle')}
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            key={String(columns)}
            keyExtractor={(row, index) => `${row.join('-')}-${index}`}
            renderItem={renderRow}
            renderSectionHeader={renderSectionHeader}
            ListHeaderComponent={listHeader}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator
            style={{flex: 1}}
            removeClippedSubviews
            initialNumToRender={4}
            maxToRenderPerBatch={3}
            windowSize={5}
            updateCellsBatchingPeriod={50}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      <CatalogImagePreviewModal
        visible={previewIndex !== null}
        imageIds={imageIds}
        initialIndex={previewIndex ?? 0}
        onClose={() => setPreviewIndex(null)}
        onDelete={handleDeleteImage}
        deleting={deletingImage}
      />
    </ScreenContainer>
  );
};

const tileStyles = StyleSheet.create({
  stockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  stockBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default MirrorWarehouseScreen;
