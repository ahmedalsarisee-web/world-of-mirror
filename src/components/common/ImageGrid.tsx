import React, {useMemo, useState} from 'react';
import {Image, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import ImagePreviewModal from '@app/components/common/ImagePreviewModal';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {getPositionEnd} from '@shared/utils/directionalStyles';

interface Props {
  uris: string[];
  onRemove?: (index: number) => void;
  onAdd?: () => void;
  editable?: boolean;
  thumbSize?: number;
  previewable?: boolean;
}

const ImageGrid: React.FC<Props> = ({
  uris,
  onRemove,
  onAdd,
  editable,
  thumbSize = 88,
  previewable = true,
}) => {
  const {theme} = useTheme();
  const {direction} = useDirection();
  const removePosition = useMemo(() => getPositionEnd(direction, -6), [direction]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const openPreview = (index: number) => {
    setPreviewIndex(index);
    setPreviewOpen(true);
  };

  const renderThumb = (uri: string, index: number) => {
    const image = (
      <Image
        source={{uri}}
        resizeMode="cover"
        style={[
          styles.thumb,
          {
            width: thumbSize,
            height: thumbSize,
            borderRadius: theme.components.productCard.imageRadius,
          },
        ]}
      />
    );

    if (!previewable) {
      return image;
    }

    return (
      <Pressable onPress={() => openPreview(index)} accessibilityRole="imagebutton">
        {image}
      </Pressable>
    );
  };

  return (
    <>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, {paddingVertical: thumbSize < 88 ? 4 : 8}]}
      >
        {uris.map((uri, index) => (
          <View key={`${uri}-${index}`} style={styles.thumbWrap}>
            {renderThumb(uri, index)}
            {editable && onRemove ? (
              <Pressable style={[styles.removeBtn, removePosition]} onPress={() => onRemove(index)}>
                <MaterialCommunityIcons name="close-circle" size={22} color={theme.colors.danger} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {editable && onAdd ? (
          <Pressable
            style={[
              styles.addBtn,
              {
                width: thumbSize,
                height: thumbSize,
                borderColor: theme.colors.primary,
                borderRadius: theme.components.productCard.imageRadius,
              },
            ]}
            onPress={onAdd}
          >
            <MaterialCommunityIcons name="image-plus" size={28} color={theme.colors.primary} />
          </Pressable>
        ) : null}
      </ScrollView>

      <ImagePreviewModal
        visible={previewOpen}
        uris={uris}
        initialIndex={previewIndex}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  row: {gap: 10},
  thumbWrap: {position: 'relative'},
  thumb: {},
  removeBtn: {position: 'absolute', top: -6},
  addBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ImageGrid;
