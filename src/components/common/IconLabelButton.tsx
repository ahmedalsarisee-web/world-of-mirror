import React from 'react';
import {Platform, Pressable, StyleSheet, Text, type TextStyle, type ViewStyle} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {ComponentProps} from 'react';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  label: string;
  onPress: () => void;
  icon?: IconName;
  iconSize?: number;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

const IconLabelButton: React.FC<Props> = ({
  label,
  onPress,
  icon = 'plus',
  iconSize = 20,
  style,
  labelStyle,
}) => {
  const {theme} = useTheme();
  const {row, compactLabelTextStyle, appFont} = useDirection();

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        {
          flexDirection: row,
          backgroundColor: theme.colors.primary,
          borderRadius: theme.components.button.radius,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={iconSize} color={theme.colors.onPrimary} style={styles.icon} />
      <Text style={[styles.label, compactLabelTextStyle, appFont('bold'), {color: theme.colors.onPrimary}, labelStyle]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  icon: {flexShrink: 0},
  label: {
    fontSize: 14,
    ...(Platform.OS === 'android' ? {includeFontPadding: false} : null),
  },
});

export default IconLabelButton;
