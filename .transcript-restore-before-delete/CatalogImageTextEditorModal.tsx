import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDirection} from '@app/hooks/useDirection';
import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import type {PickedImage} from '@app/utils/imagePicker';
import {
  CATALOG_IMAGE_COORDINATE_LAYER_STYLE,
  CATALOG_IMAGE_TEXT_COLORS,
  cloneCatalogImageTextLayers,
  createCatalogTextLayerId,
  estimateCatalogTextHandleWidth,
  getCatalogImageLayout,
  isCatalogTextRtl,
  isEmptyCatalogImageTextAnnotation,
  localPointToNormalized,
  type CatalogImageLayout,
  type CatalogImageTextAnnotation,
  type CatalogImageTextLayer,
} from '@app/utils/catalogImageTextEditor';

interface Props {
  visible: boolean;
  imageId: MirrorCatalogImageId;
  image: PickedImage | null;
  initialAnnotation?: CatalogImageTextAnnotation;
  onClose: () => void;
  onComplete: (annotation: CatalogImageTextAnnotation) => void | Promise<void>;
}

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 72;
const DEFAULT_FONT_SIZE = 28;

interface DraggableTextProps {
  layer: CatalogImageTextLayer;
  layout: CatalogImageLayout;
  selected: boolean;
  language: 'ar' | 'en';
  fontFamily: string | undefined;
  onSelect: () => void;
  onChange: (layer: CatalogImageTextLayer) => void;
}

const DraggableTextHandle: React.FC<DraggableTextProps> = ({
  layer,
  layout,
  selected,
  language,
  fontFamily,
  onSelect,
  onChange,
}) => {
  const dragStartRef = useRef({nx: layer.nx, ny: layer.ny});
  const layerRef = useRef(layer);
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);
  const displaySize = layer.fontSize * layout.scale;

  layerRef.current = layer;
  onChangeRef.current = onChange;
  onSelectRef.current = onSelect;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRef.current = {nx: layerRef.current.nx, ny: layerRef.current.ny};
          onSelectRef.current();
        },
        onPanResponderMove: (_, gestureState) => {
          const start = dragStartRef.current;
          const current = layerRef.current;
          onChangeRef.current({
            ...current,
            nx: Math.min(1, Math.max(0, start.nx + gestureState.dx / layout.displayWidth)),
            ny: Math.min(1, Math.max(0, start.ny + gestureState.dy / layout.displayHeight)),
          });
        },
      }),
    [layout.displayHeight, layout.displayWidth],
  );

  const layerRtl = isCatalogTextRtl(layer.text, language);
  const left = layer.nx * layout.displayWidth;
  const top = layer.ny * layout.displayHeight;
  const handleWidth = estimateCatalogTextHandleWidth(layer.text, displaySize, language);

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.textHandle,
        CATALOG_IMAGE_COORDINATE_LAYER_STYLE,
        {
          left,
          top,
          minWidth: handleWidth,
          minHeight: displaySize + 12,
          borderColor: selected ? '#34C759' : 'transparent',
        },
      ]}
    >
      <Pressable onPress={onSelect} accessibilityRole="button">
        <Text
          style={[
            styles.textLabel,
            {
              color: layer.color,
              fontSize: displaySize,
              fontFamily,
              writingDirection: layerRtl ? 'rtl' : 'ltr',
              textAlign: layerRtl ? 'right' : 'left',
              backgroundColor: layer.withBackground ? 'rgba(0,0,0,0.55)' : 'transparent',
            },
          ]}
        >
          {layer.text}
        </Text>
      </Pressable>
    </View>
  );
};

const CatalogImageTextEditorModal: React.FC<Props> = ({
  visible,
  imageId: _imageId,
  image,
  initialAnnotation,
  onClose,
  onComplete,
}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const {inputTextStyle, appFont, language} = useDirection();
  const fontFamily = appFont('bold').fontFamily;

  const [naturalSize, setNaturalSize] = useState<{width: number; height: number} | null>(null);
  const [color, setColor] = useState<string>(CATALOG_IMAGE_TEXT_COLORS[0]);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [textLayers, setTextLayers] = useState<CatalogImageTextLayer[]>([]);
  const [history, setHistory] = useState<CatalogImageTextLayer[][]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [pendingTextPoint, setPendingTextPoint] = useState<{nx: number; ny: number} | null>(null);
  const [saving, setSaving] = useState(false);

  const canvasHeight = screenHeight - insets.top - insets.bottom - 250;

  const layout = useMemo(() => {
    if (!naturalSize) {
      return null;
    }
    return getCatalogImageLayout(screenWidth, canvasHeight, naturalSize.width, naturalSize.height);
  }, [canvasHeight, naturalSize, screenWidth]);

  const selectedLayer = useMemo(
    () => textLayers.find((entry) => entry.id === selectedTextId) ?? null,
    [selectedTextId, textLayers],
  );

  const pushHistory = useCallback(() => {
    setHistory((current) => [...current.slice(-30), cloneCatalogImageTextLayers(textLayers)]);
  }, [textLayers]);

  useEffect(() => {
    if (!visible || !image) {
      return;
    }
    const layers = initialAnnotation?.textLayers ?? [];
    setTextLayers(layers);
    setColor(layers[0]?.color ?? CATALOG_IMAGE_TEXT_COLORS[0]);
    setFontSize(layers[0]?.fontSize ?? DEFAULT_FONT_SIZE);
    setHistory([]);
    setSelectedTextId(null);
    setDraftText('');
    setPendingTextPoint(null);
    setNaturalSize(null);
    Image.getSize(
      image.uri,
      (width, height) => setNaturalSize({width, height}),
      () => setNaturalSize({width: screenWidth, height: screenWidth}),
    );
  }, [visible, image, initialAnnotation, screenWidth]);

  useEffect(() => {
    if (!selectedTextId) {
      return;
    }
    setTextLayers((current) =>
      current.map((entry) =>
        entry.id === selectedTextId ? {...entry, color, fontSize} : entry,
      ),
    );
  }, [color, fontSize, selectedTextId]);

  const handleSelectLayer = useCallback((layer: CatalogImageTextLayer) => {
    setSelectedTextId(layer.id);
    setColor(layer.color);
    setFontSize(layer.fontSize);
    setPendingTextPoint(null);
    setDraftText('');
  }, []);

  const commitTextLayer = useCallback(() => {
    if (!pendingTextPoint || !draftText.trim()) {
      setPendingTextPoint(null);
      setDraftText('');
      return;
    }

    pushHistory();
    const layer: CatalogImageTextLayer = {
      id: createCatalogTextLayerId(),
      text: draftText.trim(),
      nx: pendingTextPoint.nx,
      ny: pendingTextPoint.ny,
      color,
      fontSize,
      withBackground: true,
    };
    setTextLayers((current) => [...current, layer]);
    setSelectedTextId(layer.id);
    setPendingTextPoint(null);
    setDraftText('');
  }, [color, draftText, fontSize, pendingTextPoint, pushHistory]);

  const handleUndo = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous) {
      return;
    }
    setTextLayers(previous);
    setHistory((current) => current.slice(0, -1));
    setSelectedTextId(null);
  }, [history]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedTextId) {
      return;
    }
    pushHistory();
    setTextLayers((current) => current.filter((entry) => entry.id !== selectedTextId));
    setSelectedTextId(null);
  }, [pushHistory, selectedTextId]);

  const buildSnapshot = useCallback((): CatalogImageTextAnnotation => {
    let layers = [...textLayers];
    if (pendingTextPoint && draftText.trim()) {
      layers = [
        ...layers,
        {
          id: createCatalogTextLayerId(),
          text: draftText.trim(),
          nx: pendingTextPoint.nx,
          ny: pendingTextPoint.ny,
          color,
          fontSize,
          withBackground: true,
        },
      ];
    }
    return {textLayers: layers};
  }, [color, draftText, fontSize, pendingTextPoint, textLayers]);

  const handleSave = useCallback(async () => {
    if (!image || !naturalSize || !layout) {
      return;
    }

    const snapshot = buildSnapshot();
    if (isEmptyCatalogImageTextAnnotation(snapshot)) {
      Alert.alert(t('error'), t('imageEditorNothingToSave'));
      return;
    }

    setSaving(true);
    try {
      await Promise.resolve(onComplete(snapshot));
    } catch (error) {
      console.error('[CatalogImageTextEditorModal]', error);
      Alert.alert(t('error'), t('mirrorCatalogAnnotationSaveFailed'));
    } finally {
      setSaving(false);
    }
  }, [buildSnapshot, image, layout, naturalSize, onComplete, t]);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const canvasPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => Boolean(layoutRef.current),
      onPanResponderGrant: (event) => {
        const currentLayout = layoutRef.current;
        if (!currentLayout) {
          return;
        }
        const point = localPointToNormalized(
          event.nativeEvent.locationX,
          event.nativeEvent.locationY,
          currentLayout.displayWidth,
          currentLayout.displayHeight,
        );
        if (!point) {
          return;
        }
        setSelectedTextId(null);
        setPendingTextPoint(point);
        setDraftText('');
      },
    });
  }, []);

  if (!image) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.root, {paddingTop: insets.top, paddingBottom: insets.bottom}]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={handleUndo}
            disabled={history.length === 0}
            style={styles.topButton}
            accessibilityRole="button"
            accessibilityLabel={t('imageEditorUndo')}
          >
            <MaterialCommunityIcons
              name="undo"
              size={22}
              color={history.length > 0 ? '#FFFFFF' : 'rgba(255,255,255,0.35)'}
            />
            <Text style={[styles.topButtonText, history.length === 0 ? styles.topButtonDisabled : null]}>
              {t('imageEditorUndo')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void handleSave()}
            disabled={saving || !naturalSize}
            style={styles.topButton}
            accessibilityRole="button"
            accessibilityLabel={t('imageEditorDone')}
          >
            {saving ? (
              <ActivityIndicator color="#34C759" size="small" />
            ) : (
              <>
                <Text style={styles.doneText}>{t('imageEditorDone')}</Text>
                <MaterialCommunityIcons name="check" size={22} color="#34C759" />
              </>
            )}
          </Pressable>
        </View>

        <View style={[styles.canvasArea, {height: canvasHeight}]}>
          {!naturalSize || !layout ? (
            <ActivityIndicator color="#FFFFFF" size="large" />
          ) : (
            <View style={[styles.canvasStack, CATALOG_IMAGE_COORDINATE_LAYER_STYLE]}>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: layout.offsetX,
                  top: layout.offsetY,
                  width: layout.displayWidth,
                  height: layout.displayHeight,
                }}
              >
                <Image source={{uri: image.uri}} style={StyleSheet.absoluteFill} resizeMode="contain" />
              </View>
              <View
                pointerEvents="box-none"
                style={[
                  styles.interactionLayer,
                  CATALOG_IMAGE_COORDINATE_LAYER_STYLE,
                  {
                    left: layout.offsetX,
                    top: layout.offsetY,
                    width: layout.displayWidth,
                    height: layout.displayHeight,
                  },
                ]}
              >
                <View style={StyleSheet.absoluteFill} {...canvasPanResponder.panHandlers} />
                {textLayers.map((layer) => (
                  <DraggableTextHandle
                    key={layer.id}
                    layer={layer}
                    layout={layout}
                    selected={selectedTextId === layer.id}
                    language={language}
                    fontFamily={fontFamily}
                    onSelect={() => handleSelectLayer(layer)}
                    onChange={(next) => {
                      setTextLayers((current) =>
                        current.map((entry) => (entry.id === next.id ? next : entry)),
                      );
                    }}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {pendingTextPoint ? (
          <View style={styles.textComposer}>
            <TextInput
              value={draftText}
              onChangeText={setDraftText}
              placeholder={t('imageTextPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={[
                styles.textComposerInput,
                inputTextStyle,
                {
                  fontFamily,
                  color,
                  fontSize: Math.min(22, fontSize * 0.75),
                },
              ]}
              multiline
              autoFocus
            />
            <View style={styles.textComposerActions}>
              <Pressable
                onPress={() => {
                  setPendingTextPoint(null);
                  setDraftText('');
                }}
                style={styles.textComposerBtn}
              >
                <Text style={styles.textComposerCancel}>{t('cancel')}</Text>
              </Pressable>
              <Pressable onPress={commitTextLayer} style={styles.textComposerBtn}>
                <Text style={styles.textComposerConfirm}>{t('imageEditorAddText')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.toolbar}>
          <Text style={styles.toolbarHint}>{t('imageEditorTapToAddText')}</Text>

          <View style={styles.colorsRow}>
            {CATALOG_IMAGE_TEXT_COLORS.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.colorDot,
                  {backgroundColor: option},
                  color === option ? styles.colorDotActive : null,
                ]}
                onPress={() => setColor(option)}
                accessibilityRole="button"
              />
            ))}
          </View>

          <View style={styles.fontSizeRow}>
            <MaterialCommunityIcons name="format-size" size={18} color="rgba(255,255,255,0.75)" />
            <Text style={styles.fontSizeLabel}>{t('imageEditorFontSize')}</Text>
            <Slider
              style={styles.fontSizeSlider}
              minimumValue={MIN_FONT_SIZE}
              maximumValue={MAX_FONT_SIZE}
              step={1}
              value={fontSize}
              onValueChange={(value) => setFontSize(Math.round(value))}
              minimumTrackTintColor="#34C759"
              maximumTrackTintColor="rgba(255,255,255,0.25)"
              thumbTintColor="#FFFFFF"
            />
            <Text style={styles.fontSizeValue}>{Math.round(fontSize)}</Text>
          </View>

          {selectedLayer ? (
            <View style={styles.selectedRow}>
              <Text style={styles.selectedHint} numberOfLines={1}>
                {t('imageEditorSelectedText')}: {selectedLayer.text}
              </Text>
              <Pressable
                onPress={handleDeleteSelected}
                style={styles.deleteButton}
                accessibilityRole="button"
                accessibilityLabel={t('imageEditorDeleteText')}
              >
                <MaterialCommunityIcons name="delete-outline" size={20} color="#FF3B30" />
                <Text style={styles.deleteLabel}>{t('imageEditorDeleteText')}</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
            <Text style={styles.closeLabel}>{t('cancel')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000000'},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topButton: {flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8},
  topButtonText: {color: '#FFFFFF', fontSize: 15, fontWeight: '600'},
  topButtonDisabled: {color: 'rgba(255,255,255,0.35)'},
  doneText: {color: '#34C759', fontSize: 16, fontWeight: '700'},
  canvasArea: {width: '100%', backgroundColor: '#000000'},
  canvasStack: {flex: 1, position: 'relative'},
  interactionLayer: {position: 'absolute'},
  textHandle: {position: 'absolute', borderWidth: 1, borderRadius: 6, padding: 2},
  textLabel: {
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  textComposer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  textComposerInput: {
    minHeight: 44,
    maxHeight: 100,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textComposerActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 16},
  textComposerBtn: {paddingVertical: 6, paddingHorizontal: 4},
  textComposerCancel: {color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '600'},
  textComposerConfirm: {color: '#34C759', fontSize: 15, fontWeight: '700'},
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  toolbarHint: {color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center'},
  colorsRow: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10},
  colorDot: {width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent'},
  colorDotActive: {borderColor: '#34C759'},
  fontSizeRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  fontSizeLabel: {color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', minWidth: 56},
  fontSizeSlider: {flex: 1, height: 36},
  fontSizeValue: {color: '#FFFFFF', fontSize: 14, fontWeight: '700', minWidth: 28, textAlign: 'right'},
  selectedRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  selectedHint: {flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 12},
  deleteButton: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6},
  deleteLabel: {color: '#FF3B30', fontSize: 13, fontWeight: '600'},
  closeButton: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6},
  closeLabel: {color: '#FFFFFF', fontSize: 14, fontWeight: '600'},
});

export default CatalogImageTextEditorModal;
