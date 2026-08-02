import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  size: number;
  radius: number;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  onPress: () => void;
}

const OrderStudioUploadTile: React.FC<Props> = ({
  size,
  radius,
  disabled,
  loading,
  label,
  onPress,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label ?? t('orderStudioUploadTileLabel')}
      style={({pressed}) => [
        {
          width: size,
          height: size,
          borderRadius: radius,
          opacity: disabled || loading ? 0.55 : pressed ? 0.88 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            borderRadius: radius,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.surfaceSecondary,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <MaterialCommunityIcons name="camera-plus-outline" size={28} color={theme.colors.primary} />
        )}
        <Text
          style={[styles.label, textStyle, {color: theme.colors.primary}]}
          numberOfLines={2}
        >
          {label ?? t('orderStudioUploadTileLabel')}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
});

export default OrderStudioUploadTile;
