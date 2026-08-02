import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  scaleCatalogTextFontSize,
  type CatalogImageLayout,
  type CatalogImageTextLayer,
} from '@app/utils/catalogImageTextEditor';

interface Props {
  layer: CatalogImageTextLayer;
  layout: CatalogImageLayout;
  fontFamily: string;
  writingDirection: 'rtl' | 'ltr';
  maxWidth?: number;
}

const CatalogImageTextBubble: React.FC<Props> = ({
  layer,
  layout,
  fontFamily,
  writingDirection,
  maxWidth,
}) => {
  const fontSize = scaleCatalogTextFontSize(layer.fontSize, layout);
  const textAlign = layer.textAlign;
  const bubbleMaxWidth = maxWidth ?? layout.imageWidth * 0.9;

  return (
    <View
      style={[
        styles.wrap,
        layer.withBackground
          ? {
              backgroundColor: 'rgba(0,0,0,0.55)',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
            }
          : null,
        {maxWidth: bubbleMaxWidth},
      ]}
    >
      <Text
        style={{
          color: layer.color,
          fontSize,
          fontFamily,
          fontWeight: '700',
          textAlign,
          writingDirection,
          textShadowColor: layer.withBackground ? undefined : 'rgba(0,0,0,0.75)',
          textShadowOffset: layer.withBackground ? undefined : {width: 0, height: 1},
          textShadowRadius: layer.withBackground ? undefined : 3,
        }}
      >
        {layer.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
});

export default CatalogImageTextBubble;
