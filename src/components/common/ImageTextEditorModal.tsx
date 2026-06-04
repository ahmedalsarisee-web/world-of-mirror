import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {captureRef} from 'react-native-view-shot';
import AppButton from '@app/components/common/AppButton';
import AppInput from '@app/components/common/AppInput';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {PickedImage} from '@app/utils/imagePicker';
import {
  IMAGE_TEXT_COLORS,
  IMAGE_TEXT_SIZE_MAP,
  uriToPickedImage,
  type ImageTextPosition,
  type ImageTextSize,
} from '@app/utils/imageCompose';

interface Props {
  visible: boolean;
  image: PickedImage | null;
  onClose: () => void;
  onComplete: (image: PickedImage) => void;
}

const CANVAS_HORIZONTAL_PADDING = 32;
const MAX_CAPTURE_WIDTH = 2048;

const ImageTextEditorModal: React.FC<Props> = ({visible, image, onClose, onComplete}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const {width: screenWidth} = useWindowDimensions();
  const {textStyle, appFont, language} = useDirection();
  const canvasRef = useRef<View>(null);

  const [text, setText] = useState('');
  const [color, setColor] = useState<string>(IMAGE_TEXT_COLORS[0]);
  const [size, setSize] = useState<ImageTextSize>('md');
  const [position, setPosition] = useState<ImageTextPosition>('bottom');
  const [withBackground, setWithBackground] = useState(true);
  const [naturalSize, setNaturalSize] = useState<{width: number; height: number} | null>(null);
  const [saving, setSaving] = useState(false);

  const canvasWidth = screenWidth - CANVAS_HORIZONTAL_PADDING;
  const aspectRatio = naturalSize ? naturalSize.width / naturalSize.height : 1;
  const canvasHeight = Math.round(canvasWidth / aspectRatio);
  const fontSize = IMAGE_TEXT_SIZE_MAP[size];
  const fontFamily = appFont('bold').fontFamily;

  useEffect(() => {
    if (!visible || !image) {
      return;
    }

    setText('');
    setColor(IMAGE_TEXT_COLORS[0]);
    setSize('md');
    setPosition('bottom');
    setWithBackground(true);
    setNaturalSize(null);

    Image.getSize(
      image.uri,
      (width, height) => setNaturalSize({width, height}),
      () => setNaturalSize({width: canvasWidth, height: canvasWidth}),
    );
  }, [visible, image, canvasWidth]);

  const overlayPositionStyle = useMemo(() => {
    if (position === 'top') {
      return styles.overlayTop;
    }
    if (position === 'center') {
      return styles.overlayCenter;
    }
    return styles.overlayBottom;
  }, [position]);

  const handleSave = async () => {
    if (!image || !canvasRef.current || !naturalSize) {
      return;
    }

    setSaving(true);
    try {
      const captureWidth = Math.min(MAX_CAPTURE_WIDTH, naturalSize.width);
      const captureHeight = Math.round(captureWidth / aspectRatio);

      const capturedUri = await captureRef(canvasRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
        width: captureWidth,
        height: captureHeight,
      });

      onComplete(await uriToPickedImage(capturedUri));
    } catch (error) {
      console.error('[ImageTextEditorModal]', error);
      onComplete(image);
    } finally {
      setSaving(false);
    }
  };

  if (!image) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.root, {backgroundColor: theme.backgrounds.background, paddingTop: insets.top}]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={[styles.title, textStyle, {color: theme.typography.primary}]}>{t('addTextToImage')}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <MaterialCommunityIcons name="close" size={24} color={theme.typography.primary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + 16}]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.canvasWrap}>
            {!naturalSize ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <View
                ref={canvasRef}
                collapsable={false}
                style={[styles.canvas, {width: canvasWidth, height: canvasHeight}]}
              >
                <Image source={{uri: image.uri}} style={StyleSheet.absoluteFill} resizeMode="cover" />
                {text.trim() ? (
                  <View
                    style={[
                      styles.overlay,
                      overlayPositionStyle,
                      withBackground ? styles.overlayBg : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.overlayText,
                        {
                          color,
                          fontSize,
                          fontFamily,
                          writingDirection: language === 'ar' ? 'rtl' : 'ltr',
                        },
                      ]}
                    >
                      {text}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          <AppInput
            fieldKey="imageText"
            label={t('imageTextLabel')}
            value={text}
            onChangeText={setText}
            placeholder={t('imageTextPlaceholder')}
            multiline
          />

          <Text style={[styles.sectionLabel, textStyle, {color: theme.typography.secondary}]}>
            {t('textColor')}
          </Text>
          <View style={styles.chipRow}>
            {IMAGE_TEXT_COLORS.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.colorChip,
                  {backgroundColor: option},
                  color === option ? {borderColor: theme.colors.primary, borderWidth: 3} : null,
                ]}
                onPress={() => setColor(option)}
              />
            ))}
          </View>

          <Text style={[styles.sectionLabel, textStyle, {color: theme.typography.secondary}]}>
            {t('textSize')}
          </Text>
          <View style={styles.chipRow}>
            {(['sm', 'md', 'lg'] as ImageTextSize[]).map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.optionChip,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: size === option ? theme.colors.primary : theme.colors.divider,
                  },
                ]}
                onPress={() => setSize(option)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    textStyle,
                    {color: size === option ? theme.colors.primary : theme.typography.primary},
                  ]}
                >
                  {t(`textSize_${option}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionLabel, textStyle, {color: theme.typography.secondary}]}>
            {t('textPosition')}
          </Text>
          <View style={styles.chipRow}>
            {(['top', 'center', 'bottom'] as ImageTextPosition[]).map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.optionChip,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: position === option ? theme.colors.primary : theme.colors.divider,
                  },
                ]}
                onPress={() => setPosition(option)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    textStyle,
                    {color: position === option ? theme.colors.primary : theme.typography.primary},
                  ]}
                >
                  {t(`textPosition_${option}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[
              styles.toggleRow,
              {
                backgroundColor: theme.colors.surface,
                borderColor: withBackground ? theme.colors.primary : theme.colors.divider,
              },
            ]}
            onPress={() => setWithBackground((value) => !value)}
          >
            <MaterialCommunityIcons
              name="format-color-fill"
              size={20}
              color={withBackground ? theme.colors.primary : theme.typography.secondary}
            />
            <Text style={[styles.toggleLabel, textStyle, {color: theme.typography.primary}]}>
              {t('textWithBackground')}
            </Text>
          </Pressable>

          <View style={styles.actions}>
            <AppButton label={t('cancel')} variant="outline" onPress={onClose} style={styles.actionBtn} />
            <AppButton
              label={t('saveImage')}
              onPress={() => void handleSave()}
              loading={saving}
              disabled={!naturalSize || saving}
              style={styles.actionBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {fontSize: 18, fontWeight: '700'},
  content: {paddingHorizontal: 16},
  canvasWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    marginBottom: 16,
  },
  canvas: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#000',
  },
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  overlayTop: {top: 16},
  overlayCenter: {top: '50%', transform: [{translateY: -24}]},
  overlayBottom: {bottom: 16},
  overlayBg: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 10,
  },
  overlayText: {
    textAlign: 'center',
    fontWeight: '700',
    width: '100%',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  colorChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionChipText: {fontSize: 13, fontWeight: '600'},
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  toggleLabel: {fontSize: 14, fontWeight: '600'},
  actions: {flexDirection: 'row', gap: 12},
  actionBtn: {flex: 1},
});

export default ImageTextEditorModal;
