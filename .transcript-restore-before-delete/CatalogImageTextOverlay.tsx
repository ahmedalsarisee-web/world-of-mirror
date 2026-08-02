import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {LangCode} from '@app/types/language';
import {
  CATALOG_IMAGE_COORDINATE_LAYER_STYLE,
  getCatalogTextLayerPosition,
  getCatalogTextLayerTextStyle,
  isCatalogImageLayoutReady,
  type CatalogImageLayout,
  type CatalogImageTextLayer,
} from '@app/utils/catalogImageTextEditor';

interface Props {
  layers: CatalogImageTextLayer[];
  layout: CatalogImageLayout;
  fontFamily?: string;
  language: LangCode;
}

const CatalogImageTextOverlay: React.FC<Props> = ({layers, layout, fontFamily, language}) => {
  if (!isCatalogImageLayoutReady(layout)) {
    return null;
  }

  return (
    <>
      {layers.map((layer) => {
        const {left, top, width, displaySize} = getCatalogTextLayerPosition(layer, layout, language);
        return (
          <View
            key={layer.id}
            pointerEvents="none"
            style={[
              styles.layer,
              CATALOG_IMAGE_COORDINATE_LAYER_STYLE,
              {
                left,
                top,
                minWidth: width,
                minHeight: displaySize + 12,
              },
            ]}
          >
            <Text style={[styles.label, getCatalogTextLayerTextStyle(layer, layout, language, fontFamily)]}>
              {layer.text}
            </Text>
          </View>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
  },
  label: {
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
});

export default CatalogImageTextOverlay;
