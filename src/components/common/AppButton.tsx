import React, {useMemo} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle} from 'react-native';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'success' | 'danger' | 'info' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const AppButton: React.FC<Props> = ({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}) => {
  const {theme} = useTheme();
  const {centeredTextStyle, appFont} = useDirection();
  const isOutline = variant === 'outline';

  const colors = useMemo(
    () => ({
      primary: theme.colors.primary,
      success: theme.colors.success,
      danger: theme.colors.danger,
      info: '#2563EB',
      outline: 'transparent',
    }),
    [theme],
  );

  const bg = colors[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        styles.button,
        {
          minHeight: theme.components.button.height,
          borderRadius: theme.components.button.radius,
          backgroundColor: isOutline ? 'transparent' : bg,
          borderColor: isOutline ? theme.colors.primary : bg,
          opacity: pressed || disabled ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.onPrimary} />
      ) : (
        <Text
          style={[
            styles.label,
            centeredTextStyle,
            appFont('bold'),
            {color: isOutline ? theme.colors.primary : theme.colors.onPrimary},
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {fontSize: 16},
});

export default AppButton;
