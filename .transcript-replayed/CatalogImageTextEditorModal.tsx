import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Keyboard,
  Modal,
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
import {Image} from 'expo-image';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDirection} from '@app/hooks/useDirection';
import CatalogDraggableTextAnchor from '@app/components/common/catalogImageText/CatalogDraggableTextAnchor';
import CatalogImageTextBubble from '@app/components/common/catalogImageText/CatalogImageTextBubble';
import CatalogImageTextOverlay from '@app/components/common/catalogImageText/CatalogImageTextOverlay';
import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import type {PickedImage} from '@app/utils/imagePicker';
import {
  CATALOG_IMAGE_COORDINATE_LAYER_STYLE,
  CATALOG_IMAGE_TEXT_ALIGN_OPTIONS,
  CATALOG_IMAGE_TEXT_COLORS,
  CATALOG_TEXT_BACKGROUND_COLOR,
  cloneCatalogImageTextLayers,
  createCatalogTextLayerId,
  normalizeCatalogTextAlign,
  getCatalogImageLayout,
  getCatalogTextBubbleMetrics,
  getCatalogTextDisplaySize,
  getCatalogTextShadowStyle,
  isCatalogImageLayoutReady,
  isCatalogTextRtl,
  isEmptyCatalogImageTextAnnotation,
  type CatalogImageLayout,
  type CatalogImageTextAlign,
  type CatalogImageTextAnnotation,
  type CatalogImageTextLayer,
} from '@app/utils/catalogImageTextEditor';

interface Props {
  visible: boolean;
  imageId: MirrorCatalogImageId;
  image: PickedImage | null;
  initialAnnotation?: CatalogImageTextAnnotation;
  showEntryMenu?: boolean;
  onClose: () => void;
  onComplete: (annotation: CatalogImageTextAnnotation) => void | Promise<void>;
}

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 72;
const DEFAULT_FONT_SIZE = 28;
const DEFAULT_TEXT_ALIGN: CatalogImageTextAlign = 'left';
const DEFAULT_COMPOSE_POINT = {nx: 0.5, ny: 0.5};
const CURSOR_BLINK_MS = 530;

const ComposeTextCursor: React.FC<{color: string; height: number}> = ({color, height}) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.15, {duration: CURSOR_BLINK_MS}),
        withTiming(1, {duration: CURSOR_BLINK_MS}),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: Math.max(2, Math.round(height * 0.08)),
          height,
          marginHorizontal: 1,
          borderRadius: 1,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
};

const TEXT_ALIGN_ICONS: Record<CatalogImageTextAlign, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  left: 'format-align-left',
  center: 'format-align-center',
  right: 'format-align-right',
};

interface TextAlignPickerProps {
  value: CatalogImageTextAlign;
  onChange: (value: CatalogImageTextAlign) => void;
  label: string;
}

const TextAlignPicker: React.FC<TextAlignPickerProps> = ({value, onChange, label}) => (
  <View style={styles.alignRow}>
    <MaterialCommunityIcons name="format-align-middle" size={18} color="rgba(255,255,255,0.75)" />
    <Text style={styles.alignLabel}>{label}</Text>
    <View style={styles.alignOptions}>
      {CATALOG_IMAGE_TEXT_ALIGN_OPTIONS.map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={[styles.alignButton, value === option ? styles.alignButtonActive : null]}
          accessibilityRole="button"
          accessibilityState={{selected: value === option}}
        >
          <MaterialCommunityIcons
            name={TEXT_ALIGN_ICONS[option]}
            size={20}
            color={value === option ? '#34C759' : '#FFFFFF'}
          />
        </Pressable>
      ))}
    </View>
  </View>
);

interface TextFormattingControlsProps {
  color: string;
  onColorChange: (value: string) => void;
  fontSize: number;
  onFontSizeChange: (value: number) => void;
  textAlign: CatalogImageTextAlign;
  onTextAlignChange: (value: CatalogImageTextAlign) => void;
  fontSizeLabel: string;
  alignLabel: string;
}

const TextFormattingControls: React.FC<TextFormattingControlsProps> = ({
  color,
  onColorChange,
  fontSize,
  onFontSizeChange,
  textAlign,
  onTextAlignChange,
  fontSizeLabel,
  alignLabel,
}) => (
  <>
    <View style={styles.colorsRow}>
      {CATALOG_IMAGE_TEXT_COLORS.map((option) => (
        <Pressable
          key={option}
          style={[
            styles.colorDot,
            {backgroundColor: option},
            color === option ? styles.colorDotActive : null,
          ]}
          onPress={() => onColorChange(option)}
          accessibilityRole="button"
        />
      ))}
    </View>

    <View style={styles.fontSizeRow}>
      <MaterialCommunityIcons name="format-size" size={18} color="rgba(255,255,255,0.75)" />
      <Text style={styles.fontSizeLabel}>{fontSizeLabel}</Text>
      <Slider
        style={styles.fontSizeSlider}
        minimumValue={MIN_FONT_SIZE}
        maximumValue={MAX_FONT_SIZE}
        step={1}
        value={fontSize}
        onValueChange={(value) => onFontSizeChange(Math.round(value))}
        minimumTrackTintColor="#34C759"
        maximumTrackTintColor="rgba(255,255,255,0.25)"
        thumbTintColor="#FFFFFF"
      />
      <Text style={styles.fontSizeValue}>{Math.round(fontSize)}</Text>
    </View>

    <TextAlignPicker value={textAlign} onChange={onTextAlignChange} label={alignLabel} />
  </>
);

interface ComposeTextPreviewProps {
  text: string;
  nx: number;
  ny: number;
  color: string;
  fontSize: number;
  textAlign: CatalogImageTextAlign;
  layout: CatalogImageLayout;
  language: 'ar' | 'en';
  fontFamily: string | undefined;
  onMove: (nx: number, ny: number) => void;
  onPress?: () => void;
}

const DraggableComposePreview: React.FC<ComposeTextPreviewProps> = ({
  text,
  nx,
  ny,
  color,
  fontSize,
  textAlign,
  layout,
  language,
  fontFamily,
  onMove,
  onPress,
}) => {
  if (!isCatalogImageLayoutReady(layout)) {
    return null;
  }

  const displaySize = getCatalogTextDisplaySize(fontSize, layout.scale);
  const bubbleMetrics = getCatalogTextBubbleMetrics(layout.scale);
  const trimmedText = text.trim();
  const layerRtl = isCatalogTextRtl(trimmedText || ' ', language);
  const cursorHeight = Math.max(18, Math.round(displaySize * 1.05));

  return (
    <CatalogDraggableTextAnchor
      nx={nx}
      ny={ny}
      layout={layout}
      anchorAlign={textAlign}
      onMove={(nextNx, nextNy) => onMove(nextNx, nextNy)}
      onPress={onPress}
    >
      <View
        style={[
          styles.composeIconBubble,
          {
            paddingHorizontal: bubbleMetrics.paddingHorizontal,
            paddingVertical: bubbleMetrics.paddingVertical,
            borderRadius: bubbleMetrics.borderRadius,
            minHeight: cursorHeight + bubbleMetrics.paddingVertical * 2,
          },
        ]}
      >
        <View
          style={[
            styles.composeTextRow,
            {flexDirection: layerRtl ? 'row-reverse' : 'row'},
          ]}
        >
          {trimmedText ? (
            <Text
              style={{
                color,
                fontSize: displaySize,
                fontFamily,
                writingDirection: layerRtl ? 'rtl' : 'ltr',
                textAlign,
                fontWeight: '700',
                ...getCatalogTextShadowStyle(displaySize),
              }}
            >
              {trimmedText}
            </Text>
          ) : null}
          <ComposeTextCursor color={color} height={cursorHeight} />
        </View>
      </View>
    </CatalogDraggableTextAnchor>
  );
};

interface DraggableTextProps {
  layer: CatalogImageTextLayer;
  layout: CatalogImageLayout;
  selected: boolean;
  language: 'ar' | 'en';
  fontFamily: string | undefined;
  onSelect: () => void;
  onEdit: () => void;
  onChange: (layer: CatalogImageTextLayer) => void;
}

const DraggableTextHandle: React.FC<DraggableTextProps> = ({
  layer,
  layout,
  selected,
  language,
  fontFamily,
  onSelect,
  onEdit,
  onChange,
}) => {
  if (!isCatalogImageLayoutReady(layout)) {
    return null;
  }

  return (
    <CatalogDraggableTextAnchor
      nx={layer.nx}
      ny={layer.ny}
      layout={layout}
      anchorAlign={normalizeCatalogTextAlign(layer.textAlign)}
      onMove={(nextNx, nextNy) => onChange({...layer, nx: nextNx, ny: nextNy})}
      onPress={onSelect}
      onDoublePress={onEdit}
    >
      <CatalogImageTextBubble
        layer={layer}
        layout={layout}
        language={language}
        fontFamily={fontFamily}
        borderColor={selected ? '#34C759' : undefined}
        inline
      />
    </CatalogDraggableTextAnchor>
  );
};

const CatalogImageTextEditorModal: React.FC<Props> = ({
  visible,
  image,
  initialAnnotation,
  showEntryMenu = true,
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
  const [textAlign, setTextAlign] = useState<CatalogImageTextAlign>(DEFAULT_TEXT_ALIGN);
  const [textLayers, setTextLayers] = useState<CatalogImageTextLayer[]>([]);
  const [history, setHistory] = useState<CatalogImageTextLayer[][]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [pendingTextPoint, setPendingTextPoint] = useState<{nx: number; ny: number} | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{width: number; height: number} | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [bottomDockHeight, setBottomDockHeight] = useState(0);
  const [textEditingActive, setTextEditingActive] = useState(true);
  const [composerFocusTick, setComposerFocusTick] = useState(0);
  const [lockedModalHeight, setLockedModalHeight] = useState<number | null>(null);
  const composerInputRef = useRef<TextInput>(null);
  const keyboardInsetRef = useRef(0);
  keyboardInsetRef.current = keyboardInset;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setLockedModalHeight(null);
      return;
    }
    setLockedModalHeight((current) => (current === null ? screenHeight : current));
  }, [screenHeight, visible]);

  const layout = useMemo(() => {
    if (!naturalSize || !canvasSize || canvasSize.width <= 0 || canvasSize.height <= 0) {
      return null;
    }
    const nextLayout = getCatalogImageLayout(
      canvasSize.width,
      canvasSize.height,
      naturalSize.width,
      naturalSize.height,
    );
    return isCatalogImageLayoutReady(nextLayout) ? nextLayout : null;
  }, [canvasSize, naturalSize]);

  const focusComposerInput = useCallback(() => {
    setComposerFocusTick((value) => value + 1);
  }, []);

  const pushHistory = useCallback(() => {
    setHistory((current) => [...current.slice(-30), cloneCatalogImageTextLayers(textLayers)]);
  }, [textLayers]);

  useEffect(() => {
    if (!visible || !image) {
      return;
    }
    const layers = (initialAnnotation?.textLayers ?? []).map((layer) => ({
      ...layer,
      textAlign: normalizeCatalogTextAlign(layer.textAlign),
    }));
    setTextLayers(layers);
    setColor(layers[0]?.color ?? CATALOG_IMAGE_TEXT_COLORS[0]);
    setFontSize(layers[0]?.fontSize ?? DEFAULT_FONT_SIZE);
    setTextAlign(layers[0]?.textAlign ?? DEFAULT_TEXT_ALIGN);
    setHistory([]);
    setDraftText('');
    setPendingTextPoint(null);
    setEditingLayerId(null);
    setTextEditingActive(true);
    setComposerFocusTick(0);
    setSelectedTextId(layers.length === 1 ? layers[0].id : null);
    setBottomDockHeight(0);
    setNaturalSize(null);
    setCanvasSize(null);
    RNImage.getSize(
      image.uri,
      (width, height) => setNaturalSize({width, height}),
      () => setNaturalSize({width: screenWidth, height: screenWidth}),
    );
  }, [visible, image, initialAnnotation, screenWidth, showEntryMenu]);

  useEffect(() => {
    if (!selectedTextId) {
      return;
    }
    setTextLayers((current) =>
      current.map((entry) =>
        entry.id === selectedTextId ? {...entry, color, fontSize, textAlign} : entry,
      ),
    );
  }, [color, fontSize, selectedTextId, textAlign]);

  const selectedLayer = useMemo(
    () => textLayers.find((entry) => entry.id === selectedTextId) ?? null,
    [selectedTextId, textLayers],
  );

  const startEditLayer = useCallback((layer: CatalogImageTextLayer) => {
    setTextEditingActive(true);
    setSelectedTextId(layer.id);
    setColor(layer.color);
    setFontSize(layer.fontSize);
    setTextAlign(normalizeCatalogTextAlign(layer.textAlign));
    setEditingLayerId(layer.id);
    setDraftText(layer.text);
    setPendingTextPoint(null);
  }, []);

  const handleSelectLayer = useCallback(
    (layer: CatalogImageTextLayer) => {
      if (selectedTextId === layer.id) {
        startEditLayer(layer);
        return;
      }
      setSelectedTextId(layer.id);
      setColor(layer.color);
      setFontSize(layer.fontSize);
      setTextAlign(normalizeCatalogTextAlign(layer.textAlign));
      setPendingTextPoint(null);
      setEditingLayerId(null);
      setDraftText('');
    },
    [selectedTextId, startEditLayer],
  );

  const startAddTextCompose = useCallback(() => {
    setTextEditingActive(true);
    setSelectedTextId(null);
    setEditingLayerId(null);
    setDraftText('');
    setPendingTextPoint(DEFAULT_COMPOSE_POINT);
  }, []);

  const commitEditedLayer = useCallback(() => {
    if (!editingLayerId || !draftText.trim()) {
      setEditingLayerId(null);
      setDraftText('');
      return;
    }

    pushHistory();
    setTextLayers((current) =>
      current.map((entry) =>
        entry.id === editingLayerId
          ? {
              ...entry,
              text: draftText.trim(),
              color,
              fontSize,
              textAlign,
            }
          : entry,
      ),
    );
    setEditingLayerId(null);
    setDraftText('');
  }, [color, draftText, editingLayerId, fontSize, pushHistory, textAlign]);

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
      textAlign,
    };
    setTextLayers((current) => [...current, layer]);
    setSelectedTextId(layer.id);
    setPendingTextPoint(null);
    setDraftText('');
  }, [color, draftText, fontSize, pendingTextPoint, pushHistory, textAlign]);

  const cancelCompose = useCallback(() => {
    Keyboard.dismiss();
    setPendingTextPoint(null);
    setEditingLayerId(null);
    setDraftText('');
    setSelectedTextId(null);
  }, []);

  const confirmCompose = useCallback(() => {
    Keyboard.dismiss();
    if (editingLayerId) {
      commitEditedLayer();
      return;
    }
    commitTextLayer();
  }, [commitEditedLayer, commitTextLayer, editingLayerId]);

  const handleUndo = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous) {
      return;
    }
    setTextLayers(previous);
    setHistory((current) => current.slice(0, -1));
    setSelectedTextId(null);
    setEditingLayerId(null);
    setDraftText('');
  }, [history]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedTextId) {
      return;
    }
    pushHistory();
    setTextLayers((current) => current.filter((entry) => entry.id !== selectedTextId));
    setSelectedTextId(null);
    setEditingLayerId(null);
    setDraftText('');
  }, [pushHistory, selectedTextId]);

  const editingLayer = useMemo(
    () => textLayers.find((entry) => entry.id === editingLayerId) ?? null,
    [editingLayerId, textLayers],
  );

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
          textAlign,
        },
      ];
    } else if (editingLayerId && draftText.trim()) {
      layers = layers.map((entry) =>
        entry.id === editingLayerId
          ? {
              ...entry,
              text: draftText.trim(),
              color,
              fontSize,
              textAlign,
            }
          : entry,
      );
    }
    return {textLayers: layers};
  }, [color, draftText, editingLayerId, fontSize, pendingTextPoint, textAlign, textLayers]);

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

  const showComposer = pendingTextPoint !== null || editingLayerId !== null;

  useEffect(() => {
    if (!showComposer) {
      return;
    }
    const timer = setTimeout(
      () => composerInputRef.current?.focus(),
      Platform.OS === 'android' ? 120 : 40,
    );
    return () => clearTimeout(timer);
  }, [showComposer, editingLayerId, pendingTextPoint?.nx, pendingTextPoint?.ny, composerFocusTick]);

  if (!image) {
    return null;
  }

  const isComposing = pendingTextPoint !== null;
  const isEditingSelected = editingLayerId !== null;
  const keyboardPad = keyboardInset > 0 ? keyboardInset : 0;
  const mainColumnPaddingBottom = bottomDockHeight + insets.bottom;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.rootFlex}>
      <View
        style={[
          styles.root,
          {paddingTop: insets.top},
          lockedModalHeight != null ? {height: lockedModalHeight} : null,
        ]}
      >
        <View style={[styles.mainColumn, {paddingBottom: mainColumnPaddingBottom}]}>
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

            {showComposer ? (
              <View style={styles.topBarComposeActions}>
                <Pressable onPress={cancelCompose} style={styles.topBarComposeBtn}>
                  <Text style={styles.textComposerCancel}>{t('cancel')}</Text>
                </Pressable>
                {isEditingSelected ? (
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      handleDeleteSelected();
                    }}
                    style={styles.topBarComposeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('imageEditorDeleteText')}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={18} color="#FF3B30" />
                  </Pressable>
                ) : null}
                <Pressable onPress={confirmCompose} style={styles.topBarComposeBtn}>
                  <Text style={styles.textComposerConfirm}>
                    {isEditingSelected ? t('saveChanges') : t('imageEditorAddText')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.topBarSpacer} />
            )}

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

          <View
            style={styles.canvasArea}
          onLayout={(event) => {
            const {width, height} = event.nativeEvent.layout;
            if (width <= 0 || height <= 0) {
              return;
            }
            setCanvasSize((current) => {
              if (current && keyboardInsetRef.current > 0) {
                return current;
              }
              return current?.width === width && current?.height === height ? current : {width, height};
            });
          }}
        >
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
                <Image
                  source={{uri: image.uri}}
                  style={{width: layout.displayWidth, height: layout.displayHeight}}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={0}
                />
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
                {!textEditingActive && textLayers.length > 0 ? (
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <CatalogImageTextOverlay
                      layers={textLayers}
                      layout={layout}
                      fontFamily={fontFamily}
                      language={language}
                    />
                  </View>
                ) : null}
                {textEditingActive
                  ? textLayers.map((layer) =>
                      editingLayerId === layer.id ? null : (
                        <DraggableTextHandle
                          key={layer.id}
                          layer={layer}
                          layout={layout}
                          selected={selectedTextId === layer.id || editingLayerId === layer.id}
                          language={language}
                          fontFamily={fontFamily}
                          onSelect={() => handleSelectLayer(layer)}
                          onEdit={() => startEditLayer(layer)}
                          onChange={(next) => {
                            setTextLayers((current) =>
                              current.map((entry) => (entry.id === next.id ? next : entry)),
                            );
                          }}
                        />
                      ),
                    )
                  : null}
                {pendingTextPoint ? (
                  <DraggableComposePreview
                    text={draftText}
                    nx={pendingTextPoint.nx}
                    ny={pendingTextPoint.ny}
                    color={color}
                    fontSize={fontSize}
                    textAlign={textAlign}
                    layout={layout}
                    language={language}
                    fontFamily={fontFamily}
                    onMove={(nx, ny) => setPendingTextPoint({nx, ny})}
                    onPress={focusComposerInput}
                  />
                ) : null}
                {editingLayer ? (
                  <DraggableComposePreview
                    text={draftText}
                    nx={editingLayer.nx}
                    ny={editingLayer.ny}
                    color={color}
                    fontSize={fontSize}
                    textAlign={textAlign}
                    layout={layout}
                    language={language}
                    fontFamily={fontFamily}
                    onMove={(nx, ny) => {
                      setTextLayers((current) =>
                        current.map((entry) =>
                          entry.id === editingLayer.id ? {...entry, nx, ny} : entry,
                        ),
                      );
                    }}
                    onPress={focusComposerInput}
                  />
                ) : null}
              </View>
            </View>
          )}
        </View>

          {showComposer ? (
            <TextInput
              ref={composerInputRef}
              value={draftText}
              onChangeText={setDraftText}
              style={[
                styles.composerInput,
                inputTextStyle,
                {bottom: insets.bottom + bottomDockHeight + keyboardPad},
              ]}
              multiline
              autoFocus
              showSoftInputOnFocus
              returnKeyType="done"
              blurOnSubmit={false}
              accessibilityLabel={t('imageTextPlaceholder')}
            />
          ) : null}
        </View>

        <View
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            setBottomDockHeight((current) => (current === height ? current : height));
          }}
          style={[styles.bottomDock, {bottom: insets.bottom + keyboardPad}]}
        >
          <TextFormattingControls
            color={color}
            onColorChange={setColor}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            textAlign={textAlign}
            onTextAlignChange={setTextAlign}
            fontSizeLabel={t('imageEditorFontSize')}
            alignLabel={t('imageEditorTextAlign')}
          />
          {showComposer ? (
            <Text style={styles.toolbarHint}>{t('imageEditorTypeOnImageHint')}</Text>
          ) : (
            <>
              <View style={styles.browseActionsRow}>
                <Pressable
                  style={styles.browseActionBtn}
                  onPress={startAddTextCompose}
                  accessibilityRole="button"
                  accessibilityLabel={t('catalogImageAddTextOption')}
                >
                  <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#34C759" />
                  <Text style={styles.browseActionLabel}>{t('catalogImageAddTextOption')}</Text>
                </Pressable>
                {selectedLayer ? (
                  <>
                    <Pressable
                      style={styles.browseActionBtn}
                      onPress={() => startEditLayer(selectedLayer)}
                      accessibilityRole="button"
                      accessibilityLabel={t('imageEditorEditText')}
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={20} color="#34C759" />
                      <Text style={styles.browseActionLabel}>{t('imageEditorEditText')}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.browseActionBtn}
                      onPress={handleDeleteSelected}
                      accessibilityRole="button"
                      accessibilityLabel={t('imageEditorDeleteText')}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={20} color="#FF3B30" />
                      <Text style={styles.browseActionDelete}>{t('imageEditorDeleteText')}</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
              <Text style={styles.toolbarHint}>{t('imageEditorBrowseHint')}</Text>
            </>
          )}
        </View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  rootFlex: {flex: 1},
  root: {flex: 1, backgroundColor: '#000000', position: 'relative'},
  mainColumn: {flex: 1, minHeight: 0},
  bottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  browseActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  browseActionBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6},
  browseActionLabel: {color: '#34C759', fontSize: 14, fontWeight: '600'},
  browseActionDelete: {color: '#FF3B30', fontSize: 14, fontWeight: '600'},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  topBarSpacer: {flex: 1},
  topBarComposeActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  topBarComposeBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 2},
  topButton: {flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8},
  topButtonText: {color: '#FFFFFF', fontSize: 15, fontWeight: '600'},
  topButtonDisabled: {color: 'rgba(255,255,255,0.35)'},
  doneText: {color: '#34C759', fontSize: 16, fontWeight: '700'},
  canvasArea: {flex: 1, width: '100%', minHeight: 0, backgroundColor: '#000000'},
  canvasStack: {flex: 1, position: 'relative'},
  interactionLayer: {position: 'absolute'},
  composerDock: {
    flexShrink: 0,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  composeIconBubble: {
    alignSelf: 'flex-start',
    backgroundColor: CATALOG_TEXT_BACKGROUND_COLOR,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  composeTextRow: {
    alignItems: 'center',
  },
  composerInput: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 44,
    opacity: 0,
    zIndex: 20,
    color: 'transparent',
  },
  textComposerActions: {flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12},
  textComposerBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 4},
  textComposerCancel: {color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '600'},
  textComposerDelete: {color: '#FF3B30', fontSize: 14, fontWeight: '600'},
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
  alignRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  alignLabel: {color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', minWidth: 56},
  alignOptions: {flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 8},
  alignButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  alignButtonActive: {backgroundColor: 'rgba(52,199,89,0.2)'},
  selectedBlock: {gap: 8},
  selectedHint: {color: 'rgba(255,255,255,0.7)', fontSize: 12},
  selectedActions: {alignSelf: 'flex-end', gap: 4},
  deleteButton: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6},
  deleteLabel: {color: '#FF3B30', fontSize: 13, fontWeight: '600'},
  editButton: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6},
  editLabel: {color: '#34C759', fontSize: 13, fontWeight: '600'},
  closeButton: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6},
  closeLabel: {color: '#FFFFFF', fontSize: 14, fontWeight: '600'},
  entryMenu: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  entryMenuHint: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  entryMenuPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
  },
  entryMenuPrimaryLabel: {color: '#FFFFFF', fontSize: 16, fontWeight: '700'},
});

export default CatalogImageTextEditorModal;
