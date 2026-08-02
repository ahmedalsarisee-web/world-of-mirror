import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type {LangCode} from '@app/types/language';
import {
  CATALOG_IMAGE_COORDINATE_LAYER_STYLE,
  CATALOG_TEXT_BACKGROUND_COLOR,
  getCatalogTextDisplaySize,
  getCatalogTextBubbleMetrics,
  getCatalogTextShadowStyle,
  isCatalogImageLayoutReady,
  isCatalogTextRtl,
  normalizeCatalogTextAlign,
  type CatalogImageLayout,
  type CatalogImageTextLayer,
} from '@app/utils/catalogImageTextEditor';

type LayerLike = Pick<
  CatalogImageTextLayer,
  'text' | 'nx' | 'ny' | 'color' | 'fontSize' | 'withBackground' | 'textAlign'
>;

interface Props {
  layer: LayerLike;
  layout: CatalogImageLayout;
  language: LangCode;
  fontFamily?: string;
  borderColor?: string;
  containerStyle?: ViewStyle;
  onPress?: () => void;
  /** When true, only the bubble is rendered (positioning handled by parent). */
  inline?: boolean;
}

function getAnchorTransform(textAlign: ReturnType<typeof normalizeCatalogTextAlign>) {
  if (textAlign === 'center') {
    return [{translateX: '-50%'}] as const;
  }
  if (textAlign === 'right') {
    return [{translateX: '-100%'}] as const;
  }
  return undefined;
}

const CatalogImageTextBubble: React.FC<Props> = ({
  layer,
  layout,
  language,
  fontFamily,
  borderColor,
  containerStyle,
  onPress,
  inline = false,
}) => {
  if (!isCatalogImageLayoutReady(layout)) {
    return null;
  }

  const displaySize = getCatalogTextDisplaySize(layer.fontSize, layout.scale);
  const bubbleMetrics = getCatalogTextBubbleMetrics(layout.scale);
  const align = normalizeCatalogTextAlign(layer.textAlign);
  const anchorX = layer.nx * layout.displayWidth;
  const anchorY = layer.ny * layout.displayHeight;
  const layerRtl = isCatalogTextRtl(layer.text, language);
  const textStyle: TextStyle = {
    color: layer.color,
    fontSize: displaySize,
    fontFamily,
    writingDirection: layerRtl ? 'rtl' : 'ltr',
    textAlign: align,
    fontWeight: '700',
    ...getCatalogTextShadowStyle(displaySize),
  };

  const bubbleContent = (
    <View
      style={[
        styles.bubble,
        {
          paddingHorizontal: bubbleMetrics.paddingHorizontal,
          paddingVertical: bubbleMetrics.paddingVertical,
          borderRadius: bubbleMetrics.borderRadius,
        },
        layer.withBackground ? styles.bubbleFilled : null,
        borderColor ? {borderWidth: 1, borderColor} : null,
      ]}
    >
      <Text style={textStyle}>{layer.text}</Text>
    </View>
  );

  if (inline) {
    return onPress ? (
      <Pressable onPress={onPress} accessibilityRole="button">
        {bubbleContent}
      </Pressable>
    ) : (
      bubbleContent
    );
  }

  const interactive = Boolean(onPress);

  return (
    <View
      pointerEvents={interactive ? 'auto' : 'box-none'}
      style={[
        styles.anchor,
        CATALOG_IMAGE_COORDINATE_LAYER_STYLE,
        {
          left: anchorX,
          top: anchorY,
          transform: getAnchorTransform(align),
        },
        containerStyle,
      ]}
    >
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button">
          {bubbleContent}
        </Pressable>
      ) : (
        bubbleContent
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
  },
  bubble: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  bubbleFilled: {
    backgroundColor: CATALOG_TEXT_BACKGROUND_COLOR,
  },
});

export default CatalogImageTextBubble;
