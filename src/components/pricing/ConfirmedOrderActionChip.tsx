import React, {useMemo} from 'react';
import {Pressable, StyleSheet, Text, type TextStyle, type ViewStyle} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {ComponentProps} from 'react';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  tone?: 'primary' | 'neutral' | 'danger' | 'success';
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

const ConfirmedOrderActionChip: React.FC<Props> = ({
  label,
  onPress,
  icon,
  disabled = false,
  tone = 'neutral',
  style,
  labelStyle,
}) => {
  const {theme} = useTheme();
  const {row, centeredTextStyle, appFont} = useDirection();

  const colors = useMemo(() => {
    switch (tone) {
      case 'primary':
        return {
          border: theme.colors.primary,
          background: `${theme.colors.primary}10`,
          text: theme.colors.primary,
          icon: theme.colors.primary,
        };
      case 'danger':
        return {
          border: theme.status.error,
          background: `${theme.status.error}10`,
          text: theme.status.error,
          icon: theme.status.error,
        };
      case 'success':
        return {
          border: theme.status.success,
          background: `${theme.status.success}12`,
          text: theme.status.success,
          icon: theme.status.success,
        };
      default:
        return {
          border: theme.colors.divider,
          background: theme.colors.card,
          text: theme.typography.primary,
          icon: theme.colors.icon,
        };
    }
  }, [theme, tone]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({pressed}) => [
        styles.chip,
        {
          flexDirection: row,
          borderColor: colors.border,
          backgroundColor: colors.background,
          opacity: pressed || disabled ? 0.65 : 1,
        },
        style,
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons name={icon} size={15} color={colors.icon} style={styles.icon} />
      ) : null}
      <Text
        style={[
          styles.label,
          centeredTextStyle,
          appFont('bold'),
          {color: colors.text},
          labelStyle,
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 34,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  icon: {flexShrink: 0},
  label: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});

export default ConfirmedOrderActionChip;
