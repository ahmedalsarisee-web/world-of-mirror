import React, {useMemo} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, type ViewStyle} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTheme} from '@app/context/ThemeContext';

interface Props {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  size?: number;
  style?: ViewStyle;
}

const AccountStatementExportButton: React.FC<Props> = ({
  onPress,
  loading = false,
  disabled = false,
  size = 22,
  style,
}) => {
  const {theme} = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceSecondary,
        },
      }),
    [theme],
  );

  return (
    <Pressable
      style={({pressed}) => [styles.button, style, {opacity: pressed || disabled ? 0.65 : 1}]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel="export account statement pdf"
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <MaterialCommunityIcons name="file-pdf-box" size={size} color={theme.colors.primary} />
      )}
    </Pressable>
  );
};

export default AccountStatementExportButton;
