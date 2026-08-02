import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  KeyboardAvoidingView,
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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import CatalogDraggableTextAnchor from '@app/components/common/catalogImageText/CatalogDraggableTextAnchor';
import CatalogImageCaptureView, {
  type CatalogImageCaptureHandle,
} from '@app/components/common/catalogImageText/CatalogImageCaptureView';
import CatalogImageTextBubble from '@app/components/common/catalogImageText/CatalogImageTextBubble';
import {useTheme} from '@app/context/ThemeContext';
import {useDirection} from '@app/hooks/useDirection';
import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';
import type {PickedImage} from '@app/utils/imagePicker';
import {
  CATALOG_IMAGE_TEXT_COLORS,
  MAX_CATALOG_TEXT_FONT_SIZE,
  MIN_CATALOG_TEXT_FONT_SIZE,
  cloneCatalogImageTextLayers,
  computeContainLayout,
  createCatalogImageTextLayerId,
  getCatalogImageTextWritingDirection,
  isEmptyCatalogImageTextAnnotation,
  type CatalogImageTextAlign,
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

const DEFAULT_COLOR = '#FFFFFF';
const DEFAULT_FONT_SIZE = 28;
const DEFAULT_TEXT_ALIGN: CatalogImageTextAlign = 'left';

const TEXT_ALIGN_ICONS: Record<CatalogImageTextAlign, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  left: 'format-align-left',
  center: 'format-align-center',
  right: 'format-align-right',
};

const CatalogImageTextEditorModal: React.FC<Props> = ({
  visible,
  imageId,
  image,
  initialAnnotation,
  onClose,
  onComplete,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const {fontFamily, language, isRTL, inlineTextStyle} = useDirection();
  const writingDirection = getCatalogImageTextWritingDirection(language);

  const [textLayers, setTextLayers] = useState<CatalogImageTextLayer[]>([]);
  const [history, setHistory] = useState<CatalogImageTextLayer[][]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [textAlign, setTextAlign] = useState<CatalogImageTextAlign>(DEFAULT_TEXT_ALIGN);
  const [withBackground, setWithBackground] = useState(true);
  const [intrinsicSize, setIntrinsicSize] = useState<{width: number; height: number} | null>(null);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const captureRef = useRef<CatalogImageCaptureHandle>(null);
  const inputRef = useRef<TextInput>(null);

  const canvasWidth = screenWidth;
  const canvasHeight = Math.min(screenHeight * 0.52, screenWidth);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const layers = (initialAnnotation?.textLayers ?? []).map((layer) => ({...layer}));
    setTextLayers(layers);
    setHistory([]);
    setSelectedLayerId(layers[0]?.id ?? null);
    setDraftText(layers[0]?.text ?? '');
    setColor(layers[0]?.color ?? DEFAULT_COLOR);
    setFontSize(layers[0]?.fontSize ?? DEFAULT_FONT_SIZE);
    setTextAlign(layers[0]?.textAlign ?? (isRTL ? 'right' : DEFAULT_TEXT_ALIGN));
    setWithBackground(layers[0]?.withBackground ?? true);
    setIsEditing(false);
    setIntrinsicSize(null);

    if (image?.uri) {
      RNImage.getSize(
        image.uri,
        (width, height) => setIntrinsicSize({width, height}),
        () => setIntrinsicSize({width: canvasWidth, height: canvasHeight}),
      );
    }
  }, [visible, image?.uri, initialAnnotation, isRTL, canvasWidth, canvasHeight]);

  const layout = useMemo(() => {
    const intrinsic = intrinsicSize ?? {width: canvasWidth, height: canvasHeight};
    return computeContainLayout(canvasWidth, canvasHeight, intrinsic.width, intrinsic.height);
  }, [canvasHeight, canvasWidth, intrinsicSize]);

  const selectedLayer = textLayers.find((layer) => layer.id === selectedLayerId) ?? null;

  const pushHistory = useCallback(() => {
    setHistory((current) => [...current.slice(-30), cloneCatalogImageTextLayers(textLayers)]);
  }, [textLayers]);

  const undo = useCallback(() => {
    setHistory((current) => {
      if (current.length === 0) {
        return current;
      }
      const previous = current[current.length - 1];
      setTextLayers(previous);
      return current.slice(0, -1);
    });
  }, []);

  const applyLayerStyleToControls = useCallback((layer: CatalogImageTextLayer) => {
    setColor(layer.color);
    setFontSize(layer.fontSize);
    setTextAlign(layer.textAlign);
    setWithBackground(layer.withBackground);
    setDraftText(layer.text);
  }, []);

  const updateLayer = useCallback((layerId: string, patch: Partial<CatalogImageTextLayer>) => {
    setTextLayers((current) =>
      current.map((layer) => (layer.id === layerId ? {...layer, ...patch} : layer)),
    );
  }, []);

  const selectLayer = useCallback(
    (layer: CatalogImageTextLayer) => {
      setSelectedLayerId(layer.id);
      applyLayerStyleToControls(layer);
      setIsEditing(false);
    },
    [applyLayerStyleToControls],
  );

  const startEditLayer = useCallback(
    (layer: CatalogImageTextLayer) => {
      selectLayer(layer);
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [selectLayer],
  );

  const addTextLayer = useCallback(() => {
    pushHistory();
    const layer: CatalogImageTextLayer = {
      id: createCatalogImageTextLayerId(),
      text: '',
      nx: 0.35,
      ny: 0.4,
      color,
      fontSize,
      withBackground,
      textAlign: isRTL ? 'right' : textAlign,
    };
    setTextLayers((current) => [...current, layer]);
    setSelectedLayerId(layer.id);
    setDraftText('');
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [color, fontSize, isRTL, pushHistory, textAlign, withBackground]);

  const deleteSelectedLayer = useCallback(() => {
    if (!selectedLayerId) {
      return;
    }
    pushHistory();
    setTextLayers((current) => current.filter((layer) => layer.id !== selectedLayerId));
    setSelectedLayerId(null);
    setDraftText('');
    setIsEditing(false);
  }, [pushHistory, selectedLayerId]);

  const commitDraftToLayer = useCallback(() => {
    if (!selectedLayerId) {
      return;
    }
    const trimmed = draftText.trim();
    if (!trimmed) {
      deleteSelectedLayer();
      return;
    }
    updateLayer(selectedLayerId, {
      text: trimmed,
      color,
      fontSize,
      textAlign,
      withBackground,
    });
    setIsEditing(false);
  }, [
    color,
    deleteSelectedLayer,
    draftText,
    fontSize,
    selectedLayerId,
    textAlign,
    updateLayer,
    withBackground,
  ]);

  const handleMoveLayer = useCallback(
    (layerId: string, nx: number, ny: number) => {
      updateLayer(layerId, {nx, ny});
    },
    [updateLayer],
  );

  const handleSave = useCallback(async () => {
    if (isEditing) {
      commitDraftToLayer();
    }

    const snapshot: CatalogImageTextAnnotation = {
      textLayers: textLayers
        .map((layer) => {
          if (layer.id === selectedLayerId && draftText.trim()) {
            return {
              ...layer,
              text: draftText.trim(),
              color,
              fontSize,
              textAlign,
              withBackground,
            };
          }
          return layer;
        })
        .filter((layer) => layer.text.trim().length > 0),
    };

    if (isEmptyCatalogImageTextAnnotation(snapshot)) {
      Alert.alert(t('error'), t('imageEditorNothingToSave'));
      return;
    }

    setSaving(true);
    try {
      await onComplete(snapshot);
      onClose();
    } catch (error) {
      console.error('[CatalogImageTextEditorModal]', error);
      Alert.alert(t('error'), t('mirrorCatalogAnnotationSaveFailed'));
    } finally {
      setSaving(false);
    }
  }, [
    color,
    commitDraftToLayer,
    draftText,
    fontSize,
    isEditing,
    onClose,
    onComplete,
    selectedLayerId,
    t,
    textAlign,
    textLayers,
    withBackground,
  ]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {flex: 1, backgroundColor: '#000000'},
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.md,
          paddingTop: insets.top + theme.spacing.xs,
          paddingBottom: theme.spacing.sm,
        },
        headerTitle: {color: '#FFFFFF', fontSize: theme.typographyScale.size.md, fontWeight: '700'},
        headerActions: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm},
        headerBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.12)',
        },
        headerBtnText: {color: '#FFFFFF', fontSize: theme.typographyScale.size.sm, fontWeight: '600'},
        canvasWrap: {
          width: canvasWidth,
          height: canvasHeight,
          alignSelf: 'center',
          backgroundColor: '#000000',
        },
        toolbar: {
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: insets.bottom + theme.spacing.sm,
          gap: theme.spacing.sm,
          backgroundColor: '#111111',
        },
        colorRow: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm},
        colorSwatch: {
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: 'transparent',
        },
        colorSwatchSelected: {borderColor: '#FFFFFF'},
        sliderRow: {gap: 4},
        sliderLabel: {color: '#FFFFFF', fontSize: theme.typographyScale.size.xs, opacity: 0.8},
        alignRow: {flexDirection: 'row', gap: theme.spacing.xs},
        alignBtn: {
          width: 36,
          height: 36,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.1)',
        },
        alignBtnActive: {backgroundColor: theme.colors.primary},
        hint: {color: 'rgba(255,255,255,0.7)', fontSize: theme.typographyScale.size.xs, lineHeight: 18},
        input: {
          minHeight: 42,
          borderRadius: theme.components.input.radius,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          color: '#FFFFFF',
          fontFamily,
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: writingDirection,
        },
        actionRow: {flexDirection: 'row', gap: theme.spacing.sm},
        actionBtn: {
          flex: 1,
          minHeight: 40,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.12)',
        },
        actionBtnPrimary: {backgroundColor: theme.colors.primary},
        actionBtnText: {color: '#FFFFFF', fontWeight: '700'},
        hiddenCapture: {position: 'absolute', left: -9999, top: 0, opacity: 0},
      }),
    [canvasHeight, canvasWidth, fontFamily, insets.bottom, insets.top, isRTL, theme, writingDirection],
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.backdrop}>
        <KeyboardAvoidingView
          style={{flex: 1}}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Pressable
              onPress={undo}
              disabled={history.length === 0}
              style={[styles.headerBtn, history.length === 0 ? {opacity: 0.4} : null]}
              accessibilityRole="button"
              accessibilityLabel={t('imageEditorUndo')}
            >
              <MaterialCommunityIcons name="undo" size={16} color="#FFFFFF" />
              <Text style={styles.headerBtnText}>{t('imageEditorUndo')}</Text>
            </Pressable>

            <Text style={styles.headerTitle}>{t('addTextToImage')}</Text>

            <View style={styles.headerActions}>
              <Pressable
                onPress={addTextLayer}
                style={styles.headerBtn}
                accessibilityRole="button"
                accessibilityLabel={t('imageEditorAddText')}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.headerBtnText}>{t('imageEditorAddText')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSave()}
                disabled={saving}
                style={[styles.headerBtn, {backgroundColor: theme.colors.primary}]}
                accessibilityRole="button"
                accessibilityLabel={t('imageEditorDone')}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.headerBtnText}>{t('imageEditorDone')}</Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.canvasWrap}>
            {image?.uri ? (
              <Image source={{uri: image.uri}} style={{width: canvasWidth, height: canvasHeight}} contentFit="contain" />
            ) : (
              <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            )}

            {textLayers.map((layer) => {
              if (isEditing && layer.id === selectedLayerId) {
                return null;
              }
              return (
                <CatalogDraggableTextAnchor
                  key={layer.id}
                  layout={layout}
                  layer={layer}
                  disabled={isEditing}
                  onMove={handleMoveLayer}
                >
                  <Pressable
                    onPress={() => selectLayer(layer)}
                    onLongPress={() => startEditLayer(layer)}
                  >
                    <CatalogImageTextBubble
                      layer={layer}
                      layout={layout}
                      fontFamily={fontFamily}
                      writingDirection={writingDirection}
                    />
                  </Pressable>
                </CatalogDraggableTextAnchor>
              );
            })}

            {isEditing && selectedLayer ? (
              <CatalogDraggableTextAnchor
                layout={layout}
                layer={selectedLayer}
                disabled={false}
                onMove={(layerId, nx, ny) => {
                  updateLayer(layerId, {nx, ny});
                }}
              >
                <View style={{opacity: 0.35}}>
                  <CatalogImageTextBubble
                    layer={{
                      ...selectedLayer,
                      text: draftText || ' ',
                      color,
                      fontSize,
                      textAlign,
                      withBackground,
                    }}
                    layout={layout}
                    fontFamily={fontFamily}
                    writingDirection={writingDirection}
                  />
                </View>
              </CatalogDraggableTextAnchor>
            ) : null}
          </View>

          <View style={styles.toolbar}>
            <View style={styles.colorRow}>
              {CATALOG_IMAGE_TEXT_COLORS.map((entry) => (
                <Pressable
                  key={entry}
                  onPress={() => {
                    setColor(entry);
                    if (selectedLayerId) {
                      updateLayer(selectedLayerId, {color: entry});
                    }
                  }}
                  style={[
                    styles.colorSwatch,
                    {backgroundColor: entry},
                    color === entry ? styles.colorSwatchSelected : null,
                  ]}
                />
              ))}
              <Pressable
                onPress={() => {
                  const next = !withBackground;
                  setWithBackground(next);
                  if (selectedLayerId) {
                    updateLayer(selectedLayerId, {withBackground: next});
                  }
                }}
                style={[styles.alignBtn, withBackground ? styles.alignBtnActive : null]}
                accessibilityRole="button"
                accessibilityLabel={t('textWithBackground')}
              >
                <MaterialCommunityIcons name="format-color-fill" size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>{t('imageEditorFontSize')}</Text>
              <Slider
                minimumValue={MIN_CATALOG_TEXT_FONT_SIZE}
                maximumValue={MAX_CATALOG_TEXT_FONT_SIZE}
                step={1}
                value={fontSize}
                onValueChange={(value) => {
                  setFontSize(value);
                  if (selectedLayerId) {
                    updateLayer(selectedLayerId, {fontSize: value});
                  }
                }}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor="rgba(255,255,255,0.25)"
                thumbTintColor="#FFFFFF"
              />
            </View>

            <View style={styles.alignRow}>
              {(['left', 'center', 'right'] as CatalogImageTextAlign[]).map((align) => (
                <Pressable
                  key={align}
                  onPress={() => {
                    setTextAlign(align);
                    if (selectedLayerId) {
                      updateLayer(selectedLayerId, {textAlign: align});
                    }
                  }}
                  style={[styles.alignBtn, textAlign === align ? styles.alignBtnActive : null]}
                  accessibilityRole="button"
                  accessibilityLabel={t('imageEditorTextAlign')}
                >
                  <MaterialCommunityIcons name={TEXT_ALIGN_ICONS[align]} size={18} color="#FFFFFF" />
                </Pressable>
              ))}
            </View>

            {isEditing ? (
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={draftText}
                onChangeText={setDraftText}
                placeholder={t('imageTextPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.45)"
                multiline
                autoFocus
                onBlur={commitDraftToLayer}
              />
            ) : (
              <Text style={[styles.hint, inlineTextStyle]}>{t('imageEditorBrowseHint')}</Text>
            )}

            {selectedLayerId ? (
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    const layer = textLayers.find((entry) => entry.id === selectedLayerId);
                    if (layer) {
                      startEditLayer(layer);
                    }
                  }}
                >
                  <Text style={styles.actionBtnText}>{t('imageEditorEditText')}</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={deleteSelectedLayer}>
                  <Text style={[styles.actionBtnText, {color: '#FCA5A5'}]}>{t('imageEditorDeleteText')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {image?.uri ? (
            <View style={styles.hiddenCapture} pointerEvents="none">
              <CatalogImageCaptureView
                ref={captureRef}
                imageId={imageId}
                imageUri={image.uri}
                annotation={{textLayers}}
                width={canvasWidth}
                height={canvasHeight}
              />
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default CatalogImageTextEditorModal;
